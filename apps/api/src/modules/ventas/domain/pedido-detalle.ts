import type { EstadoPedido } from './pedido-estado.js';

export interface PedidoItemDetalle {
  productoId: string;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface PedidoDetalle {
  id: string;
  clienteId: string;
  clienteNombre: string;
  clienteDocumento: string;
  estado: EstadoPedido;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  items: PedidoItemDetalle[];
}
