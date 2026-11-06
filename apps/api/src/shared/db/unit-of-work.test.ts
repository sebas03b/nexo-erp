import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { Kysely, PGliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryEventBus } from '../events/event-bus.js';
import { Outbox, type OutboxWriter } from '../events/outbox.js';
import { SqlFileMigrationProvider } from './sql-file-migration.provider.js';
import type { Database } from './schema.js';
import { UnitOfWork } from './unit-of-work.js';

type TestEvents = {
  OrdenPagada: { ordenId: string };
};

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../db/migrations', import.meta.url),
);

describe('UnitOfWork con Outbox y Observer', () => {
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
      throw new Error('No se pudieron aplicar las migraciones de prueba', { cause: error });
    }
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.deleteFrom('outbox_events').execute();
  });

  it('entrega el evento a todos los suscriptores solo después del commit', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    const received: string[] = [];

    eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(`inventario:${ordenId}`);
    });
    eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(`contabilidad:${ordenId}`);
    });

    const unitOfWork = new UnitOfWork<TestEvents>(db, eventBus);

    const result = await unitOfWork.execute(async (transaction) => {
      await transaction.publish('OrdenPagada', { ordenId: 'orden-1' });

      expect(received).toEqual([]);

      const pendingEvents = await transaction.db
        .selectFrom('outbox_events')
        .selectAll()
        .execute();

      expect(pendingEvents).toHaveLength(1);
      expect(pendingEvents[0]?.tipo).toBe('OrdenPagada');

      return 'checkout-completado';
    });

    expect(result).toBe('checkout-completado');
    expect(received).toEqual(['inventario:orden-1', 'contabilidad:orden-1']);

    const persistedEvents = await db.selectFrom('outbox_events').selectAll().execute();

    expect(persistedEvents).toHaveLength(1);
    expect(persistedEvents[0]).toMatchObject({
      tipo: 'OrdenPagada',
      payload: { ordenId: 'orden-1' },
      procesado_en: null,
    });
  });

  it('no entrega ni persiste el evento si la transacción hace rollback', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    const received: string[] = [];

    eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(ordenId);
    });

    const unitOfWork = new UnitOfWork<TestEvents>(db, eventBus);

    await expect(
      unitOfWork.execute(async (transaction) => {
        await transaction.publish('OrdenPagada', { ordenId: 'orden-2' });
        throw new Error('fallo en el checkout');
      }),
    ).rejects.toThrow('fallo en el checkout');

    expect(received).toEqual([]);

    const persistedEvents = await db.selectFrom('outbox_events').selectAll().execute();

    expect(persistedEvents).toHaveLength(0);
  });

  it('no hace fallar el commit cuando un suscriptor lanza un error después del commit', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    const received: string[] = [];

    eventBus.subscribe('OrdenPagada', () => {
      throw new Error('fallo del suscriptor de inventario');
    });
    eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(`contabilidad:${ordenId}`);
    });

    const unitOfWork = new UnitOfWork<TestEvents>(db, eventBus);

    const result = await unitOfWork.execute(async (transaction) => {
      await transaction.publish('OrdenPagada', { ordenId: 'orden-3' });

      return 'checkout-completado';
    });

    expect(result).toBe('checkout-completado');
    expect(received).toEqual(['contabilidad:orden-3']);

    const persistedEvents = await db.selectFrom('outbox_events').selectAll().execute();

    expect(persistedEvents).toHaveLength(1);
    expect(persistedEvents[0]).toMatchObject({
      tipo: 'OrdenPagada',
      payload: { ordenId: 'orden-3' },
    });
  });

  it('hace rollback y no despacha si falla el guardado del Outbox', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    const received: string[] = [];

    eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(ordenId);
    });

    const failingOutbox: OutboxWriter = {
      save: () => Promise.reject(new Error('fallo al guardar el evento en el outbox')),
    };

    const unitOfWork = new UnitOfWork<TestEvents>(db, eventBus, failingOutbox);

    await expect(
      unitOfWork.execute(async (transaction) => {
        await transaction.publish('OrdenPagada', { ordenId: 'orden-4' });

        return 'no-deberia-llegar';
      }),
    ).rejects.toThrow('fallo al guardar el evento en el outbox');

    expect(received).toEqual([]);

    const persistedEvents = await db.selectFrom('outbox_events').selectAll().execute();

    expect(persistedEvents).toHaveLength(0);
  });

  it('recibe un correlationId para reintentos idempotentes', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    const correlationId = randomUUID();
    let observedCorrelationId: string | undefined;

    const unitOfWork = new UnitOfWork<TestEvents>(db, eventBus);

    await unitOfWork.execute(
      async (transaction) => {
        observedCorrelationId = transaction.correlationId;
        await transaction.publish('OrdenPagada', { ordenId: 'orden-5' });
      },
      { correlationId },
    );

    expect(observedCorrelationId).toBe(correlationId);

    const [persistedEvent] = await db.selectFrom('outbox_events').selectAll().execute();

    expect(persistedEvent?.correlation_id).toBe(correlationId);
  });

  it('genera un correlationId cuando no se entrega uno', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    let observedCorrelationId: string | undefined;

    const unitOfWork = new UnitOfWork<TestEvents>(db, eventBus);

    await unitOfWork.execute(async (transaction) => {
      observedCorrelationId = transaction.correlationId;
      await transaction.publish('OrdenPagada', { ordenId: 'orden-6' });
    });

    expect(observedCorrelationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const [persistedEvent] = await db.selectFrom('outbox_events').selectAll().execute();

    expect(persistedEvent?.correlation_id).toBe(observedCorrelationId);
  });

  describe('Outbox', () => {
    it('lista los eventos pendientes y los marca como procesados una sola vez', async () => {
      const outbox = new Outbox();
      const id = randomUUID();
      const correlationId = randomUUID();

      await outbox.save(db, {
        id,
        correlationId,
        tipo: 'OrdenPagada',
        payload: { ordenId: 'orden-7' },
        creadoEn: new Date(),
      });

      const pendingEvents = await outbox.pendientes(db);

      expect(pendingEvents).toHaveLength(1);
      expect(pendingEvents[0]).toMatchObject({
        id,
        correlationId,
        tipo: 'OrdenPagada',
        payload: { ordenId: 'orden-7' },
        procesadoEn: null,
      });

      await expect(outbox.marcarProcesado(db, id)).resolves.toBe(true);
      await expect(outbox.marcarProcesado(db, id)).resolves.toBe(false);
      await expect(outbox.pendientes(db)).resolves.toHaveLength(0);
    });
  });
});
