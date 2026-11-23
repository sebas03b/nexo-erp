// Patrón: Factory Method

import type { MensajeNotificacion, Notificador } from '../notificacion.types.js';

export class EmailSender implements Notificador {
  readonly #salida: (linea: string) => void;

  constructor(salida: (linea: string) => void) {
    this.#salida = salida;
  }

  enviar(mensaje: MensajeNotificacion): Promise<void> {
    this.#salida(`[Email][${mensaje.destinatario}] ${mensaje.mensaje}`);
    return Promise.resolve();
  }
}
