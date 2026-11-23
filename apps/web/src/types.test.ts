import { describe, expect, it } from 'vitest';

import {
  esCanalNotificacion,
  normalizarCanalNotificacion,
} from './types';

describe('Canal de notificación web', () => {
  it('acepta únicamente los tres canales soportados', () => {
    expect(esCanalNotificacion('email')).toBe(true);
    expect(esCanalNotificacion('sms')).toBe(true);
    expect(esCanalNotificacion('whatsapp')).toBe(true);
    expect(esCanalNotificacion('correo')).toBe(false);
    expect(esCanalNotificacion(null)).toBe(false);
  });

  it('normaliza valores ausentes o inválidos a email', () => {
    expect(normalizarCanalNotificacion('sms')).toBe('sms');
    expect(normalizarCanalNotificacion('whatsapp')).toBe('whatsapp');
    expect(normalizarCanalNotificacion('correo')).toBe('email');
    expect(normalizarCanalNotificacion(null)).toBe('email');
  });
});
