// Patrón: Observer

import type { AppEventMap } from '../../shared/events/event-map.js';
import type { EventSubscriber } from '../../shared/events/event-bus.js';
import type { NotificacionesService } from './notificaciones.service.js';

export function registrarSuscriptoresNotificaciones(
  bus: EventSubscriber<AppEventMap>,
  service: NotificacionesService,
): () => void {
  const cancelarCita = bus.subscribe('CitaConfirmada', (evento) =>
    service.notificarCitaConfirmada(evento),
  );

  const cancelarPedido = bus.subscribe('PedidoPagado', (evento) =>
    service.notificarPedidoPagado(evento),
  );

  return () => {
    cancelarCita();
    cancelarPedido();
  };
}
