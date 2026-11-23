// Patrón: Command

import type { Comando } from './comando.js';
import { Carrito, type ItemCarrito } from './carrito.js';

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

  async ejecutar(): Promise<void> {
    if (this.#ejecutado) {
      return;
    }

    const removido = this.#itemId
      ? this.#carrito.quitarItemPorId(this.#itemId)
      : this.#carrito.quitarItem(this.#productoId);
    this.#itemRemovido = removido ? { ...removido } : undefined;
    this.#itemId = this.#itemRemovido?.itemId ?? this.#itemId;
    this.#ejecutado = true;
  }

  async deshacer(): Promise<void> {
    if (!this.#ejecutado || !this.#itemRemovido) {
      return;
    }

    this.#carrito.restaurarItem(this.#itemRemovido);
    this.#ejecutado = false;
  }

  obtenerItemRemovido(): ItemCarrito | undefined {
    return this.#itemRemovido ? { ...this.#itemRemovido } : undefined;
  }
}