import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { Kysely, PGliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../app.js';
import { SqlFileMigrationProvider } from '../../../shared/db/sql-file-migration.provider.js';
import type { Database } from '../../../shared/db/schema.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../../db/migrations', import.meta.url),
);

interface CajaJson {
  id: string;
  usuarioId: string;
  apertura: string;
  cierre: string | null;
  montoInicial: number;
  montoFinal: number | null;
}

interface ErrorJson {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const USUARIO_ID = randomUUID();

describe('API de Caja (Ventas)', () => {
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
    await db.deleteFrom('cajas').execute();
    await db.deleteFrom('sesiones').execute();
    await db.deleteFrom('usuarios').execute();
    await db.deleteFrom('outbox_events').execute();

    await db
      .insertInto('usuarios')
      .values({
        id: USUARIO_ID,
        nombre: 'cajero1',
        rol: 'cajero',
        hash_password: 'hash_falso_para_prueba',
      })
      .execute();
  });

  function headersConToken() {
    return {
      'x-user-id': USUARIO_ID,
    };
  }

  it('abre una caja con monto inicial', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/caja/apertura',
      headers: headersConToken(),
      payload: { montoInicial: 100000 },
    });

    expect(respuesta.statusCode).toBe(201);
    const body = respuesta.json<CajaJson>();
    expect(body.usuarioId).toBe(USUARIO_ID);
    expect(body.montoInicial).toBe(100000);
    expect(body.cierre).toBeNull();
  });

  it('rechaza abrir una segunda caja para el mismo usuario', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/caja/apertura',
      headers: headersConToken(),
      payload: { montoInicial: 100000 },
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/caja/apertura',
      headers: headersConToken(),
      payload: { montoInicial: 50000 },
    });

    expect(respuesta.statusCode).toBe(409);
    const body = respuesta.json<ErrorJson>();
    expect(body.error.code).toBe('CAJA_YA_ABIERTA');
  });

  it('rechaza monto inicial negativo', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/caja/apertura',
      headers: headersConToken(),
      payload: { montoInicial: -1000 },
    });

    expect(respuesta.statusCode).toBe(400);
    const body = respuesta.json<ErrorJson>();
    expect(body.error.code).toBe('DATOS_INVALIDOS');
  });

  it('cierra una caja abierta', async () => {
    const apertura = await app.inject({
      method: 'POST',
      url: '/api/caja/apertura',
      headers: headersConToken(),
      payload: { montoInicial: 100000 },
    });
    const { id } = apertura.json<CajaJson>();

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/caja/${id}/cierre`,
      headers: headersConToken(),
      payload: { montoFinal: 150000 },
    });

    expect(respuesta.statusCode).toBe(200);
    const body = respuesta.json<CajaJson>();
    expect(body.montoFinal).toBe(150000);
    expect(body.cierre).not.toBeNull();
  });

  it('rechaza cerrar una caja ya cerrada', async () => {
    const apertura = await app.inject({
      method: 'POST',
      url: '/api/caja/apertura',
      headers: headersConToken(),
      payload: { montoInicial: 100000 },
    });
    const { id } = apertura.json<CajaJson>();

    await app.inject({
      method: 'POST',
      url: `/api/caja/${id}/cierre`,
      headers: headersConToken(),
      payload: { montoFinal: 150000 },
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/caja/${id}/cierre`,
      headers: headersConToken(),
      payload: { montoFinal: 200000 },
    });

    expect(respuesta.statusCode).toBe(409);
    const body = respuesta.json<ErrorJson>();
    expect(body.error.code).toBe('CAJA_NO_ABIERTA');
  });

  it('rechaza cerrar una caja inexistente', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/caja/${randomUUID()}/cierre`,
      headers: headersConToken(),
      payload: { montoFinal: 100000 },
    });

    expect(respuesta.statusCode).toBe(409);
    const body = respuesta.json<ErrorJson>();
    expect(body.error.code).toBe('CAJA_NO_ABIERTA');
  });

  it('consulta la caja abierta de un usuario', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/caja/apertura',
      headers: headersConToken(),
      payload: { montoInicial: 100000 },
    });

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/caja/actual',
      headers: headersConToken(),
    });

    expect(respuesta.statusCode).toBe(200);
    const body = respuesta.json<CajaJson>();
    expect(body.usuarioId).toBe(USUARIO_ID);
    expect(body.cierre).toBeNull();
  });

  it('devuelve 404 si no hay caja abierta para el usuario', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/caja/actual',
      headers: headersConToken(),
    });

    expect(respuesta.statusCode).toBe(404);
  });

  it('rechaza acceso sin usuario', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/caja/apertura',
      payload: { montoInicial: 100000 },
    });

    expect(respuesta.statusCode).toBe(401);
  });
});
