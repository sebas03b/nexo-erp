import type { CanalNotificacion } from '../../shared/types/canal-notificacion.js';

export interface MensajeNotificacion {
  destinatario: string;
  mensaje: string;
}

export interface Notificador {
  enviar(mensaje: MensajeNotificacion): Promise<void>;
}

export interface CreadorNotificador {
  crear(canal: CanalNotificacion): Notificador;
}
