// Patrón: Factory Method

import type { MensajeNotificacion, Notificador } from '../notificacion.types.js';

export class WhatsAppSender implements Notificador {
  readonly #salida: (linea: string) => void;

  constructor(salida: (linea: string) => void) {
    this.#salida = salida;
  }

  enviar(mensaje: MensajeNotificacion): Promise<void> {
    this.#salida(`[WhatsApp][${mensaje.destinatario}] ${mensaje.mensaje}`);
    return Promise.resolve();
  }
}
