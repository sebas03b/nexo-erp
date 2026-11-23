import { describe, expect, it } from 'vitest';

import type { CanalNotificacion } from '../../shared/types/canal-notificacion.js';
import { NotificacionFactory } from './notificacion.factory.js';
import type {
  CreadorNotificador,
  Notificador,
} from './notificacion.types.js';
import { NotificacionesService } from './notificaciones.service.js';
import type {
  ConsultorContactos,
  ContactoCliente,
} from './ports.js';

const CITA_CONFIRMADA = {
  citaId: 'cita-1',
  clienteId: 'cliente-1',
  empleadoId: 'empleado-1',
  empleadoNombre: 'Laura Pérez',
  motivo: 'Corte y color',
  inicio: '2026-11-25T15:00:00.000Z',
  fin: '2026-11-25T16:00:00.000Z',
  confirmadaEn: '2026-11-20T12:00:00.000Z',
};

const PEDIDO_PAGADO = {
  pedidoId: 'pedido-1',
  clienteId: 'cliente-1',
  total: 200,
  pagadoEn: '2026-11-20T12:00:00.000Z',
  metodoPago: 'efectivo',
  referenciaPago: 'PAGO-1',
};

describe('NotificacionesService', () => {
  function crearServicio(
    contacto: ContactoCliente | null,
    lineas: string[],
    advertencias: string[],
  ): NotificacionesService {
    const contactos: ConsultorContactos = {
      obtenerContacto: () => Promise.resolve(contacto),
    };
    const factory = new NotificacionFactory((linea) => lineas.push(linea));

    return new NotificacionesService(factory, contactos, (mensaje) =>
      advertencias.push(mensaje),
    );
  }

  it('envía la confirmación de cita por el canal preferido', async () => {
    const lineas: string[] = [];
    const advertencias: string[] = [];
    const service = crearServicio(
      {
        nombre: 'Ana González',
        email: 'ana@email.com',
        telefono: '3001112233',
        canalPreferido: 'email',
      },
      lineas,
      advertencias,
    );

    await service.notificarCitaConfirmada(CITA_CONFIRMADA);

    expect(lineas).toEqual([
      '[Email][ana@email.com] Cita confirmada para el 25/11/2026 10:00 con Laura Pérez. Motivo: Corte y color.',
    ]);
    expect(advertencias).toEqual([]);
  });

  it('consulta la preferencia actual en cada notificación', async () => {
    const lineas: string[] = [];
    const advertencias: string[] = [];
    let canal: CanalNotificacion = 'email';
    const contactos: ConsultorContactos = {
      obtenerContacto: () =>
        Promise.resolve({
          nombre: 'Ana González',
          email: 'ana@email.com',
          telefono: '3001112233',
          canalPreferido: canal,
        }),
    };
    const service = new NotificacionesService(
      new NotificacionFactory((linea) => lineas.push(linea)),
      contactos,
      (mensaje) => advertencias.push(mensaje),
    );

    await service.notificarCitaConfirmada(CITA_CONFIRMADA);
    canal = 'whatsapp';
    await service.notificarCitaConfirmada(CITA_CONFIRMADA);

    expect(lineas[0]).toContain('[Email][ana@email.com]');
    expect(lineas[1]).toContain('[WhatsApp][3001112233]');
    expect(advertencias).toEqual([]);
  });

  it('envía el comprobante de pago con total y referencia', async () => {
    const lineas: string[] = [];
    const advertencias: string[] = [];
    const service = crearServicio(
      {
        nombre: 'Ana González',
        telefono: '3001112233',
        canalPreferido: 'sms',
      },
      lineas,
      advertencias,
    );

    await service.notificarPedidoPagado(PEDIDO_PAGADO);

    expect(lineas).toEqual([
      '[SMS][3001112233] Pago recibido por el pedido pedido-1. Total: $200.00. Referencia: PAGO-1.',
    ]);
  });

  it('omite el envío y advierte cuando el cliente no existe', async () => {
    const lineas: string[] = [];
    const advertencias: string[] = [];
    const service = crearServicio(null, lineas, advertencias);

    await service.notificarCitaConfirmada(CITA_CONFIRMADA);

    expect(lineas).toEqual([]);
    expect(advertencias).toEqual([
      'No se encontró el cliente cliente-1; se omite la notificación.',
    ]);
  });

  it('omite el envío y advierte cuando el canal no tiene destinatario', async () => {
    const lineas: string[] = [];
    const advertencias: string[] = [];
    const service = crearServicio(
      {
        nombre: 'Ana González',
        email: 'ana@email.com',
        canalPreferido: 'whatsapp',
      },
      lineas,
      advertencias,
    );

    await service.notificarCitaConfirmada(CITA_CONFIRMADA);

    expect(lineas).toEqual([]);
    expect(advertencias).toEqual([
      'El cliente cliente-1 no tiene teléfono para el canal whatsapp; se omite la notificación.',
    ]);
  });

  it('no propaga el fallo de un notificador', async () => {
    const advertencias: string[] = [];
    const notificador: Notificador = {
      enviar: () => Promise.reject(new Error('canal caído')),
    };
    const factory: CreadorNotificador = {
      crear: () => notificador,
    };
    const contactos: ConsultorContactos = {
      obtenerContacto: () =>
        Promise.resolve({
          nombre: 'Ana González',
          email: 'ana@email.com',
          canalPreferido: 'email',
        }),
    };
    const service = new NotificacionesService(
      factory,
      contactos,
      (mensaje) => advertencias.push(mensaje),
    );

    await expect(
      service.notificarCitaConfirmada(CITA_CONFIRMADA),
    ).resolves.toBeUndefined();
    expect(advertencias).toEqual([
      'No se pudo enviar la notificación por email: canal caído',
    ]);
  });
});
