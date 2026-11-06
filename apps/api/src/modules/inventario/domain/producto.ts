export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  tipo: string;
}

export interface Stock {
  productoId: string;
  cantidad: number;
}
