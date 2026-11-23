import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { Kysely, PGliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import { SqlFileMigrationProvider } from '../../shared/db/sql-file-migration.provider.js';
import type { Database } from '../../shared/db/schema.js';
import { UnitOfWork } from '../../shared/db/unit-of-work.js';
import { InMemoryEventBus } from '../../shared/events/event-bus.js';
import type { AppEventMap } from '../../shared/events/event-map.js';
import { NotificacionFactory } from './notificacion.factory.js';
import { registrarSuscriptoresNotificaciones } from './notificaciones.suscriptores.js';
import { NotificacionesService } from './notificaciones.service.js';
import type { ConsultorContactos } from './ports.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../db/migrations', import.meta.url),
);

const CITA_CONFIRMADA: AppEventMap['CitaConfirmada'] = {
  citaId: 'cita-1',
  clienteId: 'cliente-1',
  empleadoId: 'empleado-1',
  empleadoNombre: 'Laura Pérez',
  motivo: 'Corte y color',
  inicio: '2026-11-25T15:00:00.000Z',
  fin: '2026-11-25T16:00:00.000Z',
  confirmadaEn: '2026-11-20T12:00:00.000Z',
};

const PEDIDO_PAGADO: AppEventMap['PedidoPagado'] = {
  pedidoId: 'pedido-1',
  clienteId: 'cliente-1',
  total: 200,
  pagadoEn: '2026-11-20T12:00:00.000Z',
  metodoPago: 'efectivo',
  referenciaPago: 'PAGO-1',
};

describe('Observer de Notificaciones', () => {
  let db: Kysely<Database>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const lineas: string[] = [];

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

    app = await buildApp({
      db,
      notificacionSalida: (linea) => lineas.push(linea),
    });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  beforeEach(async () => {
    lineas.length = 0;
    await db.deleteFrom('citas').execute();
    await db.deleteFrom('empleados').execute();
    await db.deleteFrom('clientes').execute();
    await db.deleteFrom('outbox_events').execute();
  });

  function crearServicio(): NotificacionesService {
    const contactos: ConsultorContactos = {
      obtenerContacto: () =>
        Promise.resolve({
          nombre: 'Ana González',
          email: 'ana@email.com',
          telefono: '3001112233',
          canalPreferido: 'email',
        }),
    };

    return new NotificacionesService(
      new NotificacionFactory((linea) => lineas.push(linea)),
      contactos,
    );
  }

  it('registra y deja de observar CitaConfirmada y PedidoPagado', async () => {
    const bus = new InMemoryEventBus<AppEventMap>();
    const cancelar = registrarSuscriptoresNotificaciones(bus, crearServicio());

    await bus.publish('CitaConfirmada', CITA_CONFIRMADA);
    await bus.publish('PedidoPagado', PEDIDO_PAGADO);

    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toContain('[Email]');
    expect(lineas[1]).toContain('Pago recibido por el pedido pedido-1');

    cancelar();
    await bus.publish('CitaConfirmada', CITA_CONFIRMADA);
    expect(lineas).toHaveLength(2);
  });

  it('entrega el evento solo después del commit', async () => {
    const bus = new InMemoryEventBus<AppEventMap>();
    registrarSuscriptoresNotificaciones(bus, crearServicio());
    const unitOfWork = new UnitOfWork<AppEventMap>(db, bus);

    await unitOfWork.execute(async (context) => {
      await context.publish('CitaConfirmada', CITA_CONFIRMADA);
      expect(lineas).toEqual([]);
    });

    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toContain('Cita confirmada');

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.tipo).toBe('CitaConfirmada');
  });

  it('no entrega ni persiste el evento si la transacción hace rollback', async () => {
    const bus = new InMemoryEventBus<AppEventMap>();
    registrarSuscriptoresNotificaciones(bus, crearServicio());
    const unitOfWork = new UnitOfWork<AppEventMap>(db, bus);

    await expect(
      unitOfWork.execute(async (context) => {
        await context.publish('CitaConfirmada', CITA_CONFIRMADA);
        throw new Error('fallo de la transición');
      }),
    ).rejects.toThrow('fallo de la transición');

    expect(lineas).toEqual([]);
    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    expect(eventos).toHaveLength(0);
  });

  it('notifica por Email y usa WhatsApp tras cambiar la preferencia', async () => {
    const cliente = await db
      .insertInto('clientes')
      .values({
        nombre: 'Ana González',
        documento: '12345678',
        email: 'ana@email.com',
        telefono: '3001112233',
        canal_preferido: 'email',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const empleado = await db
      .insertInto('empleados')
      .values({
        nombre: 'Laura Pérez',
        email: null,
        telefono: null,
        activo: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const primera = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId: cliente.id,
        empleadoId: empleado.id,
        inicio: '2026-11-25T15:00:00.000Z',
        fin: '2026-11-25T16:00:00.000Z',
        motivo: 'Corte y color',
      },
    });
    expect(primera.statusCode).toBe(201);
    const primeraCita = primera.json<{ id: string }>();

    const confirmacion = await app.inject({
      method: 'POST',
      url: `/api/citas/${primeraCita.id}/confirmar`,
    });
    expect(confirmacion.statusCode).toBe(200);
    expect(lineas[0]).toContain('[Email][ana@email.com]');

    await db
      .updateTable('clientes')
      .set({ canal_preferido: 'whatsapp' })
      .where('id', '=', cliente.id)
      .execute();

    const segunda = await app.inject({
      method: 'POST',
      url: '/api/citas',
      payload: {
        clienteId: cliente.id,
        empleadoId: empleado.id,
        inicio: '2026-11-25T17:00:00.000Z',
        fin: '2026-11-25T18:00:00.000Z',
        motivo: 'Coloración',
      },
    });
    expect(segunda.statusCode).toBe(201);
    const segundaCita = segunda.json<{ id: string }>();

    const segundaConfirmacion = await app.inject({
      method: 'POST',
      url: `/api/citas/${segundaCita.id}/confirmar`,
    });
    expect(segundaConfirmacion.statusCode).toBe(200);
    expect(lineas[1]).toContain('[WhatsApp][3001112233]');
  });
});
