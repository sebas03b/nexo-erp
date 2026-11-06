import { describe, expect, it } from 'vitest';

import { InMemoryEventBus } from './event-bus.js';

type TestEvents = {
  OrdenPagada: { ordenId: string };
  ClienteCreado: { clienteId: string };
};

describe('InMemoryEventBus', () => {
  it('notifica a todos los suscriptores del mismo evento', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    const received: string[] = [];

    eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(`inventario:${ordenId}`);
    });
    eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(`contabilidad:${ordenId}`);
    });

    const result = await eventBus.publish('OrdenPagada', { ordenId: 'orden-1' });

    expect(received).toEqual(['inventario:orden-1', 'contabilidad:orden-1']);
    expect(result).toEqual({ delivered: 2, failures: [] });
  });

  it('deja de notificar a un suscriptor cuando cancela su suscripción', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    const received: string[] = [];

    const unsubscribe = eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(ordenId);
    });

    await eventBus.publish('OrdenPagada', { ordenId: 'orden-1' });
    unsubscribe();
    await eventBus.publish('OrdenPagada', { ordenId: 'orden-2' });

    expect(received).toEqual(['orden-1']);
  });

  it('solo notifica a los suscriptores del tipo de evento publicado', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    const received: string[] = [];

    eventBus.subscribe('ClienteCreado', ({ clienteId }) => {
      received.push(`cliente:${clienteId}`);
    });

    await eventBus.publish('OrdenPagada', { ordenId: 'orden-1' });

    expect(received).toEqual([]);
  });

  it('aísla el error de un suscriptor y sigue notificando a los demás', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    const received: string[] = [];

    eventBus.subscribe('OrdenPagada', () => {
      throw new Error('fallo de inventario');
    });
    eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(`contabilidad:${ordenId}`);
    });

    const result = await eventBus.publish('OrdenPagada', { ordenId: 'orden-1' });

    expect(received).toEqual(['contabilidad:orden-1']);
    expect(result.delivered).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.error).toBeInstanceOf(Error);
  });

  it('itera sobre un snapshot de los handlers durante la publicación', async () => {
    const eventBus = new InMemoryEventBus<TestEvents>();
    const received: string[] = [];

    const unsubscribeSegundo = eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(`segundo:${ordenId}`);
    });
    eventBus.subscribe('OrdenPagada', ({ ordenId }) => {
      received.push(`primero:${ordenId}`);
      unsubscribeSegundo();
      eventBus.subscribe('OrdenPagada', (payload) => {
        received.push(`tardio:${payload.ordenId}`);
      });
    });

    await eventBus.publish('OrdenPagada', { ordenId: 'orden-1' });

    expect(received).toEqual(['segundo:orden-1', 'primero:orden-1']);
  });
});
