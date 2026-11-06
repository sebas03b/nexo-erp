// Patrón: Observer

export type EventMap = Record<string, object>;

export type EventHandler<TPayload extends object> = (
  payload: TPayload,
) => void | Promise<void>;

export interface EventDispatchFailure {
  readonly error: unknown;
}

export interface EventDispatchResult {
  readonly delivered: number;
  readonly failures: readonly EventDispatchFailure[];
}

/**
 * Vista pública del bus. Los módulos de dominio solo deben recibir esta
 * interfaz para suscribirse, nunca la capacidad de publicar.
 */
export interface EventSubscriber<TEvents extends EventMap> {
  subscribe<K extends keyof TEvents & string>(
    eventType: K,
    handler: EventHandler<TEvents[K]>,
  ): () => void;
}

/**
 * Vista transaccional del bus. Solo el UnitOfWork debe recibir esta interfaz:
 * publicar eventos de dominio fuera de una transacción está prohibido.
 */
export interface EventPublisher<TEvents extends EventMap> {
  publish<K extends keyof TEvents & string>(
    eventType: K,
    payload: TEvents[K],
  ): Promise<EventDispatchResult>;
}

export interface EventBus<TEvents extends EventMap>
  extends EventSubscriber<TEvents>, EventPublisher<TEvents> {}

export class InMemoryEventBus<TEvents extends EventMap> implements EventBus<TEvents> {
  readonly #handlers = new Map<string, Set<EventHandler<object>>>();

  subscribe<K extends keyof TEvents & string>(
    eventType: K,
    handler: EventHandler<TEvents[K]>,
  ): () => void {
    const erasedHandler: EventHandler<object> = async (payload) => {
      await handler(payload as TEvents[K]);
    };

    const handlers = this.#handlers.get(eventType) ?? new Set<EventHandler<object>>();
    handlers.add(erasedHandler);
    this.#handlers.set(eventType, handlers);

    return () => {
      handlers.delete(erasedHandler);

      if (handlers.size === 0) {
        this.#handlers.delete(eventType);
      }
    };
  }

  async publish<K extends keyof TEvents & string>(
    eventType: K,
    payload: TEvents[K],
  ): Promise<EventDispatchResult> {
    const handlers = this.#handlers.get(eventType);

    if (!handlers) {
      return { delivered: 0, failures: [] };
    }

    // Snapshot: las altas y bajas ocurridas durante la entrega no alteran
    // la lista de suscriptores de esta publicación.
    const snapshot = [...handlers];
    const results = await Promise.allSettled(
      snapshot.map(async (handler) => {
        await handler(payload);
      }),
    );

    let delivered = 0;
    const failures: EventDispatchFailure[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        delivered += 1;
      } else {
        failures.push({ error: result.reason as unknown });
      }
    }

    return { delivered, failures };
  }
}
