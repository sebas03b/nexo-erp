export const CANALES_NOTIFICACION = [
  'email',
  'sms',
  'whatsapp',
] as const;

export type CanalNotificacion = (typeof CANALES_NOTIFICACION)[number];

const canalesValidos = new Set<string>(CANALES_NOTIFICACION);

export function esCanalNotificacion(valor: unknown): valor is CanalNotificacion {
  return typeof valor === 'string' && canalesValidos.has(valor);
}

export function normalizarCanalNotificacion(valor: unknown): CanalNotificacion {
  return esCanalNotificacion(valor) ? valor : 'email';
}
