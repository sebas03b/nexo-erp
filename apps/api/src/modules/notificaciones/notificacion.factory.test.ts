import { describe, expect, it } from 'vitest';

import { NotificacionFactory } from './notificacion.factory.js';
import { EmailSender } from './notificadores/email.sender.js';
import { SmsSender } from './notificadores/sms.sender.js';
import { WhatsAppSender } from './notificadores/whatsapp.sender.js';

describe('NotificacionFactory (Factory Method)', () => {
  it('crea un EmailSender y escribe por el canal Email', async () => {
    const lineas: string[] = [];
    const factory = new NotificacionFactory((linea) => lineas.push(linea));

    const notificador = factory.crear('email');
    expect(notificador).toBeInstanceOf(EmailSender);

    await notificador.enviar({
      destinatario: 'ana@email.com',
      mensaje: 'Cita confirmada.',
    });

    expect(lineas).toEqual(['[Email][ana@email.com] Cita confirmada.']);
  });

  it('crea un SmsSender y escribe por el canal SMS', async () => {
    const lineas: string[] = [];
    const factory = new NotificacionFactory((linea) => lineas.push(linea));

    const notificador = factory.crear('sms');
    expect(notificador).toBeInstanceOf(SmsSender);

    await notificador.enviar({
      destinatario: '3001112233',
      mensaje: 'Pago recibido.',
    });

    expect(lineas).toEqual(['[SMS][3001112233] Pago recibido.']);
  });

  it('crea un WhatsAppSender y escribe por el canal WhatsApp', async () => {
    const lineas: string[] = [];
    const factory = new NotificacionFactory((linea) => lineas.push(linea));

    const notificador = factory.crear('whatsapp');
    expect(notificador).toBeInstanceOf(WhatsAppSender);

    await notificador.enviar({
      destinatario: '3014445566',
      mensaje: 'Cita confirmada.',
    });

    expect(lineas).toEqual([
      '[WhatsApp][3014445566] Cita confirmada.',
    ]);
  });
});
