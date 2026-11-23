import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { Kysely, PGliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { Database } from '../../shared/db/schema.js';
import { SqlFileMigrationProvider } from '../../shared/db/sql-file-migration.provider.js';

interface CitaJson {
  id: string;
  clienteId: string;
  empleadoId?: string;
  inicio: string;
  fin: string;
  estado: string;
  notas?: string;
}

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../db/migrations', import.meta.url),
);

describe('Citas API', () => {
  let app: FastifyInstance;
  let db: Kysely<Database>;
  let clienteId: string;

  beforeAll(async () => {
    const pglite = new PGlite();
    db = new Kysely<Database>({ dialect: new PGliteDialect({ pglite }) });
    const migrator = new Migrator({
      db,
      provider: new SqlFileMigrationProvider(MIGRATIONS_DIRECTORY),
    });
    const { error } = await migrator.migrateToLatest();
    if (error) throw new Error('No se pudieron aplicar migraciones', { cause: error });
    app = await buildApp({ db });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  beforeEach(async () => {
    await db.deleteFrom('outbox_events').execute();
    await db.deleteFrom('citas').execute();
    await db.deleteFrom('clientes').execute();

    const cliente = await db
      .insertInto('clientes')
      .values({
        nombre: 'Cliente Cita',
        documento: `DOC-${randomUUID()}`,
        email: 'cita@example.com',
        telefono: null,
        canal_preferido: 'email',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    clienteId = cliente.id;
  });

  async function crearCita(overrides: Partial<Record<string, unknown>> = {}) {
    const payload = {
      clienteId,
      inicio: '2026-05-01T10:00:00.000Z',
      fin: '2026-05-01T11:00:00.000Z',
      ...overrides,
    };
    return app.inject({ method: 'POST', url: '/api/citas', payload });
  }

  it('crea cita válida → 201, estado Pendiente', async () => {
    const res = await crearCita();
    expect(res.statusCode).toBe(201);
    expect(res.json<CitaJson>()).toMatchObject({ clienteId, estado: 'Pendiente' });
  });

  it('fin <= inicio → 400 RANGO_INVALIDO', async () => {
    const res = await crearCita({
      inicio: '2026-05-01T11:00:00.000Z',
      fin: '2026-05-01T10:00:00.000Z',
    });
    expect(res.statusCode).toBe(400);
  });

  it('cliente inexistente → 404 CLIENTE_NO_ENCONTRADO', async () => {
    const res = await crearCita({ clienteId: randomUUID() });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'CLIENTE_NO_ENCONTRADO' } });
  });

  it('solapamiento mismo empleado → 409 HORARIO_OCUPADO', async () => {
    const first = await crearCita({ empleadoId: 'emp-1' });
    expect(first.statusCode).toBe(201);

    const second = await crearCita({
      inicio: '2026-05-01T10:30:00.000Z',
      fin: '2026-05-01T11:30:00.000Z',
      empleadoId: 'emp-1',
    });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: { code: 'HORARIO_OCUPADO' } });
  });

  it('solape distinto empleado → 201', async () => {
    const first = await crearCita({ empleadoId: 'emp-1' });
    expect(first.statusCode).toBe(201);

    const second = await crearCita({ empleadoId: 'emp-2' });
    expect(second.statusCode).toBe(201);
  });

  it('confirmar → 200, estado Confirmada y outbox CitaConfirmada', async () => {
    const creada = (await crearCita()).json<CitaJson>();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/citas/${creada.id}/estado`,
      payload: { accion: 'confirmar' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<CitaJson>().estado).toBe('Confirmada');

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    expect(eventos.filter((e) => e.tipo === 'CitaConfirmada')).toHaveLength(1);
  });

  it('iniciar → En Proceso, sin nueva fila en outbox', async () => {
    const creada = (await crearCita()).json<CitaJson>();
    await app.inject({
      method: 'PATCH',
      url: `/api/citas/${creada.id}/estado`,
      payload: { accion: 'confirmar' },
    });
    const antes = await db.selectFrom('outbox_events').selectAll().execute();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/citas/${creada.id}/estado`,
      payload: { accion: 'iniciar' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<CitaJson>().estado).toBe('En Proceso');

    const despues = await db.selectFrom('outbox_events').selectAll().execute();
    expect(despues.length).toBe(antes.length);
  });

  it('completar → Completada', async () => {
    const creada = (await crearCita()).json<CitaJson>();
    await app.inject({ method: 'PATCH', url: `/api/citas/${creada.id}/estado`, payload: { accion: 'confirmar' } });
    await app.inject({ method: 'PATCH', url: `/api/citas/${creada.id}/estado`, payload: { accion: 'iniciar' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/citas/${creada.id}/estado`,
      payload: { accion: 'completar' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<CitaJson>().estado).toBe('Completada');
  });

  it('cancelar desde Pendiente → Cancelada', async () => {
    const creada = (await crearCita()).json<CitaJson>();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/citas/${creada.id}/estado`,
      payload: { accion: 'cancelar' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<CitaJson>().estado).toBe('Cancelada');
  });

  it('completar desde Cancelada → 409 TRANSICION_INVALIDA con mensaje exacto', async () => {
    const creada = (await crearCita()).json<CitaJson>();
    await app.inject({
      method: 'PATCH',
      url: `/api/citas/${creada.id}/estado`,
      payload: { accion: 'cancelar' },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/citas/${creada.id}/estado`,
      payload: { accion: 'completar' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      error: {
        code: 'TRANSICION_INVALIDA',
        message: 'Transición de cita inválida: Cancelada → Completada',
      },
    });
  });

  it('crear cita con empleado null y solape otra sin empleado → 409', async () => {
    const first = await crearCita({ empleadoId: undefined });
    expect(first.statusCode).toBe(201);

    const second = await crearCita({
      inicio: '2026-05-01T10:30:00.000Z',
      fin: '2026-05-01T11:30:00.000Z',
    });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: { code: 'HORARIO_OCUPADO' } });
  });
});
