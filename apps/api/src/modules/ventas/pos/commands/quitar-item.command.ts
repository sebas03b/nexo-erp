// Patrón: Command

import type { Comando } from './comando.js';
import type { Carrito, ItemCarrito } from './carrito.js';

export class QuitarItemCommand implements Comando {
  #carrito: Carrito;
  #productoId: string;
  #itemRemovido: ItemCarrito | undefined;
  #ejecutado: boolean;

  constructor(
    carrito: Carrito,
    productoId: string,
    itemRemovido?: ItemCarrito,
    ejecutado?: boolean,
  ) {
    this.#carrito = carrito;
    this.#productoId = productoId;
    this.#itemRemovido = itemRemovido ? { ...itemRemovido } : undefined;
    this.#ejecutado = ejecutado ?? itemRemovido !== undefined;
  }

  ejecutar(): Promise<void> {
    if (this.#ejecutado) {
      return Promise.resolve();
    }

    const removido = this.#carrito.quitarItem(this.#productoId);
    this.#itemRemovido = removido ? { ...removido } : undefined;
    this.#ejecutado = true;
    return Promise.resolve();
  }

  deshacer(): Promise<void> {
    if (!this.#ejecutado || !this.#itemRemovido) {
      return Promise.resolve();
    }

    this.#carrito.restaurarItem(this.#itemRemovido);
    this.#ejecutado = false;
    return Promise.resolve();
  }

  obtenerItemRemovido(): ItemCarrito | undefined {
    return this.#itemRemovido ? { ...this.#itemRemovido } : undefined;
  }
}