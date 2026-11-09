// Patrón: Command

export interface ItemCarrito {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
}

export class Carrito {
  #items: ItemCarrito[] = [];

  get items(): readonly ItemCarrito[] {
    return [...this.#items];
  }

  obtenerItem(productoId: string): ItemCarrito | undefined {
    return this.#items.find((item) => item.productoId === productoId);
  }

  agregarItem(productoId: string, cantidad: number, precioUnitario: number): void {
    const existente = this.obtenerItem(productoId);

    if (existente) {
      existente.cantidad += cantidad;
    } else {
      this.#items.push({ productoId, cantidad, precioUnitario });
    }
  }

  quitarItem(productoId: string): ItemCarrito | undefined {
    const indice = this.#items.findIndex((item) => item.productoId === productoId);

    if (indice === -1) {
      return undefined;
    }

    return this.#items.splice(indice, 1)[0];
  }

  limpiar(): void {
    this.#items = [];
  }
}
