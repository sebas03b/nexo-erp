// Patrón: Observer

import type { CanalPreferido } from '../clientes/clientes.types.js';
import { NotificacionFactory } from './notificacion.factory.js';

export interface Destinatario {
  nombre: string;
  canalPreferido: CanalPreferido;
}

export class ServicioNotificaciones {
  constructor(
    private readonly factory: NotificacionFactory,
    private readonly obtenerDestinatario: (id: string) => Promise<Destinatario | null>,
  ) {}

  async notificarCliente(clienteId: string, mensaje: string): Promise<void> {
    const dest = await this.obtenerDestinatario(clienteId);
    if (!dest) return;
    this.factory.crear(dest.canalPreferido).enviar(`Hola ${dest.nombre}: ${mensaje}`);
  }
}
