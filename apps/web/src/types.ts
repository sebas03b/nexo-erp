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

export const CANALES_NOTIFICACION = [
  'email',
  'sms',
  'whatsapp',
] as const;

export type CanalNotificacion = (typeof CANALES_NOTIFICACION)[number];
export type CanalPreferido = CanalNotificacion;

const canalesValidos = new Set<string>(CANALES_NOTIFICACION);

export function esCanalNotificacion(valor: unknown): valor is CanalNotificacion {
  return typeof valor === 'string' && canalesValidos.has(valor);
}

export function normalizarCanalNotificacion(valor: unknown): CanalNotificacion {
  return esCanalNotificacion(valor) ? valor : 'email';
}

export interface Cliente {
  id: string;
  nombre: string;
  documento: string;
  email: string | null;
  telefono: string | null;
  canalPreferido: CanalPreferido;
}

export interface Empleado {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
}

export const ESTADOS_CITA = [
  'Pendiente',
  'Confirmada',
  'En Proceso',
  'Completada',
  'Cancelada',
] as const;

export type EstadoCita = (typeof ESTADOS_CITA)[number];

export interface Cita {
  id: string;
  clienteId: string;
  clienteNombre: string;
  empleadoId: string;
  empleadoNombre: string;
  inicio: string;
  fin: string;
  estado: EstadoCita;
  motivo: string | null;
}

export interface CrearCitaPayload {
  clienteId: string;
  empleadoId: string;
  inicio: string;
  fin: string;
  motivo?: string;
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
  items?: PedidoItem[];
}

export interface ItemCarrito {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
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
