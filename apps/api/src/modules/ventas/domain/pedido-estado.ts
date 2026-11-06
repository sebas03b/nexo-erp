// Patrón: State

import { DomainError } from '../../../shared/errors/domain-error.js';

export const ESTADOS_PEDIDO = ['Borrador', 'Emitido', 'Pagado', 'Anulado'] as const;

export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export function esEstadoPedido(value: string): value is EstadoPedido {
  return (ESTADOS_PEDIDO as readonly string[]).includes(value);
}

export class TransicionEstadoInvalida extends DomainError {
  constructor(actual: EstadoPedido, intento: EstadoPedido) {
    super(`Transición de pedido inválida: ${actual} → ${intento}`, {
      code: 'TRANSICION_INVALIDA',
      statusCode: 409,
    });
  }
}

export abstract class PedidoEstado {
  abstract readonly nombre: EstadoPedido;

  emitir(): PedidoEstado {
    throw new TransicionEstadoInvalida(this.nombre, 'Emitido');
  }

  pagar(): PedidoEstado {
    throw new TransicionEstadoInvalida(this.nombre, 'Pagado');
  }

  anular(): PedidoEstado {
    throw new TransicionEstadoInvalida(this.nombre, 'Anulado');
  }
}
