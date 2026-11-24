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

export interface CajasTable {
  id: Generated<string>;
  usuario_id: string;
  apertura: Generated<Date>;
  cierre: Date | null;
  monto_inicial: NumericColumn;
  monto_final: NumericColumn | null;
}

export interface CarritosTable {
  id: Generated<string>;
  estado: 'Abierto' | 'Cerrado' | 'Descartado';
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface CarritoItemsTable {
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

export type EstadoCitaPersistido =
  | 'Pendiente'
  | 'Confirmada'
  | 'En Proceso'
  | 'Completada'
  | 'Cancelada';

export interface EmpleadosTable {
  id: Generated<string>;
  nombre: string;
  email: string | null;
  telefono: string | null;
  activo: Generated<boolean>;
  salario_base: NumericColumn;
}

export interface ConceptosNominaTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  tipo: 'devengo' | 'deduccion';
  activo: Generated<boolean>;
  creado_en: Generated<Date>;
}

export interface LiquidacionesTable {
  id: Generated<string>;
  empleado_id: string;
  periodo: string;
  salario_base: NumericColumn;
  total_devengos: NumericColumn;
  total_deducciones: NumericColumn;
  neto_a_pagar: NumericColumn;
  detalle: ColumnType<object, string, string>;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface CitasTable {
  id: Generated<string>;
  cliente_id: string;
  empleado_id: string;
  inicio: Date;
  fin: Date;
  estado: Generated<EstadoCitaPersistido>;
  motivo: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface AsientosTable {
  id: Generated<string>;
  fecha: Generated<Date>;
  cuenta: string;
  debito: NumericColumn;
  credito: NumericColumn;
  origen_id: string;
  metodo_pago: string | null;
  descripcion: string | null;
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
  cajas: CajasTable;
  asientos: AsientosTable;
  conceptos_nomina: ConceptosNominaTable;
  liquidaciones: LiquidacionesTable;
  empleados: EmpleadosTable;
  citas: CitasTable;
}
