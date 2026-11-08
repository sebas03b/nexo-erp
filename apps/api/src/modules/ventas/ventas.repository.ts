import { sql, type Kysely } from 'kysely';

import {
  traducirErrorBd,
  type TraduccionesErrorBd,
} from '../../shared/db/errores-postgres.js';
import type { Database } from '../../shared/db/schema.js';
import { Factura } from './domain/factura.js';
import { Pedido, type PedidoItem } from './domain/pedido.js';
import type { PedidoDetalle, PedidoItemDetalle } from './domain/pedido-detalle.js';
import { esEstadoPedido, type EstadoPedido } from './domain/pedido-estado.js';

type Executor = Kysely<Database>;

interface PedidoRow {
  id: string;
  cliente_id: string;
  estado: string;
  subtotal: string;
  descuento: string;
  impuesto: string;
  total: string;
  created_at: Date;
}

interface PedidoDetalleRow extends PedidoRow {
  cliente_nombre: string;
  cliente_documento: string;
}

interface PedidoItemRow {
  pedido_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: string;
}

interface PedidoItemDetalleRow extends PedidoItemRow {
  producto_nombre: string;
}

interface FacturaRow {
  id: string;
  pedido_id: string;
  numero: string;
  estado: string;
  payload_externo: object | null;
}

const TRADUCCIONES_PEDIDO: TraduccionesErrorBd = {
  '23503': {
    code: 'PEDIDO_REFERENCIA_INVALIDA',
    message: 'El pedido referencia un cliente o producto inexistente',
    statusCode: 409,
  },
  '23505': {
    code: 'PEDIDO_DUPLICADO',
    message: 'El pedido ya existe',
    statusCode: 409,
  },
};

const TRADUCCIONES_FACTURA: TraduccionesErrorBd = {
  '23503': {
    code: 'FACTURA_PEDIDO_INVALIDO',
    message: 'La factura referencia un pedido inexistente',
    statusCode: 409,
  },
  '23505': {
    code: 'FACTURA_EXISTENTE',
    message: 'El pedido ya tiene una factura emitida',
    statusCode: 409,
  },
};

const TRADUCCIONES_ELIMINACION_PEDIDO: TraduccionesErrorBd = {
  '23503': {
    code: 'PEDIDO_EN_USO',
    message:
      'El pedido tiene una factura asociada y no se puede eliminar',
    statusCode: 409,
  },
};

function mapItem(row: PedidoItemRow): PedidoItem {
  return {
    productoId: row.producto_id,
    cantidad: row.cantidad,
    precioUnitario: Number(row.precio_unitario),
  };
}

function mapItemDetalle(row: PedidoItemDetalleRow): PedidoItemDetalle {
  return {
    productoId: row.producto_id,
    productoNombre: row.producto_nombre,
    cantidad: row.cantidad,
    precioUnitario: Number(row.precio_unitario),
  };
}

function mapPedido(row: PedidoRow, items: readonly PedidoItem[]): Pedido {
  if (!esEstadoPedido(row.estado)) {
    throw new Error(`Estado de pedido desconocido en base de datos: ${row.estado}`);
  }

  return new Pedido({
    id: row.id,
    clienteId: row.cliente_id,
    estado: row.estado,
    subtotal: Number(row.subtotal),
    descuento: Number(row.descuento),
    impuesto: Number(row.impuesto),
    total: Number(row.total),
    items,
  });
}

function mapPedidoDetalle(
  row: PedidoDetalleRow,
  items: readonly PedidoItemDetalle[],
): PedidoDetalle {
  if (!esEstadoPedido(row.estado)) {
    throw new Error(`Estado de pedido desconocido en base de datos: ${row.estado}`);
  }

  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNombre: row.cliente_nombre,
    clienteDocumento: row.cliente_documento,
    estado: row.estado,
    subtotal: Number(row.subtotal),
    descuento: Number(row.descuento),
    impuesto: Number(row.impuesto),
    total: Number(row.total),
    createdAt: row.created_at.toISOString(),
    items: [...items],
  };
}

function mapFactura(row: FacturaRow): Factura {
  return new Factura({
    id: row.id,
    pedidoId: row.pedido_id,
    numero: row.numero,
    estado: row.estado,
    payloadExterno: row.payload_externo,
  });
}

