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
import type { EstadoCita } from './domain/cita-estado.js';

interface CitaJson {
  id: string;
  clienteId: string;
  clienteNombre: string;
  empleadoId: string;
  empleadoNombre: string;
  inicio: string;
  fin: string;
  estado: EstadoCita;
  motivo: string | null;
}

interface CrearCitaPayload {
  clienteId: string;
  empleadoId: string;
  inicio: string;
  fin: string;
  motivo?: string;
}

interface ErrorJson {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../db/migrations', import.meta.url),
);

const INICIO = '2026-11-25T15:00:00.000Z';
const FIN = '2026-11-25T16:00:00.000Z';

describe('API de Citas', () => {
  let app: FastifyInstance;
  let db: Kysely<Database>;
  let clienteId: string;
  let empleadoActivoId: string;
  let empleadoInactivoId: string;

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

    const cliente = await db
      .insertInto('clientes')
      .values({
        nombre: 'Ana González',
        documento: '12345678',
        email: 'ana@example.com',
        telefono: '3001112233',
        canal_preferido: 'email',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const empleadoActivo = await db
      .insertInto('empleados')
      .values({
        nombre: 'Laura Pérez',
        email: 'laura@example.com',
        telefono: '3002223344',
        activo: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const empleadoInactivo = await db
      .insertInto('empleados')
      .values({
        nombre: 'Carlos Ruiz',
        email: null,
        telefono: null,
        activo: false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    clienteId = cliente.id;
    empleadoActivoId = empleadoActivo.id;
    empleadoInactivoId = empleadoInactivo.id;
  });

  async function crearCita(
    cambios: Partial<CrearCitaPayload> = {},
  ): Promise<CitaJson> {
    const payload: CrearCitaPayload = {
      clienteId,
      empleadoId: empleadoActivoId,
      inicio: INICIO,
      fin: FIN,
      motivo: 'Corte y color',
      ...cambios,
    };

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload,
    });

    expect(respuesta.statusCode).toBe(201);
    return respuesta.json<CitaJson>();
  }

  it('crea una cita y permite consultarla por identificador', async () => {
    const cita = await crearCita();

    expect(cita).toMatchObject({
      clienteId,
      clienteNombre: 'Ana González',
      empleadoId: empleadoActivoId,
      empleadoNombre: 'Laura Pérez',
      inicio: INICIO,
      fin: FIN,
      estado: 'Pendiente',
      motivo: 'Corte y color',
    });

    const consulta = await app.inject({
      method: 'GET',
      url: `/api/citas/${cita.id}`,
    });

    expect(consulta.statusCode).toBe(200);
    expect(consulta.json<CitaJson>()).toEqual(cita);
  });

  it('normaliza un motivo vacío a null', async () => {
    const cita = await crearCita({ motivo: '   ' });

    expect(cita.motivo).toBeNull();
  });

  it('lista el catálogo de empleados con sus datos de contacto', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/empleados',
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual(
      expect.arrayContaining([
        {
          id: empleadoActivoId,
          nombre: 'Laura Pérez',
          email: 'laura@example.com',
          telefono: '3002223344',
          activo: true,
        },
        {
          id: empleadoInactivoId,
          nombre: 'Carlos Ruiz',
          email: null,
          telefono: null,
          activo: false,
        },
      ]),
    );
  });

  it('lista la agenda y filtra por solapamiento temporal y estado', async () => {
    const primera = await crearCita();
    const segunda = await crearCita({
      inicio: '2026-11-25T17:00:00.000Z',
      fin: '2026-11-25T18:00:00.000Z',
      motivo: 'Coloración',
    });

    const confirmacion = await app.inject({
      method: 'POST',
      url: `/api/citas/${segunda.id}/confirmar`,
    });
    expect(confirmacion.statusCode).toBe(200);
    const segundaConfirmada = confirmacion.json<CitaJson>();

    const listado = await app.inject({
      method: 'GET',
      url: '/api/citas',
    });
    expect(listado.statusCode).toBe(200);
    expect(listado.json<CitaJson[]>()).toEqual([primera, segundaConfirmada]);

    const consulta = new URLSearchParams({
      desde: '2026-11-25T16:00:00.000Z',
      hasta: '2026-11-25T18:00:00.000Z',
    });
    const filtradoPorRango = await app.inject({
      method: 'GET',
      url: `/api/citas?${consulta.toString()}`,
    });
    expect(filtradoPorRango.statusCode).toBe(200);
    expect(filtradoPorRango.json<CitaJson[]>()).toEqual([segundaConfirmada]);

    const filtradoPorEstado = await app.inject({
      method: 'GET',
      url: '/api/citas?estado=Confirmada',
    });
    expect(filtradoPorEstado.statusCode).toBe(200);
    expect(filtradoPorEstado.json<CitaJson[]>()).toEqual([segundaConfirmada]);
  });

  it('rechaza filtros de estado o fecha inválidos', async () => {
    const estadoInvalido = await app.inject({
      method: 'GET',
      url: '/api/citas?estado=Inventado',
    });
    expect(estadoInvalido.statusCode).toBe(400);

    const fechaInvalida = await app.inject({
      method: 'GET',
      url: '/api/citas?desde=fecha-invalida',
    });
    expect(fechaInvalida.statusCode).toBe(400);
    expect(fechaInvalida.json<ErrorJson>().error.code).toBe(
      'CITA_FECHAS_INVALIDAS',
    );
  });

  it('confirma, inicia y completa una cita mediante el State', async () => {
    const cita = await crearCita();

    const confirmacion = await app.inject({
      method: 'POST',
      url: `/api/citas/${cita.id}/confirmar`,
    });
    expect(confirmacion.statusCode).toBe(200);
    expect(confirmacion.json<CitaJson>().estado).toBe('Confirmada');

    const inicio = await app.inject({
      method: 'POST',
      url: `/api/citas/${cita.id}/iniciar`,
    });
    expect(inicio.statusCode).toBe(200);
    expect(inicio.json<CitaJson>().estado).toBe('En Proceso');

    const completacion = await app.inject({
      method: 'POST',
      url: `/api/citas/${cita.id}/completar`,
    });
    expect(completacion.statusCode).toBe(200);
    expect(completacion.json<CitaJson>().estado).toBe('Completada');
  });

  it('publica CitaConfirmada solo al confirmar', async () => {
    const confirmada = await crearCita();
    const cancelada = await crearCita({
      inicio: '2026-11-25T17:00:00.000Z',
      fin: '2026-11-25T18:00:00.000Z',
    });

    for (const transicion of ['confirmar', 'iniciar', 'completar']) {
      const respuesta = await app.inject({
        method: 'POST',
        url: `/api/citas/${confirmada.id}/${transicion}`,
      });
      expect(respuesta.statusCode).toBe(200);
    }

    const cancelacion = await app.inject({
      method: 'POST',
      url: `/api/citas/${cancelada.id}/cancelar`,
    });
    expect(cancelacion.statusCode).toBe(200);

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.tipo).toBe('CitaConfirmada');
  });

  it('rechaza una transición ilegal, conserva el estado y no publica eventos', async () => {
    const cita = await crearCita();

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/citas/${cita.id}/iniciar`,
    });

    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json<ErrorJson>().error.code).toBe(
      'TRANSICION_CITA_INVALIDA',
    );

    const persistida = await db
      .selectFrom('citas')
      .select('estado')
      .where('id', '=', cita.id)
      .executeTakeFirstOrThrow();
    expect(persistida.estado).toBe('Pendiente');

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    expect(eventos).toHaveLength(0);
  });

  it('acepta citas consecutivas y rechaza horarios solapados', async () => {
    await crearCita();

    const consecutiva = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: empleadoActivoId,
        inicio: FIN,
        fin: '2026-11-25T17:00:00.000Z',
        motivo: 'Cita consecutiva',
      },
    });
    expect(consecutiva.statusCode).toBe(201);

    const solapada = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: empleadoActivoId,
        inicio: '2026-11-25T15:30:00.000Z',
        fin: '2026-11-25T16:30:00.000Z',
        motivo: 'Cita solapada',
      },
    });

    expect(solapada.statusCode).toBe(409);
    expect(solapada.json<ErrorJson>().error.code).toBe('CITA_SOLAPADA');
  });

  it('cancela una cita y permite reutilizar su horario', async () => {
    const cita = await crearCita();

    const cancelacion = await app.inject({
      method: 'POST',
      url: `/api/citas/${cita.id}/cancelar`,
    });
    expect(cancelacion.statusCode).toBe(200);
    expect(cancelacion.json<CitaJson>().estado).toBe('Cancelada');

    const reutilizacion = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: empleadoActivoId,
        inicio: INICIO,
        fin: FIN,
        motivo: 'Cita reutilizada',
      },
    });

    expect(reutilizacion.statusCode).toBe(201);
  });

  it('acepta ISO con offset y rechaza datetime sin zona horaria', async () => {
    const conOffset = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: empleadoActivoId,
        inicio: '2026-11-25T10:00:00-05:00',
        fin: '2026-11-25T11:00:00-05:00',
      },
    });

    expect(conOffset.statusCode).toBe(201);
    expect(conOffset.json<CitaJson>().inicio).toBe('2026-11-25T15:00:00.000Z');

    const sinZona = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: empleadoActivoId,
        inicio: '2026-11-25T17:00:00',
        fin: '2026-11-25T18:00:00',
      },
    });

    expect(sinZona.statusCode).toBe(400);
    expect(sinZona.json<ErrorJson>().error.code).toBe('CITA_FECHAS_INVALIDAS');
  });

  it('rechaza fechas inválidas o un intervalo no positivo con 400', async () => {
    const invalida = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: empleadoActivoId,
        inicio: 'fecha-invalida',
        fin: FIN,
      },
    });
    expect(invalida.statusCode).toBe(400);
    expect(invalida.json<ErrorJson>().error.code).toBe('CITA_FECHAS_INVALIDAS');

    const intervaloInvalido = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: empleadoActivoId,
        inicio: FIN,
        fin: INICIO,
      },
    });
    expect(intervaloInvalido.statusCode).toBe(400);
    expect(intervaloInvalido.json<ErrorJson>().error.code).toBe(
      'CITA_FECHAS_INVALIDAS',
    );

    const intervaloVacio = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: empleadoActivoId,
        inicio: INICIO,
        fin: INICIO,
      },
    });
    expect(intervaloVacio.statusCode).toBe(400);
    expect(intervaloVacio.json<ErrorJson>().error.code).toBe(
      'CITA_FECHAS_INVALIDAS',
    );

    const fechaInexistente = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: empleadoActivoId,
        inicio: '2026-02-30T15:00:00.000Z',
        fin: FIN,
      },
    });
    expect(fechaInexistente.statusCode).toBe(400);
    expect(fechaInexistente.json<ErrorJson>().error.code).toBe(
      'CITA_FECHAS_INVALIDAS',
    );
  });

  it('devuelve 404 cuando el cliente no existe', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId: randomUUID(),
        empleadoId: empleadoActivoId,
        inicio: INICIO,
        fin: FIN,
      },
    });

    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json<ErrorJson>().error.code).toBe('CLIENTE_NO_ENCONTRADO');
  });

  it('devuelve 404 cuando el empleado no existe', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: randomUUID(),
        inicio: INICIO,
        fin: FIN,
      },
    });

    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json<ErrorJson>().error.code).toBe('EMPLEADO_NO_ENCONTRADO');
  });

  it('rechaza con 409 agendar con un empleado inactivo', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId,
        empleadoId: empleadoInactivoId,
        inicio: INICIO,
        fin: FIN,
      },
    });

    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json<ErrorJson>().error.code).toBe('EMPLEADO_INACTIVO');
  });

  it('devuelve 404 al consultar una cita inexistente', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/citas/${randomUUID()}`,
    });

    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json<ErrorJson>().error.code).toBe('CITA_NO_ENCONTRADA');
  });

  it('persiste CitaConfirmada en el Outbox al confirmar', async () => {
    const cita = await crearCita();

    const confirmacion = await app.inject({
      method: 'POST',
      url: `/api/citas/${cita.id}/confirmar`,
    });
    expect(confirmacion.statusCode).toBe(200);

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      tipo: 'CitaConfirmada',
      procesado_en: null,
      payload: {
        citaId: cita.id,
        clienteId,
        empleadoId: empleadoActivoId,
        empleadoNombre: 'Laura Pérez',
        motivo: 'Corte y color',
        inicio: INICIO,
        fin: FIN,
      },
    });
  });

  it('serializa dos creaciones concurrentes del mismo horario', async () => {
    const payload: CrearCitaPayload = {
      clienteId,
      empleadoId: empleadoActivoId,
      inicio: INICIO,
      fin: FIN,
      motivo: 'Cita concurrente',
    };

    const respuestas = await Promise.all([
      app.inject({ method: 'POST', url: '/api/citas', payload }),
      app.inject({ method: 'POST', url: '/api/citas', payload }),
    ]);

    expect(respuestas.map((respuesta) => respuesta.statusCode).sort()).toEqual([
      201, 409,
    ]);

    const rechazada = respuestas.find((respuesta) => respuesta.statusCode === 409);
    expect(rechazada?.json<ErrorJson>().error.code).toBe('CITA_SOLAPADA');

    const citas = await db.selectFrom('citas').selectAll().execute();
    expect(citas).toHaveLength(1);
  });

  it('protege una confirmación concurrente y publica un solo evento', async () => {
    const cita = await crearCita();

    const respuestas = await Promise.all([
      app.inject({ method: 'POST', url: `/api/citas/${cita.id}/confirmar` }),
      app.inject({ method: 'POST', url: `/api/citas/${cita.id}/confirmar` }),
    ]);

    expect(respuestas.map((respuesta) => respuesta.statusCode).sort()).toEqual([
      200, 409,
    ]);

    const persistida = await db
      .selectFrom('citas')
      .select('estado')
      .where('id', '=', cita.id)
      .executeTakeFirstOrThrow();
    expect(persistida.estado).toBe('Confirmada');

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.tipo).toBe('CitaConfirmada');
  });
});
