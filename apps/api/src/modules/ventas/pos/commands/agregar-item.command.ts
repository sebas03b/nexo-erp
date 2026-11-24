// Patrón: Command

import type { Comando } from './comando.js';
import type { Carrito, ItemCarrito } from './carrito.js';

export class AgregarItemCommand implements Comando {
  #carrito: Carrito;
  #productoId: string;
  #cantidad: number;
  #precioUnitario: number;
  #itemAnterior: ItemCarrito | null | undefined;
  #itemCreadoId: string | undefined;
  #lineaIndependiente: boolean;
  #ejecutado: boolean;

  constructor(
    carrito: Carrito,
    productoId: string,
    cantidad: number,
    precioUnitario: number,
    estadoAnterior?: ItemCarrito | null,
    ejecutado?: boolean,
    opts?: { itemId?: string; lineaIndependiente?: boolean },
  ) {
    this.#carrito = carrito;
    this.#productoId = productoId;
    this.#cantidad = cantidad;
    this.#precioUnitario = precioUnitario;
    this.#itemAnterior = estadoAnterior;
    this.#itemCreadoId = opts?.itemId;
    this.#lineaIndependiente = opts?.lineaIndependiente ?? false;
    this.#ejecutado = ejecutado ?? estadoAnterior !== undefined;
  }

  ejecutar(): Promise<void> {
    if (this.#ejecutado) {
      return Promise.resolve();
    }

    const existente = this.#lineaIndependiente ? undefined : this.#carrito.obtenerItem(this.#productoId);
    this.#itemAnterior = existente ?? null;

    const item = this.#carrito.agregarItem(this.#productoId, this.#cantidad, this.#precioUnitario, {
      itemId: this.#itemCreadoId,
      lineaIndependiente: this.#lineaIndependiente,
    });
    this.#itemCreadoId = item.itemId;
    this.#ejecutado = true;
    return Promise.resolve();
  }

  deshacer(): Promise<void> {
    if (!this.#ejecutado) {
      return Promise.resolve();
    }

    if (this.#itemAnterior) {
      this.#carrito.restaurarItem(this.#itemAnterior);
      if (this.#lineaIndependiente && this.#itemCreadoId) {
        // independent line merged case not expected, but keep safe
      }
    } else if (this.#itemCreadoId) {
      this.#carrito.quitarItemPorId(this.#itemCreadoId);
    } else {
      this.#carrito.quitarItem(this.#productoId);
    }

    this.#ejecutado = false;
    return Promise.resolve();
  }

  obtenerEstadoAnterior(): ItemCarrito | null | undefined {
    return this.#itemAnterior === undefined
      ? undefined
      : this.#itemAnterior
        ? { ...this.#itemAnterior }
        : null;
  }

  obtenerItemCreadoId(): string | undefined {
    return this.#itemCreadoId;
  }
}