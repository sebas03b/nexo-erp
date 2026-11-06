import { DomainError } from '../../../shared/errors/domain-error.js';
import type { Pedido } from './pedido.js';

export interface FacturaData {
  id: string;
  pedidoId: string;
  numero: string;
  estado: string;
  payloadExterno: object | null;
}

export interface EmitirFacturaOptions {
  id: string;
  numero: string;
}

export class Factura {
  readonly id: string;
  readonly pedidoId: string;
  readonly numero: string;
  readonly estado: string;
  readonly payloadExterno: object | null;

  constructor(data: FacturaData) {
    this.id = data.id;
    this.pedidoId = data.pedidoId;
    this.numero = data.numero;
    this.estado = data.estado;
    this.payloadExterno = data.payloadExterno;
  }

  static emitirPara(pedido: Pedido, options: EmitirFacturaOptions): Factura {
    if (pedido.estado !== 'Pagado') {
      throw new DomainError('Solo se puede facturar un pedido pagado', {
        code: 'PEDIDO_NO_PAGADO',
        statusCode: 409,
      });
    }

    return new Factura({
      id: options.id,
      pedidoId: pedido.id,
      numero: options.numero,
      estado: 'Emitida',
      payloadExterno: null,
    });
  }
}
