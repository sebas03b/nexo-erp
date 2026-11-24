import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { Kysely, PGliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import { SqlFileMigrationProvider } from '../../shared/db/sql-file-migration.provider.js';
import type { Database } from '../../shared/db/schema.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../db/migrations', import.meta.url),
);

interface AsientoJson {
  id: string;
  fecha: string;
  cuenta: string;
  debito: number;
  credito: number;
  origenId: string;
  metodoPago: string | null;
  descripcion: string | null;
  createdAt: string;
}

interface ResumenVentasJson {
  totalVentas: number;
  cantidadVentas: number;
  agrupacion: string;
  datos: Array<{ clave: string; total: number; cantidad: number }>;
  productosServicios: Array<{
    productoId: string;
    nombre: string;
    tipo: string;
    cantidad: number;
    total: number;
  }>;
}

async function insertarAsiento(
  db: Kysely<Database>,
  cuenta: string,
  debito: number,
  credito: number,
  origenId: string,
  metodoPago: string,
  fecha: string,
): Promise<void> {
  await db
    .insertInto('asientos')
    .values({
      id: randomUUID(),
      fecha: new Date(fecha),
      cuenta,
      debito,
      credito,
      origen_id: origenId,
      metodo_pago: metodoPago,
      descripcion: null,
      created_at: new Date(),
    })
    .execute();
}

describe('API de Contabilidad', () => {
  let app: FastifyInstance;
  let db: Kysely<Database>;

  beforeAll(async () => {
    const pglite = new PGlite();

    db = new Kysely<Database>({
      dialect: new PGliteDialect({ pglite }),
    });

    const migrator = new Migrator({
      db,
      provider: new SqlFileMigrationProvider(MIGRATIONS_DIRECTORY),
    });
    const { error } = await migrator.migrateToLatest();

    if (error) {
      throw new Error('No se pudieron aplicar las migraciones de prueba', {
        cause: error,
      });
    }

    app = await buildApp({ db });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  beforeEach(async () => {
    await db.deleteFrom('asientos').execute();
  });

  it('listar asientos vacío al inicio', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/contabilidad/asientos',
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<AsientoJson[]>()).toEqual([]);
  });

  it('devuelve asientos de partida doble con débito y crédito iguales', async () => {
    const origenId = randomUUID();

    await insertarAsiento(db, 'CAJA', 50000, 0, origenId, 'efectivo', '2026-11-25T10:00:00.000Z');
    await insertarAsiento(db, 'INGRESOS_VENTAS', 0, 50000, origenId, 'efectivo', '2026-11-25T10:00:00.000Z');

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/contabilidad/asientos',
    });

    expect(respuesta.statusCode).toBe(200);
    const body = respuesta.json<AsientoJson[]>();
    expect(body.length).toBe(2);

    const caja = body.find((a) => a.cuenta === 'CAJA');
    const ingresos = body.find((a) => a.cuenta === 'INGRESOS_VENTAS');
    expect(caja?.debito).toBe(50000);
    expect(caja?.credito).toBe(0);
    expect(ingresos?.debito).toBe(0);
    expect(ingresos?.credito).toBe(50000);
    expect(caja?.origenId).toBe(origenId);
    expect(ingresos?.origenId).toBe(origenId);
  });

  it('reporte de ventas agrupado por día', async () => {
    const origen1 = randomUUID();
    const origen2 = randomUUID();

    await insertarAsiento(db, 'INGRESOS_VENTAS', 0, 100000, origen1, 'efectivo', '2026-11-25T10:00:00.000Z');
    await insertarAsiento(db, 'INGRESOS_VENTAS', 0, 200000, origen2, 'pasarela', '2026-11-25T11:00:00.000Z');

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/contabilidad/reporte-ventas?agrupacion=dia',
    });

    expect(respuesta.statusCode).toBe(200);
    const body = respuesta.json<ResumenVentasJson>();
    expect(body.totalVentas).toBe(300000);
    expect(body.cantidadVentas).toBe(2);
    expect(body.agrupacion).toBe('dia');
    expect(body.datos.length).toBe(1);
    expect(body.datos[0]!.clave).toBe('2026-11-25');
    expect(body.datos[0]!.total).toBe(300000);
  });

  it('reporte de ventas agrupado por medio de pago', async () => {
    await insertarAsiento(db, 'INGRESOS_VENTAS', 0, 100000, randomUUID(), 'efectivo', '2026-11-25T10:00:00.000Z');
    await insertarAsiento(db, 'INGRESOS_VENTAS', 0, 200000, randomUUID(), 'pasarela', '2026-11-25T11:00:00.000Z');

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/contabilidad/reporte-ventas?agrupacion=medio_pago',
    });

    expect(respuesta.statusCode).toBe(200);
    const body = respuesta.json<ResumenVentasJson>();
    expect(body.totalVentas).toBe(300000);
    const porMedio = body.datos.find((d) => d.clave === 'pasarela');
    expect(porMedio?.total).toBe(200000);
  });

  it('reporte de ventas sin datos', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/contabilidad/reporte-ventas',
    });

    expect(respuesta.statusCode).toBe(200);
    const body = respuesta.json<ResumenVentasJson>();
    expect(body.totalVentas).toBe(0);
    expect(body.cantidadVentas).toBe(0);
    expect(body.datos).toEqual([]);
    expect(body.productosServicios).toEqual([]);
  });
});
