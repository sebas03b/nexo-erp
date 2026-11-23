import { describe, expect, it, vi } from 'vitest';

import { InMemoryEventBus } from '../../shared/events/event-bus.js';
import type { AppEventMap } from '../../shared/events/app-event-map.js';
import { NotificacionFactory } from './notificacion.factory.js';
import { ServicioNotificaciones } from './servicio-notificaciones.js';
import { registrarSuscripcionesNotificaciones } from './suscripciones.js';

describe('Suscripciones de notificaciones (Observer)', () => {
  it('publicar CitaConfirmada con cliente email envía [Email]', async () => {
    const bus = new InMemoryEventBus<AppEventMap>();
    const servicio = new ServicioNotificaciones(new NotificacionFactory(), async () => ({
      nombre: 'Ana',
      canalPreferido: 'email',
    }));
    registrarSuscripcionesNotificaciones(bus, servicio);

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await bus.publish('CitaConfirmada', {
      citaId: 'c1',
      clienteId: 'cli-1',
      inicio: '2026-05-01T10:00:00.000Z',
      fin: '2026-05-01T11:00:00.000Z',
      confirmadaEn: '2026-05-01T09:00:00.000Z',
    });

    expect(log).toHaveBeenCalledWith(expect.stringContaining('[Email]'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('cita c1'));
    log.mockRestore();
  });

  it('cambia a whatsapp según canal del destinatario sin tocar suscriptor', async () => {
    const bus = new InMemoryEventBus<AppEventMap>();
    let canal: 'email' | 'sms' | 'whatsapp' = 'email';
    const servicio = new ServicioNotificaciones(new NotificacionFactory(), async () => ({
      nombre: 'Ana',
      canalPreferido: canal,
    }));
    registrarSuscripcionesNotificaciones(bus, servicio);

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    canal = 'whatsapp';
    await bus.publish('CitaConfirmada', {
      citaId: 'c2',
      clienteId: 'cli-1',
      inicio: '2026-05-01T10:00:00.000Z',
      fin: '2026-05-01T11:00:00.000Z',
      confirmadaEn: '2026-05-01T09:00:00.000Z',
    });

    expect(log).toHaveBeenCalledWith(expect.stringContaining('[WhatsApp]'));
    log.mockRestore();
  });

  it('publicar PedidoPagado envía comprobante', async () => {
    const bus = new InMemoryEventBus<AppEventMap>();
    const servicio = new ServicioNotificaciones(new NotificacionFactory(), async () => ({
      nombre: 'Ana',
      canalPreferido: 'sms',
    }));
    registrarSuscripcionesNotificaciones(bus, servicio);

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await bus.publish('PedidoPagado', {
      pedidoId: 'p1',
      clienteId: 'cli-1',
      total: 100,
      pagadoEn: '2026-05-01T10:00:00.000Z',
      metodoPago: 'efectivo',
      referenciaPago: 'ref',
    });

    expect(log).toHaveBeenCalledWith(expect.stringContaining('[SMS]'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('pedido p1'));
    log.mockRestore();
  });

  it('cliente inexistente no envía ni lanza', async () => {
    const bus = new InMemoryEventBus<AppEventMap>();
    const servicio = new ServicioNotificaciones(new NotificacionFactory(), async () => null);
    registrarSuscripcionesNotificaciones(bus, servicio);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      bus.publish('CitaConfirmada', {
        citaId: 'c1',
        clienteId: 'missing',
        inicio: '2026-05-01T10:00:00.000Z',
        fin: '2026-05-01T11:00:00.000Z',
        confirmadaEn: '2026-05-01T09:00:00.000Z',
      }),
    ).resolves.toBeDefined();

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('un handler que lanza no impide el otro', async () => {
    const bus = new InMemoryEventBus<AppEventMap>();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    bus.subscribe('CitaConfirmada', async () => {
      throw new Error('boom');
    });
    bus.subscribe('CitaConfirmada', async () => {
      console.log('ok');
    });

    const result = await bus.publish('CitaConfirmada', {
      citaId: 'c1',
      clienteId: 'cli-1',
      inicio: '2026-05-01T10:00:00.000Z',
      fin: '2026-05-01T11:00:00.000Z',
      confirmadaEn: '2026-05-01T09:00:00.000Z',
    });

    expect(result.delivered).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(log).toHaveBeenCalledWith('ok');
    log.mockRestore();
  });
});
