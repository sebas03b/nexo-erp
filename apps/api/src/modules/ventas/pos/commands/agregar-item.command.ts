// Patrón: Command

import type { Comando } from './comando.js';
import { Carrito, type ItemCarrito } from './carrito.js';

export class AgregarItemCommand implements Comando {
  #carrito: Carrito;
  #productoId: string;
  #cantidad: number;
  #precioUnitario: number;
  #itemAnterior: ItemCarrito | undefined;
  #ejecutado = false;

  constructor(
    carrito: Carrito,
    productoId: string,
    cantidad: number,
    precioUnitario: number,
  ) {
    this.#carrito = carrito;
    this.#productoId = productoId;
    this.#cantidad = cantidad;
    this.#precioUnitario = precioUnitario;
  }

  async ejecutar(): Promise<void> {
    if (this.#ejecutado) {
      return;
    }

    const existente = this.#carrito.obtenerItem(this.#productoId);

    if (existente) {
      this.#itemAnterior = { ...existente };
      existente.cantidad += this.#cantidad;
    } else {
      this.#carrito.agregarItem(
        this.#productoId,
        this.#cantidad,
        this.#precioUnitario,
      );
    }

    this.#ejecutado = true;
  }

  async deshacer(): Promise<void> {
    if (!this.#ejecutado) {
      return;
    }

    const existente = this.#carrito.obtenerItem(this.#productoId);

    if (existente && this.#itemAnterior) {
      existente.cantidad = this.#itemAnterior.cantidad;
    } else {
      this.#carrito.quitarItem(this.#productoId);
    }

    this.#ejecutado = false;
  }
}
