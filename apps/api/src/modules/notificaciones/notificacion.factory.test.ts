import { describe, expect, it, vi } from 'vitest';

import {
  EmailSender,
  NotificacionFactory,
  SmsSender,
  WhatsAppSender,
  type Notificador,
} from './notificacion.factory.js';

describe('NotificacionFactory (Factory Method)', () => {
  const factory = new NotificacionFactory();

  it('devuelve un EmailSender cuando el canal es email', () => {
    const notificador: Notificador = factory.crear('email');

    expect(notificador).toBeInstanceOf(EmailSender);
  });

  it('devuelve un SmsSender cuando el canal es sms', () => {
    const notificador = factory.crear('sms');

    expect(notificador).toBeInstanceOf(SmsSender);
  });

  it('devuelve un WhatsAppSender cuando el canal es whatsapp', () => {
    const notificador = factory.crear('whatsapp');

    expect(notificador).toBeInstanceOf(WhatsAppSender);
  });

  it('cada notificador envía el mensaje por su propio canal', () => {
    const casos: Array<[string, string]> = [
      ['email', '[Email] Enviando: Hola cliente'],
      ['sms', '[SMS] Enviando: Hola cliente'],
      ['whatsapp', '[WhatsApp] Enviando: Hola cliente'],
    ];

    for (const [canal, esperado] of casos) {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const notificador: Notificador = factory.crear(canal);

      notificador.enviar('Hola cliente');

      expect(log).toHaveBeenCalledWith(esperado);
      log.mockRestore();
    }
  });

  it('lanza un error cuando el canal no está soportado', () => {
    expect(() => factory.crear('correo')).toThrow(
      'Canal de notificación no soportado: correo',
    );
    expect(() => factory.crear('')).toThrow('Canal de notificación no soportado: ');
  });
});
