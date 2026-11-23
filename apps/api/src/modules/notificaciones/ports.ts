import type { CanalNotificacion } from '../../shared/types/canal-notificacion.js';

export interface ContactoCliente {
  nombre: string;
  email?: string;
  telefono?: string;
  canalPreferido: CanalNotificacion;
}

export interface ConsultorContactos {
  obtenerContacto(clienteId: string): Promise<ContactoCliente | null>;
}
