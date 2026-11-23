// Patrón: Command

import type { Comando } from './comando.js';
import { Carrito, type ItemCarrito } from './carrito.js';

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

  async ejecutar(): Promise<void> {
    if (this.#ejecutado) {
      return;
    }

    const removido = this.#carrito.quitarItem(this.#productoId);
    this.#itemRemovido = removido ? { ...removido } : undefined;
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