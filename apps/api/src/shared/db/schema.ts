import type { ColumnType, Generated } from 'kysely';

type NumericColumn = ColumnType<string, number | string, number | string>;

export interface UsuariosTable {
  id: Generated<string>;
  nombre: string;
  rol: string;
  hash_password: string;
}

export interface ClientesTable {
  id: Generated<string>;
  nombre: string;
  documento: string;
  email: string | null;
  telefono: string | null;
  canal_preferido: string | null;
}

export interface OutboxEventsTable {
  id: Generated<string>;
  correlation_id: string;
  tipo: string;
  payload: ColumnType<object, string, string>;
  creado_en: Generated<Date>;
  procesado_en: Date | null;
}

export interface ProductosTable {
  id: Generated<string>;
  sku: string;
  nombre: string;
  precio: NumericColumn;
  tipo: string;
}

export interface StockTable {
  producto_id: string;
  cantidad: number;
}

export interface PedidosTable {
  id: Generated<string>;
  cliente_id: string;
  estado: string;
  subtotal: NumericColumn;
  descuento: NumericColumn;
  impuesto: NumericColumn;
  total: NumericColumn;
  created_at: Generated<Date>;
}

export interface PedidoItemsTable {
  pedido_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: NumericColumn;
}

export interface FacturasTable {
  id: Generated<string>;
  pedido_id: string;
  numero: string;
  estado: string;
  payload_externo: string | null;
}

export interface CarritosTable {
  id: Generated<string>;
  estado: 'Abierto' | 'Cerrado' | 'Descartado';
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface CarritoItemsTable {
  id: Generated<string>;
  carrito_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: NumericColumn;
}

export interface CarritoComandosTable {
  id: Generated<string>;
  carrito_id: string;
  tipo: 'AGREGAR_ITEM' | 'DECREMENTAR_ITEM' | 'QUITAR_ITEM' | 'ESTABLECER_CANTIDAD';
  payload: ColumnType<object, string, string>;
  estado_anterior: ColumnType<object | null, string | null, string | null>;
  item_removido: ColumnType<object | null, string | null, string | null>;
  deshecho: Generated<boolean>;
  creado_en: Generated<Date>;
}

export interface CitasTable {
  id: Generated<string>;
  cliente_id: string;
  empleado_id: string | null;
  inicio: Generated<Date> | Date;
  fin: Date;
  estado: 'Pendiente' | 'Confirmada' | 'En Proceso' | 'Completada' | 'Cancelada';
  notas: string | null;
  created_at: Generated<Date>;
}

export interface Database {
  usuarios: UsuariosTable;
  clientes: ClientesTable;
  outbox_events: OutboxEventsTable;
  productos: ProductosTable;
  stock: StockTable;
  pedidos: PedidosTable;
  pedido_items: PedidoItemsTable;
  facturas: FacturasTable;
  carritos: CarritosTable;
  carrito_items: CarritoItemsTable;
  carrito_comandos: CarritoComandosTable;
  citas: CitasTable;
}
