// Patrón: Command

import type { Comando } from './comando.js';
import type { Carrito, ItemCarrito } from './carrito.js';

export class DecrementarItemCommand implements Comando {
  #carrito: Carrito;
  #productoId: string;
  #cantidad: number;
  #itemAnterior: ItemCarrito | null | undefined;
  #ejecutado: boolean;

  constructor(
    carrito: Carrito,
    productoId: string,
    cantidad: number,
    estadoAnterior?: ItemCarrito | null,
    ejecutado?: boolean,
  ) {
    this.#carrito = carrito;
    this.#productoId = productoId;
    this.#cantidad = cantidad;
    this.#itemAnterior = estadoAnterior === undefined ? undefined : estadoAnterior ? { ...estadoAnterior } : null;
    this.#ejecutado = ejecutado ?? estadoAnterior !== undefined;
  }

  ejecutar(): Promise<void> {
    if (this.#ejecutado) {
      return Promise.resolve();
    }

    const existente = this.#carrito.obtenerItem(this.#productoId);
    this.#itemAnterior = existente ?? null;

    if (!existente) {
      this.#ejecutado = true;
      return Promise.resolve();
    }

    this.#carrito.restarCantidad(this.#productoId, this.#cantidad);
    this.#ejecutado = true;
    return Promise.resolve();
  }

  deshacer(): Promise<void> {
    if (!this.#ejecutado) {
      return Promise.resolve();
    }

    if (this.#itemAnterior) {
      this.#carrito.restaurarItem(this.#itemAnterior);
    }

    this.#ejecutado = false;
    return Promise.resolve();
  }

  obtenerEstadoAnterior(): ItemCarrito | null | undefined {
    return this.#itemAnterior === undefined ? undefined : this.#itemAnterior ? { ...this.#itemAnterior } : null;
  }
}