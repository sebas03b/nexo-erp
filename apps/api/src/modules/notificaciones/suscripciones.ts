// Patrón: Observer

import type { EventSubscriber } from '../../shared/events/event-bus.js';
import type { AppEventMap } from '../../shared/events/app-event-map.js';
import type { ServicioNotificaciones } from './servicio-notificaciones.js';

export function registrarSuscripcionesNotificaciones(
  bus: EventSubscriber<AppEventMap>,
  servicio: ServicioNotificaciones,
): void {
  bus.subscribe('CitaConfirmada', async ({ citaId, clienteId, inicio }) => {
    await servicio.notificarCliente(
      clienteId,
      `Su cita ${citaId} ha sido confirmada para ${inicio}.`,
    );
  });

  bus.subscribe('RecordatorioCitaSolicitado', async ({ citaId, clienteId, inicio, fin, notas }) => {
    const detalle = notas ? ` (${notas})` : '';
    await servicio.notificarCliente(
      clienteId,
      `Recordatorio: su cita ${citaId}${detalle} está programada para ${inicio} - ${fin}.`,
    );
  });

  bus.subscribe('PedidoPagado', async ({ pedidoId, clienteId, total }) => {
    await servicio.notificarCliente(
      clienteId,
      `Comprobante de pago: pedido ${pedidoId}, total ${total}.`,
    );
  });
}
