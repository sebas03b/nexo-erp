// Patrón: Command

import { randomUUID } from 'node:crypto';

export interface ItemCarrito {
  itemId: string;
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

  obtenerItemPorId(itemId: string): ItemCarrito | undefined {
    const item = this.#items.find((actual) => actual.itemId === itemId);
    return item ? { ...item } : undefined;
  }

  agregarItem(
    productoId: string,
    cantidad: number,
    precioUnitario: number,
    opts?: { itemId?: string; lineaIndependiente?: boolean },
  ): ItemCarrito {
    const lineaIndependiente = opts?.lineaIndependiente ?? false;
    if (!lineaIndependiente) {
      const existente = this.#items.find((item) => item.productoId === productoId);
      if (existente) {
        existente.cantidad += cantidad;
        return { ...existente };
      }
    }

    const nuevo: ItemCarrito = {
      itemId: opts?.itemId ?? randomUUID(),
      productoId,
      cantidad,
      precioUnitario,
    };
    this.#items.push(nuevo);
    return { ...nuevo };
  }

  quitarItem(productoId: string): ItemCarrito | undefined {
    const indice = this.#items.findIndex((item) => item.productoId === productoId);
    if (indice === -1) return undefined;
    const [removido] = this.#items.splice(indice, 1);
    return removido ? { ...removido } : undefined;
  }

  quitarItemPorId(itemId: string): ItemCarrito | undefined {
    const indice = this.#items.findIndex((item) => item.itemId === itemId);
    if (indice === -1) return undefined;
    const [removido] = this.#items.splice(indice, 1);
    return removido ? { ...removido } : undefined;
  }

  restarCantidad(productoId: string, cantidad: number): ItemCarrito | undefined {
    const item = this.#items.find((actual) => actual.productoId === productoId);
    if (!item) return undefined;
    const anterior = { ...item };
    item.cantidad -= cantidad;
    if (item.cantidad <= 0) {
      this.#items = this.#items.filter((actual) => actual.itemId !== item.itemId);
    }
    return anterior;
  }

  fijarCantidad(productoId: string, cantidad: number): ItemCarrito | undefined {
    const item = this.#items.find((actual) => actual.productoId === productoId);
    if (!item) return undefined;
    const anterior = { ...item };
    item.cantidad = cantidad;
    return anterior;
  }

  restaurarItem(item: ItemCarrito): void {
    const copia = { ...item };
    const porId = this.#items.findIndex((actual) => actual.itemId === copia.itemId);
    if (porId !== -1) {
      this.#items[porId] = copia;
      return;
    }
    const porProducto = this.#items.findIndex((actual) => actual.productoId === copia.productoId);
    if (porProducto !== -1) {
      this.#items[porProducto] = copia;
      return;
    }
    this.#items.push(copia);
  }

  restaurarItems(items: readonly ItemCarrito[]): void {
    this.#items = items.map((item) => ({ ...item }));
  }

  limpiar(): void {
    this.#items = [];
  }
}