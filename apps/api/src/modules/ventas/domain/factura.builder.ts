// Patrón: Builder

import { DomainError } from '../../../shared/errors/domain-error.js';
import { Factura, type FacturaData } from './factura.js';

export class FacturaBuilder {
  private id?: string;
  private pedidoId?: string;
  private numero?: string;
  private estado?: string;
  private payloadExterno: object | null = null;

  conId(id: string): this {
    this.id = id;
    return this;
  }

  conPedidoId(pedidoId: string): this {
    this.pedidoId = pedidoId;
    return this;
  }

  conNumero(numero: string): this {
    this.numero = numero;
    return this;
  }

  conEstado(estado: string): this {
    this.estado = estado;
    return this;
  }

  conPayloadExterno(payload: object | null): this {
    this.payloadExterno = payload;
    return this;
  }

  construir(): Factura {
    if (!this.id || !this.pedidoId || !this.numero || !this.estado) {
      throw new DomainError('Faltan datos obligatorios para construir la factura', {
        code: 'FACTURA_DATOS_INCOMPLETOS',
        statusCode: 400,
      });
    }

    const data: FacturaData = {
      id: this.id,
      pedidoId: this.pedidoId,
      numero: this.numero,
      estado: this.estado,
      payloadExterno: this.payloadExterno,
    };

    return new Factura(data);
  }
}
