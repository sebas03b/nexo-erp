// Patrón: Factory Method

import type { CanalPreferido } from '../clientes/clientes.types.js';

export interface Notificador {
  enviar(mensaje: string): void;
}

export class EmailSender implements Notificador {
  enviar(mensaje: string): void {
    console.log(`[Email] Enviando: ${mensaje}`);
  }
}

export class SmsSender implements Notificador {
  enviar(mensaje: string): void {
    console.log(`[SMS] Enviando: ${mensaje}`);
  }
}

export class WhatsAppSender implements Notificador {
  enviar(mensaje: string): void {
    console.log(`[WhatsApp] Enviando: ${mensaje}`);
  }
}

export class NotificacionFactory {
  crear(canal: CanalPreferido): Notificador {
    switch (canal) {
      case 'email':
        return new EmailSender();
      case 'sms':
        return new SmsSender();
      case 'whatsapp':
        return new WhatsAppSender();
      default: {
        const canalInvalido: string = canal;
        throw new Error(`Canal de notificación no soportado: ${canalInvalido}`);
      }
    }
  }
}
