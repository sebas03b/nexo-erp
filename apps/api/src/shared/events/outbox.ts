// Patrón: Outbox

import type { Kysely } from 'kysely';

import type { Database } from '../db/schema.js';

export interface OutboxEvent<TType extends string = string> {
  id: string;
  correlationId: string;
  tipo: TType;
  payload: object;
  creadoEn: Date;
}

export interface OutboxPendingEvent<TType extends string = string>
  extends OutboxEvent<TType> {
  procesadoEn: Date | null;
}

export interface OutboxWriter {
  save(db: Kysely<Database>, event: OutboxEvent): Promise<void>;
}

export class Outbox implements OutboxWriter {
  async save(db: Kysely<Database>, event: OutboxEvent): Promise<void> {
    await db
      .insertInto('outbox_events')
      .values({
        id: event.id,
        correlation_id: event.correlationId,
        tipo: event.tipo,
        payload: JSON.stringify(event.payload),
        creado_en: event.creadoEn,
        procesado_en: null,
      })
      .execute();
  }

  async marcarProcesado(db: Kysely<Database>, id: string): Promise<boolean> {
    const result = await db
      .updateTable('outbox_events')
      .set({ procesado_en: new Date() })
      .where('id', '=', id)
      .where('procesado_en', 'is', null)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  async pendientes(db: Kysely<Database>, limit = 100): Promise<OutboxPendingEvent[]> {
    const rows = await db
      .selectFrom('outbox_events')
      .selectAll()
      .where('procesado_en', 'is', null)
      .orderBy('creado_en', 'asc')
      .limit(limit)
      .execute();

    return rows.map((row) => ({
      id: row.id,
      correlationId: row.correlation_id,
      tipo: row.tipo,
      payload: row.payload,
      creadoEn: row.creado_en,
      procesadoEn: row.procesado_en,
    }));
  }
}
