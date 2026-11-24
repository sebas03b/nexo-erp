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

interface LiquidacionJson {
  id: string;
  empleadoId: string;
  periodo: string;
  salarioBase: number;
  totalDevengos: number;
  totalDeducciones: number;
  netoAPagar: number;
  conceptos: Array<{
    codigo: string;
    nombre: string;
    tipo: string;
    valor: number;
  }>;
}

interface ErrorJson {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

let EMPLEADO_ID: string = randomUUID();

describe('API de Nomina', () => {
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
    await db.deleteFrom('liquidaciones').execute();
    await db.deleteFrom('conceptos_nomina').execute();
    await db.deleteFrom('empleados').execute();
    await db.deleteFrom('outbox_events').execute();

    const empleadoInsertado = await db
      .insertInto('empleados')
      .values({
        nombre: 'Empleado Nomina',
        email: null,
        telefono: null,
        activo: true,
        salario_base: 1500000,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Generated<string> ignora el id explícito; se usa el generado por la BD.
    EMPLEADO_ID = empleadoInsertado.id;

    db.insertInto('conceptos_nomina').values([
      {
        codigo: 'SALARIO_BASE',
        nombre: 'Salario base',
        tipo: 'devengo',
        activo: true,
        creado_en: new Date(),
      },
      {
        codigo: 'HORAS_EXTRAS',
        nombre: 'Horas extras',
        tipo: 'devengo',
        activo: true,
        creado_en: new Date(),
      },
      {
        codigo: 'AUXILIO_TRANSPORTE',
        nombre: 'Auxilio de transporte',
        tipo: 'devengo',
        activo: true,
        creado_en: new Date(),
      },
      {
        codigo: 'SALUD',
        nombre: 'Salud (4%)',
        tipo: 'deduccion',
        activo: true,
        creado_en: new Date(),
      },
      {
        codigo: 'PENSION',
        nombre: 'Pension (4%)',
        tipo: 'deduccion',
        activo: true,
        creado_en: new Date(),
      },
    ]);
  });

  it('calcula liquidacion con partida doble correcta', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/nomina/calcular',
      payload: {
        empleadoId: EMPLEADO_ID,
        periodo: '2026-11',
        salarioBase: 1500000,
        horasExtras: 10,
        auxilioTransporte: 1,
      },
    });

    expect(respuesta.statusCode).toBe(201);
    const body = respuesta.json<LiquidacionJson>();
    expect(body.empleadoId).toBe(EMPLEADO_ID);
    expect(body.periodo).toBe('2026-11');
    expect(body.salarioBase).toBe(1500000);

    const devengos = body.conceptos.filter((c) => c.tipo === 'devengo');
    const deducciones = body.conceptos.filter((c) => c.tipo === 'deduccion');

    const totalDevengos = devengos.reduce((acc, c) => acc + c.valor, 0);
    const totalDeducciones = deducciones.reduce((acc, c) => acc + c.valor, 0);

    expect(body.totalDevengos).toBe(totalDevengos);
    expect(body.totalDeducciones).toBe(totalDeducciones);
    expect(body.netoAPagar).toBe(totalDevengos - totalDeducciones);
  });

  it('rechaza liquidacion duplicada para mismo empleado y periodo', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/nomina/calcular',
      payload: {
        empleadoId: EMPLEADO_ID,
        periodo: '2026-11',
        salarioBase: 1500000,
      },
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/nomina/calcular',
      payload: {
        empleadoId: EMPLEADO_ID,
        periodo: '2026-11',
        salarioBase: 1500000,
      },
    });

    expect(respuesta.statusCode).toBe(409);
    const body = respuesta.json<ErrorJson>();
    expect(body.error.code).toBe('LIQUIDACION_YA_EXISTE');
  });

  it('rechaza empleado inexistente', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/nomina/calcular',
      payload: {
        empleadoId: randomUUID(),
        periodo: '2026-11',
        salarioBase: 1500000,
      },
    });

    expect(respuesta.statusCode).toBe(404);
    const body = respuesta.json<ErrorJson>();
    expect(body.error.code).toBe('EMPLEADO_NO_ENCONTRADO');
  });

  it('lista liquidaciones', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/nomina/calcular',
      payload: {
        empleadoId: EMPLEADO_ID,
        periodo: '2026-11',
        salarioBase: 1500000,
      },
    });

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/nomina/liquidaciones?empleadoId=${EMPLEADO_ID}`,
    });

    expect(respuesta.statusCode).toBe(200);
    const body = respuesta.json<LiquidacionJson[]>();
    expect(body.length).toBe(1);
    expect(body[0]!.empleadoId).toBe(EMPLEADO_ID);
  });

  it('obtiene liquidacion por id', async () => {
    const crear = await app.inject({
      method: 'POST',
      url: '/api/nomina/calcular',
      payload: {
        empleadoId: EMPLEADO_ID,
        periodo: '2026-11',
        salarioBase: 1500000,
      },
    });
    const { id } = crear.json<LiquidacionJson>();

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/nomina/liquidaciones/${id}`,
    });

    expect(respuesta.statusCode).toBe(200);
    const body = respuesta.json<LiquidacionJson>();
    expect(body.id).toBe(id);
    expect(body.netoAPagar).toBeGreaterThan(0);
  });

  it('rechaza liquidacion inexistente', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/nomina/liquidaciones/${randomUUID()}`,
    });

    expect(respuesta.statusCode).toBe(404);
  });
});
