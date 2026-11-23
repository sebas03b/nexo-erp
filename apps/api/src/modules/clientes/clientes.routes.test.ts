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
    await db.deleteFrom('citas').execute();
    await db.deleteFrom('empleados').execute();
    await db.deleteFrom('clientes').execute();
    await db.deleteFrom('outbox_events').execute();
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

  it('GET /api/clientes normaliza un canal persistido que no es válido', async () => {
    await db
      .insertInto('clientes')
      .values({
        nombre: 'Cliente histórico',
        documento: '11111111',
        email: null,
        telefono: null,
        canal_preferido: 'correo',
      })
      .execute();

    const listar = await app.inject({ method: 'GET', url: '/api/clientes' });

    expect(listar.statusCode).toBe(200);
    const clientes = listar.json<Array<{ canalPreferido: string }>>();
    expect(clientes.at(0)?.canalPreferido).toBe('email');
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

  it('PATCH /api/clientes/:id actualiza solo el canal preferido', async () => {
    const crear = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      body: {
        nombre: 'Ana Pérez',
        documento: '12345678',
        email: 'ana@example.com',
        telefono: '3000000000',
        canalPreferido: 'email',
      },
    });
    const cliente = crear.json<{ id: string }>();

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/clientes/${cliente.id}`,
      body: { canalPreferido: 'whatsapp' },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      id: cliente.id,
      nombre: 'Ana Pérez',
      email: 'ana@example.com',
      telefono: '3000000000',
      canalPreferido: 'whatsapp',
    });
  });

  it('PATCH /api/clientes/:id actualiza email y teléfono', async () => {
    const crear = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      body: {
        nombre: 'Luis Gómez',
        documento: '87654321',
        email: 'luis@example.com',
        telefono: '3000000000',
        canalPreferido: 'email',
      },
    });
    const cliente = crear.json<{ id: string }>();

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/clientes/${cliente.id}`,
      body: {
        email: 'nuevo@example.com',
        telefono: '3011112222',
      },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      email: 'nuevo@example.com',
      telefono: '3011112222',
      canalPreferido: 'email',
    });
  });

  it('PATCH /api/clientes/:id permite eliminar email y teléfono', async () => {
    const crear = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      body: {
        nombre: 'María Díaz',
        documento: '11223344',
        email: 'maria@example.com',
        telefono: '3000000000',
        canalPreferido: 'sms',
      },
    });
    const cliente = crear.json<{ id: string }>();

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/clientes/${cliente.id}`,
      body: { email: null, telefono: null },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<{ email?: string; telefono?: string }>()).toEqual(
      expect.objectContaining({
        id: cliente.id,
        canalPreferido: 'sms',
      }),
    );
    expect(respuesta.json<{ email?: string }>().email).toBeUndefined();
    expect(respuesta.json<{ telefono?: string }>().telefono).toBeUndefined();
  });

  it('PATCH /api/clientes/:id rechaza un canal inválido o un cuerpo vacío', async () => {
    const crear = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      body: {
        nombre: 'Ana Pérez',
        documento: '12345678',
        email: 'ana@example.com',
        telefono: '3000000000',
        canalPreferido: 'email',
      },
    });
    const cliente = crear.json<{ id: string }>();

    const canalInvalido = await app.inject({
      method: 'PATCH',
      url: `/api/clientes/${cliente.id}`,
      body: { canalPreferido: 'correo' },
    });
    expect(canalInvalido.statusCode).toBe(400);

    const cuerpoVacio = await app.inject({
      method: 'PATCH',
      url: `/api/clientes/${cliente.id}`,
      body: {},
    });
    expect(cuerpoVacio.statusCode).toBe(400);
  });

  it('PATCH /api/clientes/:id devuelve 404 para un cliente inexistente', async () => {
    const respuesta = await app.inject({
      method: 'PATCH',
      url: '/api/clientes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      body: { canalPreferido: 'email' },
    });

    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json<{ error: { code: string } }>().error.code).toBe(
      'CLIENTE_NO_ENCONTRADO',
    );
  });
});
