// Patrón: State

import { DomainError } from '../../../shared/errors/domain-error.js';
import {
  esEstadoPedido,
  type EstadoPedido,
  type PedidoEstado,
} from './pedido-estado.js';
import { AnuladoState } from './states/anulado.state.js';
import { BorradorState } from './states/borrador.state.js';
import { EmitidoState } from './states/emitido.state.js';
import { PagadoState } from './states/pagado.state.js';

export interface PedidoItem {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
}

export interface PedidoData {
  id: string;
  clienteId: string;
  estado: EstadoPedido;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  items: readonly PedidoItem[];
}

export interface PedidoJson {
  id: string;
  clienteId: string;
  estado: EstadoPedido;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  items: PedidoItem[];
}

function crearEstado(estado: EstadoPedido): PedidoEstado {
  switch (estado) {
    case 'Borrador':
      return new BorradorState();
    case 'Emitido':
      return new EmitidoState();
    case 'Pagado':
      return new PagadoState();
    case 'Anulado':
      return new AnuladoState();
  }
}

export class Pedido {
  readonly id: string;
  readonly clienteId: string;
  readonly subtotal: number;
  readonly descuento: number;
  readonly impuesto: number;
  readonly total: number;
  readonly items: readonly PedidoItem[];

  #estado: PedidoEstado;

  constructor(data: PedidoData) {
    if (!esEstadoPedido(data.estado)) {
      throw new DomainError(`Estado de pedido desconocido: ${String(data.estado)}`, {
        code: 'ESTADO_PEDIDO_INVALIDO',
        statusCode: 400,
      });
    }

    if (data.items.length === 0) {
      throw new DomainError('El pedido debe tener al menos un ítem', {
        code: 'PEDIDO_SIN_ITEMS',
        statusCode: 400,
      });
    }

    if (data.total < 0) {
      throw new DomainError('El total del pedido no puede ser negativo', {
        code: 'PEDIDO_TOTAL_INVALIDO',
        statusCode: 400,
      });
    }

    this.id = data.id;
    this.clienteId = data.clienteId;
    this.subtotal = data.subtotal;
    this.descuento = data.descuento;
    this.impuesto = data.impuesto;
    this.total = data.total;
    this.items = [...data.items];
    this.#estado = crearEstado(data.estado);
  }

  get estado(): EstadoPedido {
    return this.#estado.nombre;
  }

  emitir(): void {
    this.#estado = this.#estado.emitir();
  }

  pagar(): void {
    this.#estado = this.#estado.pagar();
  }

  anular(): void {
    this.#estado = this.#estado.anular();
  }

  toJSON(): PedidoJson {
    return {
      id: this.id,
      clienteId: this.clienteId,
      estado: this.estado,
      subtotal: this.subtotal,
      descuento: this.descuento,
      impuesto: this.impuesto,
      total: this.total,
      items: this.items.map((item) => ({ ...item })),
    };
  }
}
