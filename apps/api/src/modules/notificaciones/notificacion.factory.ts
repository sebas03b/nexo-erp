// Patrón: Factory Method

import type { CanalNotificacion } from '../../shared/types/canal-notificacion.js';
import type {
  CreadorNotificador,
  Notificador,
} from './notificacion.types.js';
import { EmailSender } from './notificadores/email.sender.js';
import { SmsSender } from './notificadores/sms.sender.js';
import { WhatsAppSender } from './notificadores/whatsapp.sender.js';

export class NotificacionFactory implements CreadorNotificador {
  readonly #salida: (linea: string) => void;

  constructor(salida: (linea: string) => void = console.log) {
    this.#salida = salida;
  }

  crear(canal: CanalNotificacion): Notificador {
    switch (canal) {
      case 'email':
        return new EmailSender(this.#salida);
      case 'sms':
        return new SmsSender(this.#salida);
      case 'whatsapp':
        return new WhatsAppSender(this.#salida);
      default:
        throw new Error('Canal de notificación no soportado');
    }
  }
}
