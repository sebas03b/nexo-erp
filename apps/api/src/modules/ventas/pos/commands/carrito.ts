// Patrón: Command

export interface ItemCarrito {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
}

export class Carrito {
  #items: ItemCarrito[] = [];

  get items(): readonly ItemCarrito[] {
    return this.#items.map((item) => ({ ...item }));
  }

  cargarItems(items: readonly ItemCarrito[]): void {
    this.#items = items.map((item) => ({ ...item }));
  }

  obtenerItem(productoId: string): ItemCarrito | undefined {
    const item = this.#items.find((actual) => actual.productoId === productoId);
    return item ? { ...item } : undefined;
  }

  agregarItem(productoId: string, cantidad: number, precioUnitario: number): void {
    const existente = this.#items.find((item) => item.productoId === productoId);

    if (existente) {
      existente.cantidad += cantidad;
      return;
    }

    this.#items.push({ productoId, cantidad, precioUnitario });
  }

  quitarItem(productoId: string): ItemCarrito | undefined {
    const indice = this.#items.findIndex((item) => item.productoId === productoId);

    if (indice === -1) {
      return undefined;
    }

    const [removido] = this.#items.splice(indice, 1);
    return removido ? { ...removido } : undefined;
  }

  restarCantidad(productoId: string, cantidad: number): ItemCarrito | undefined {
    const item = this.#items.find((actual) => actual.productoId === productoId);

    if (!item) {
      return undefined;
    }

    const anterior = { ...item };
    item.cantidad -= cantidad;

    if (item.cantidad <= 0) {
      this.#items = this.#items.filter((actual) => actual.productoId !== productoId);
    }

    return anterior;
  }

  fijarCantidad(productoId: string, cantidad: number): ItemCarrito | undefined {
    const item = this.#items.find((actual) => actual.productoId === productoId);

    if (!item) {
      return undefined;
    }

    const anterior = { ...item };
    item.cantidad = cantidad;
    return anterior;
  }

  restaurarItem(item: ItemCarrito): void {
    const indice = this.#items.findIndex(
      (actual) => actual.productoId === item.productoId,
    );

    const copia = { ...item };

    if (indice === -1) {
      this.#items.push(copia);
      return;
    }

    this.#items[indice] = copia;
  }

  restaurarItems(items: readonly ItemCarrito[]): void {
    this.#items = items.map((item) => ({ ...item }));
  }

  limpiar(): void {
    this.#items = [];
  }
}