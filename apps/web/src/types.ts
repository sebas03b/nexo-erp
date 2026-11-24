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

export type CanalPreferido = 'email' | 'sms' | 'whatsapp';

export interface Cliente {
  id: string;
  nombre: string;
  documento: string;
  email: string | null;
  telefono: string | null;
  canalPreferido: CanalPreferido;
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
  createdAt?: string;
  payloadExterno?: string | null;
  items?: PedidoItem[];
}

export interface AgendamientoServicio {
  inicio: string;
  fin: string;
  notas?: string;
}

export interface ItemCarrito {
  itemId: string;
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  agendamiento?: AgendamientoServicio;
}

export interface Carrito {
  id: string;
  estado: 'Abierto' | 'Cerrado' | 'Descartado';
  items: ItemCarrito[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
}

export interface Cita {
  id: string;
  clienteId: string;
  clienteNombre?: string;
  empleadoId?: string;
  inicio: string;
  fin: string;
  estado: 'Pendiente' | 'Confirmada' | 'En Proceso' | 'Completada' | 'Cancelada';
  notas?: string;
}
