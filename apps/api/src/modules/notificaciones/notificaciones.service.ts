import type { AppEventMap } from '../../shared/events/event-map.js';
import type {
  CreadorNotificador,
  Notificador,
} from './notificacion.types.js';
import type { ConsultorContactos, ContactoCliente } from './ports.js';

export type SumideroAdvertencias = (mensaje: string) => void;

const FORMATO_FECHA_CITA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function formatearFechaCita(inicio: string): string {
  const partes = new Map(
    FORMATO_FECHA_CITA.formatToParts(new Date(inicio)).map((parte) => [
      parte.type,
      parte.value,
    ]),
  );

  const dia = partes.get('day') ?? '00';
  const mes = partes.get('month') ?? '00';
  const anio = partes.get('year') ?? '0000';
  const hora = partes.get('hour') ?? '00';
  const minuto = partes.get('minute') ?? '00';

  return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
}

function describirError(error: unknown): string {
  return error instanceof Error ? error.message : 'error desconocido';
}

export class NotificacionesService {
  readonly #factory: CreadorNotificador;
  readonly #contactos: ConsultorContactos;
  readonly #advertir: SumideroAdvertencias;

  constructor(
    factory: CreadorNotificador,
    contactos: ConsultorContactos,
    advertencia: SumideroAdvertencias = console.warn,
  ) {
    this.#factory = factory;
    this.#contactos = contactos;
    this.#advertir = advertencia;
  }

  async notificarCitaConfirmada(
    evento: AppEventMap['CitaConfirmada'],
  ): Promise<void> {
    const motivo = evento.motivo?.trim() || 'no indicado';
    const mensaje = `Cita confirmada para el ${formatearFechaCita(evento.inicio)} con ${evento.empleadoNombre}. Motivo: ${motivo}.`;

    await this.#enviar(evento.clienteId, mensaje);
  }

  async notificarPedidoPagado(
    evento: AppEventMap['PedidoPagado'],
  ): Promise<void> {
    const mensaje = `Pago recibido por el pedido ${evento.pedidoId}. Total: $${evento.total.toFixed(2)}. Referencia: ${evento.referenciaPago}.`;

    await this.#enviar(evento.clienteId, mensaje);
  }

  async #enviar(clienteId: string, mensaje: string): Promise<void> {
    let contacto: ContactoCliente | null;

    try {
      contacto = await this.#contactos.obtenerContacto(clienteId);
    } catch (error) {
      this.#advertir(
        `No se pudo consultar el contacto del cliente ${clienteId}: ${describirError(error)}`,
      );
      return;
    }

    if (!contacto) {
      this.#advertir(
        `No se encontró el cliente ${clienteId}; se omite la notificación.`,
      );
      return;
    }

    const destinatario =
      contacto.canalPreferido === 'email'
        ? contacto.email?.trim()
        : contacto.telefono?.trim();

    if (!destinatario) {
      const datoRequerido =
        contacto.canalPreferido === 'email' ? 'correo electrónico' : 'teléfono';
      this.#advertir(
        `El cliente ${clienteId} no tiene ${datoRequerido} para el canal ${contacto.canalPreferido}; se omite la notificación.`,
      );
      return;
    }

    try {
      const notificador: Notificador = this.#factory.crear(
        contacto.canalPreferido,
      );
      await notificador.enviar({ destinatario, mensaje });
    } catch (error) {
      this.#advertir(
        `No se pudo enviar la notificación por ${contacto.canalPreferido}: ${describirError(error)}`,
      );
    }
  }
}
