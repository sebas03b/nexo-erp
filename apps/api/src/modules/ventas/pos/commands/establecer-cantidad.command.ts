// Patrón: Command

import type { Comando } from './comando.js';
import { Carrito, type ItemCarrito } from './carrito.js';

export class EstablecerCantidadCommand implements Comando {
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

  async ejecutar(): Promise<void> {
    if (this.#ejecutado) {
      return;
    }

    const existente = this.#carrito.obtenerItem(this.#productoId);
    this.#itemAnterior = existente ?? null;

    if (!existente) {
      this.#ejecutado = true;
      return;
    }

    if (this.#cantidad <= 0) {
      this.#carrito.quitarItem(this.#productoId);
    } else {
      this.#carrito.fijarCantidad(this.#productoId, this.#cantidad);
    }

    this.#ejecutado = true;
  }

  async deshacer(): Promise<void> {
    if (!this.#ejecutado) {
      return;
    }

    if (this.#itemAnterior) {
      this.#carrito.restaurarItem(this.#itemAnterior);
    } else {
      this.#carrito.quitarItem(this.#productoId);
    }

    this.#ejecutado = false;
  }

  obtenerEstadoAnterior(): ItemCarrito | null | undefined {
    return this.#itemAnterior === undefined ? undefined : this.#itemAnterior ? { ...this.#itemAnterior } : null;
  }
}