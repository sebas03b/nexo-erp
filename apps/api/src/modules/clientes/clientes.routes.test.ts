import type { FastifyInstance } from 'fastify';
import { PGlite } from '@electric-sql/pglite';
import { Kysely, PGliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

import { buildApp } from '../../app.js';
import { SqlFileMigrationProvider } from '../../shared/db/sql-file-migration.provider.js';
import type { Database } from '../../shared/db/schema.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../db/migrations', import.meta.url),
);

describe('Clientes API', () => {
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
    await db.deleteFrom('clientes').execute();
  });

  it('GET /api/clientes devuelve la lista de clientes vacía al inicio', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/clientes' });

    expect(response.statusCode).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('POST /api/clientes crea un cliente y GET /api/clientes lo lista', async () => {
    const crear = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      body: {
        nombre: 'Ana Pérez',
        documento: '12345678',
        email: 'ana@example.com',
        telefono: '3000000000',
        canalPreferido: 'whatsapp',
      },
    });

    expect(crear.statusCode).toBe(201);
    const creado = crear.json<{
      id: string;
      nombre: string;
      documento: string;
      email: string;
      telefono: string;
      canalPreferido: string;
    }>();
    expect(creado.nombre).toBe('Ana Pérez');
    expect(creado.documento).toBe('12345678');
    expect(creado.canalPreferido).toBe('whatsapp');

    const listar = await app.inject({ method: 'GET', url: '/api/clientes' });

    expect(listar.statusCode).toBe(200);
    const clientes = listar.json<Array<{ id: string; nombre: string }>>();
    expect(clientes).toHaveLength(1);
    expect(clientes.at(0)?.nombre).toBe('Ana Pérez');
  });

  it('POST /api/clientes acepta email y teléfono opcionales', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      body: {
        nombre: 'Luis Gómez',
        documento: '87654321',
        canalPreferido: 'sms',
      },
    });

    expect(respuesta.statusCode).toBe(201);
    const cliente = respuesta.json<{ email: undefined; telefono: undefined }>();
    expect(cliente.email).toBeUndefined();
    expect(cliente.telefono).toBeUndefined();
  });

  it('POST /api/clientes rechaza datos inválidos con 400', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      body: {
        nombre: '',
        documento: '12345678',
        email: 'no-es-un-correo',
        canalPreferido: 'correo',
      },
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('POST /api/clientes rechaza documento duplicado con 409', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/clientes',
      body: {
        nombre: 'Ana Pérez',
        documento: '12345678',
        canalPreferido: 'email',
      },
    });

    const duplicado = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      body: {
        nombre: 'Ana Duplicate',
        documento: '12345678',
        canalPreferido: 'sms',
      },
    });

    expect(duplicado.statusCode).toBe(409);
    expect(duplicado.json<{ error: { code: string } }>().error.code).toBe(
      'DOCUMENTO_DUPLICADO',
    );
  });
});
