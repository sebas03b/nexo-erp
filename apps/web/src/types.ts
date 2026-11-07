export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  tipo: string;
}

export interface StockItem {
  productoId: string;
  cantidad: number;
}

export interface PedidoItem {
  productoId: string;
  productoNombre?: string;
  cantidad: number;
  precioUnitario: number;
}

export interface Pedido {
  id: string;
  clienteId: string;
  clienteNombre?: string;
  clienteDocumento?: string;
  estado: string;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  items?: PedidoItem[];
}
