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
  payload_externo: ColumnType<object | null, string | null, string | null>;
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
}
