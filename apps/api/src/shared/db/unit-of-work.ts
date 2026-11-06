// Patrón: Unit of Work

import { randomUUID } from 'node:crypto';

import type { Kysely, Transaction } from 'kysely';

import type {
  EventDispatchResult,
  EventMap,
  EventPublisher,
} from '../events/event-bus.js';
import { Outbox, type OutboxEvent, type OutboxWriter } from '../events/outbox.js';
import type { Database } from './schema.js';

export interface UnitOfWorkOptions {
  /**
   * Identificador de correlación del caso de uso. Debe reutilizarse en los
   * reintentos para que los consumidores puedan deduplicar efectos.
   */
  correlationId?: string;
}

export interface UnitOfWorkContext<TEvents extends EventMap> {
  readonly db: Transaction<Database>;
  readonly correlationId: string;
  publish<K extends keyof TEvents & string>(tipo: K, payload: TEvents[K]): Promise<void>;
}

export class UnitOfWork<TEvents extends EventMap> {
  readonly #db: Kysely<Database>;
  readonly #eventPublisher: EventPublisher<TEvents>;
  readonly #outbox: OutboxWriter;

  constructor(
    db: Kysely<Database>,
    eventPublisher: EventPublisher<TEvents>,
    outbox: OutboxWriter = new Outbox(),
  ) {
    this.#db = db;
    this.#eventPublisher = eventPublisher;
    this.#outbox = outbox;
  }

  async execute<TResult>(
    work: (context: UnitOfWorkContext<TEvents>) => Promise<TResult>,
    options: UnitOfWorkOptions = {},
  ): Promise<TResult> {
    // El id de correlación se resuelve antes de abrir la transacción para
    // que un reintento con el mismo id sea tratado como la misma operación.
    const correlationId = options.correlationId ?? randomUUID();
    const pendingDispatches: Array<() => Promise<EventDispatchResult>> = [];

    const result = await this.#db.transaction().execute(async (transaction) => {
      const context: UnitOfWorkContext<TEvents> = {
        db: transaction,
        correlationId,
        publish: async (tipo, payload) => {
          const event: OutboxEvent<typeof tipo> = {
            id: randomUUID(),
            correlationId,
            tipo,
            payload,
            creadoEn: new Date(),
          };

          await this.#outbox.save(transaction, event);
          pendingDispatches.push(() => this.#eventPublisher.publish(tipo, payload));
        },
      };

      return work(context);
    });

    // Los errores de los suscriptores se recolectan dentro de publish y nunca
    // revierten un commit ya confirmado ni impiden entregar al resto.
    await Promise.allSettled(pendingDispatches.map((dispatch) => dispatch()));

    return result;
  }
}