export class VentasRepository {
  readonly #db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.#db = db;
  }

  /**
   * El repositorio nunca abre transacciones: recibe el ejecutor (la conexión o
   * la transacción) que le entrega el UnitOfWork.
   */
  async crearPedido(executor: Executor, pedido: Pedido): Promise<void> {
    try {
      await executor
        .insertInto('pedidos')
        .values({
          id: pedido.id,
          cliente_id: pedido.clienteId,
          estado: pedido.estado,
          subtotal: pedido.subtotal,
          descuento: pedido.descuento,
          impuesto: pedido.impuesto,
          total: pedido.total,
        })
        .execute();

      await executor
        .insertInto('pedido_items')
        .values(
          pedido.items.map((item) => ({
            pedido_id: pedido.id,
            producto_id: item.productoId,
            cantidad: item.cantidad,
            precio_unitario: item.precioUnitario,
          })),
        )
        .execute();
    } catch (error) {
      traducirErrorBd(error, TRADUCCIONES_PEDIDO);
    }
  }

  async eliminarPedido(id: string): Promise<boolean> {
    try {
      const result = await this.#db
        .deleteFrom('pedidos')
        .where('id', '=', id)
        .executeTakeFirst();

      return Number(result.numDeletedRows) > 0;
    } catch (error) {
      traducirErrorBd(error, TRADUCCIONES_ELIMINACION_PEDIDO);
    }
  }

  async listarPedidos(): Promise<PedidoDetalle[]> {
    const pedidoRows = await this.#db
      .selectFrom('pedidos')
      .innerJoin('clientes', 'clientes.id', 'pedidos.cliente_id')
      .select([
        'pedidos.id',
        'pedidos.cliente_id',
        'pedidos.estado',
        'pedidos.subtotal',
        'pedidos.descuento',
        'pedidos.impuesto',
        'pedidos.total',
        'pedidos.created_at',
        'clientes.nombre as cliente_nombre',
        'clientes.documento as cliente_documento',
      ])
      .orderBy('pedidos.created_at', 'desc')
      .execute();

    if (pedidoRows.length === 0) {
      return [];
    }

    const pedidoIds = pedidoRows.map((row) => row.id);
    const itemRows = await this.#db
      .selectFrom('pedido_items')
      .innerJoin('productos', 'productos.id', 'pedido_items.producto_id')
      .select([
        'pedido_items.pedido_id',
        'pedido_items.producto_id',
        'pedido_items.cantidad',
        'pedido_items.precio_unitario',
        'productos.nombre as producto_nombre',
      ])
      .where('pedido_items.pedido_id', 'in', pedidoIds)
      .orderBy('pedido_items.producto_id')
      .execute();

    const itemsPorPedido = new Map<string, PedidoItemDetalle[]>();

    for (const itemRow of itemRows) {
      const items = itemsPorPedido.get(itemRow.pedido_id) ?? [];
      items.push(mapItemDetalle(itemRow));
      itemsPorPedido.set(itemRow.pedido_id, items);
    }

    return pedidoRows.map((row) =>
      mapPedidoDetalle(row, itemsPorPedido.get(row.id) ?? []),
    );
  }

  async obtenerPedido(id: string): Promise<Pedido | undefined> {
    const pedidoRow = await this.#db
      .selectFrom('pedidos')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!pedidoRow) {
      return undefined;
    }

    const itemRows = await this.#db
      .selectFrom('pedido_items')
      .selectAll()
      .where('pedido_id', '=', id)
      .execute();

    return mapPedido(pedidoRow, itemRows.map(mapItem));
  }

  async obtenerPedidoDetalle(id: string): Promise<PedidoDetalle | undefined> {
    const pedidoRow = await this.#db
      .selectFrom('pedidos')
      .innerJoin('clientes', 'clientes.id', 'pedidos.cliente_id')
      .select([
        'pedidos.id',
        'pedidos.cliente_id',
        'pedidos.estado',
        'pedidos.subtotal',
        'pedidos.descuento',
        'pedidos.impuesto',
        'pedidos.total',
        'pedidos.created_at',
        'clientes.nombre as cliente_nombre',
        'clientes.documento as cliente_documento',
      ])
      .where('pedidos.id', '=', id)
      .executeTakeFirst();

    if (!pedidoRow) {
      return undefined;
    }

    const itemRows = await this.#db
      .selectFrom('pedido_items')
      .innerJoin('productos', 'productos.id', 'pedido_items.producto_id')
      .select([
        'pedido_items.pedido_id',
        'pedido_items.producto_id',
        'pedido_items.cantidad',
        'pedido_items.precio_unitario',
        'productos.nombre as producto_nombre',
      ])
      .where('pedido_items.pedido_id', '=', id)
      .orderBy('pedido_items.producto_id')
      .execute();

    return mapPedidoDetalle(pedidoRow, itemRows.map(mapItemDetalle));
  }

  /**
   * Actualización con control de concurrencia optimista: solo modifica la fila
   * si sigue en el estado que leyó el caso de uso.
   */
  async actualizarEstado(
    executor: Executor,
    id: string,
    estadoEsperado: EstadoPedido,
    estadoNuevo: EstadoPedido,
  ): Promise<boolean> {
    const result = await executor
      .updateTable('pedidos')
      .set({ estado: estadoNuevo })
      .where('id', '=', id)
      .where('estado', '=', estadoEsperado)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  /**
   * nextval() es atómico incluso con peticiones concurrentes; por eso la
   * numeración no depende de contar filas existentes.
   */
  async siguienteNumeroFactura(executor: Executor): Promise<string> {
    const result = await sql<{ numero: string }>`
      select 'FAC-' || lpad(nextval('facturas_numero_seq')::text, 6, '0') as numero
    `.execute(executor);

    const numero = result.rows[0]?.numero;

    if (numero === undefined) {
      throw new Error('La secuencia de facturas no devolvió un número');
    }

    return numero;
  }

  async crearFactura(executor: Executor, factura: Factura): Promise<void> {
    try {
      await executor
        .insertInto('facturas')
        .values({
          id: factura.id,
          pedido_id: factura.pedidoId,
          numero: factura.numero,
          estado: factura.estado,
          payload_externo:
            factura.payloadExterno === null ? null : JSON.stringify(factura.payloadExterno),
        })
        .execute();
    } catch (error) {
      traducirErrorBd(error, TRADUCCIONES_FACTURA);
    }
  }

  async listarFacturas(): Promise<Factura[]> {
    const rows = await this.#db.selectFrom('facturas').selectAll().orderBy('numero').execute();

    return rows.map(mapFactura);
  }

  async obtenerFactura(id: string): Promise<Factura | undefined> {
    const row = await this.#db
      .selectFrom('facturas')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? mapFactura(row) : undefined;
  }

  async obtenerFacturaPorPedido(pedidoId: string): Promise<Factura | undefined> {
    const row = await this.#db
      .selectFrom('facturas')
      .selectAll()
      .where('pedido_id', '=', pedidoId)
      .executeTakeFirst();

    return row ? mapFactura(row) : undefined;
  }
}
