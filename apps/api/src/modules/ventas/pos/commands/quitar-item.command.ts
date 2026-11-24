// Patrón: Command

import type { Comando } from './comando.js';
import type { Carrito, ItemCarrito } from './carrito.js';

export class QuitarItemCommand implements Comando {
  #carrito: Carrito;
  #productoId: string;
  #itemId: string | undefined;
  #itemRemovido: ItemCarrito | undefined;
  #ejecutado: boolean;

  constructor(
    carrito: Carrito,
    productoId: string,
    itemRemovido?: ItemCarrito,
    ejecutado?: boolean,
    itemId?: string,
  ) {
    this.#carrito = carrito;
    this.#productoId = productoId;
    this.#itemId = itemId ?? itemRemovido?.itemId;
    this.#itemRemovido = itemRemovido ? { ...itemRemovido } : undefined;
    this.#ejecutado = ejecutado ?? itemRemovido !== undefined;
  }

  ejecutar(): Promise<void> {
    if (this.#ejecutado) {
      return Promise.resolve();
    }

    const removido = this.#itemId
      ? this.#carrito.quitarItemPorId(this.#itemId)
      : this.#carrito.quitarItem(this.#productoId);
    this.#itemRemovido = removido ? { ...removido } : undefined;
    this.#itemId = this.#itemRemovido?.itemId ?? this.#itemId;
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