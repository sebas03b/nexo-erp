// Patrón: Factory Method

import type { MensajeNotificacion, Notificador } from '../notificacion.types.js';

export class SmsSender implements Notificador {
  readonly #salida: (linea: string) => void;

  constructor(salida: (linea: string) => void) {
    this.#salida = salida;
  }

  enviar(mensaje: MensajeNotificacion): Promise<void> {
    this.#salida(`[SMS][${mensaje.destinatario}] ${mensaje.mensaje}`);
    return Promise.resolve();
  }
}
