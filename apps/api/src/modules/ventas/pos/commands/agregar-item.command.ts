// Patrón: Command

import type { Comando } from './comando.js';
import type { Carrito, ItemCarrito } from './carrito.js';

export class AgregarItemCommand implements Comando {
  #carrito: Carrito;
  #productoId: string;
  #cantidad: number;
  #precioUnitario: number;
  #itemAnterior: ItemCarrito | null | undefined;
  #ejecutado: boolean;

  constructor(
    carrito: Carrito,
    productoId: string,
    cantidad: number,
    precioUnitario: number,
    estadoAnterior?: ItemCarrito | null,
    ejecutado?: boolean,
  ) {
    this.#carrito = carrito;
    this.#productoId = productoId;
    this.#cantidad = cantidad;
    this.#precioUnitario = precioUnitario;
    this.#itemAnterior = estadoAnterior;
    this.#ejecutado = ejecutado ?? estadoAnterior !== undefined;
  }

  ejecutar(): Promise<void> {
    if (this.#ejecutado) {
      return Promise.resolve();
    }

    const existente = this.#carrito.obtenerItem(this.#productoId);
    this.#itemAnterior = existente ?? null;

    if (existente) {
      this.#carrito.fijarCantidad(this.#productoId, existente.cantidad + this.#cantidad);
    } else {
      this.#carrito.agregarItem(this.#productoId, this.#cantidad, this.#precioUnitario);
    }

    this.#ejecutado = true;
    return Promise.resolve();
  }

  deshacer(): Promise<void> {
    if (!this.#ejecutado) {
      return Promise.resolve();
    }

    if (this.#itemAnterior) {
      this.#carrito.restaurarItem(this.#itemAnterior);
    } else {
      this.#carrito.quitarItem(this.#productoId);
    }

    this.#ejecutado = false;
    return Promise.resolve();
  }

  obtenerEstadoAnterior(): ItemCarrito | null | undefined {
    return this.#itemAnterior === undefined ? undefined : this.#itemAnterior ? { ...this.#itemAnterior } : null;
  }
}