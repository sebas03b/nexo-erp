// Patrón: Observer

import type { AppEventMap } from '../../shared/events/event-map.js';
import type { EventSubscriber } from '../../shared/events/event-bus.js';
import type { ContabilidadService } from './contabilidad.service.js';

export function registrarSuscripcionesContabilidad(
  bus: EventSubscriber<AppEventMap>,
  servicio: ContabilidadService,
): void {
  bus.subscribe('PedidoPagado', async (evento) => {
    await servicio.registrarVenta({
      pedidoId: evento.pedidoId,
      total: evento.total,
      metodoPago: evento.metodoPago,
      fecha: evento.pagadoEn,
      items: evento.items ?? [],
    });
  });
}
