// Patrón: Command

import type { Comando } from './comando.js';
import { Carrito, type ItemCarrito } from './carrito.js';

export class QuitarItemCommand implements Comando {
  #carrito: Carrito;
  #productoId: string;
  #itemRemovido: ItemCarrito | undefined;
  #ejecutado = false;

  constructor(carrito: Carrito, productoId: string) {
    this.#carrito = carrito;
    this.#productoId = productoId;
  }

  async ejecutar(): Promise<void> {
    if (this.#ejecutado) {
      return;
    }

    this.#itemRemovido = this.#carrito.quitarItem(this.#productoId);
    this.#ejecutado = true;
  }

  async deshacer(): Promise<void> {
    if (!this.#ejecutado || !this.#itemRemovido) {
      return;
    }

    this.#carrito.agregarItem(
      this.#itemRemovido.productoId,
      this.#itemRemovido.cantidad,
      this.#itemRemovido.precioUnitario,
    );

    this.#ejecutado = false;
  }
}
