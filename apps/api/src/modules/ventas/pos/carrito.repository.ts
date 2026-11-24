// Patrón: Command

import { randomUUID } from 'node:crypto';

import type { Kysely } from 'kysely';

import {
  traducirErrorBd,
  type TraduccionesErrorBd,
} from '../../../shared/db/errores-postgres.js';
import type { Database } from '../../../shared/db/schema.js';
import type { ItemCarrito } from './commands/carrito.js';

type Executor = Kysely<Database>;

export type TipoComandoCarrito =
  | 'AGREGAR_ITEM'
  | 'DECREMENTAR_ITEM'
  | 'QUITAR_ITEM'
  | 'ESTABLECER_CANTIDAD';

export interface ComandoCarritoPersistido {
  id: string;
  carritoId: string;
  tipo: TipoComandoCarrito;
  payload: Record<string, unknown>;
  estadoAnterior: ItemCarrito | null;
  itemRemovido: ItemCarrito | null;
  deshecho: boolean;
  creadoEn: Date;
}

export interface CarritoPersistido {
  id: string;
  estado: 'Abierto' | 'Cerrado' | 'Descartado';
  items: ItemCarrito[];
}

interface CarritoItemRow {
  id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: string;
}

interface CarritoComandoRow {
  id: string;
  carrito_id: string;
  tipo: TipoComandoCarrito;
  payload: unknown;
  estado_anterior: unknown;
  item_removido: unknown;
  deshecho: boolean;
  creado_en: Date;
}

const TRADUCCIONES_CARRITO: TraduccionesErrorBd = {
  '23503': {
    code: 'CARRITO_REFERENCIA_INVALIDA',
    message: 'El carrito referencia un producto inexistente',
    statusCode: 409,
  },
};

function mapItem(row: CarritoItemRow): ItemCarrito {
  return {
    itemId: row.id,
    productoId: row.producto_id,
    cantidad: row.cantidad,
    precioUnitario: Number(row.precio_unitario),
  };
}

function asItemCarrito(value: unknown): ItemCarrito | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (
    typeof obj.productoId !== 'string' ||
    typeof obj.cantidad !== 'number' ||
    typeof obj.precioUnitario !== 'number'
  ) {
    return null;
  }
  const itemId = typeof obj.itemId === 'string' ? obj.itemId : randomUUID();
  return {
    itemId,
    productoId: obj.productoId,
    cantidad: obj.cantidad,
    precioUnitario: obj.precioUnitario,
  };
}

function mapComando(row: CarritoComandoRow): ComandoCarritoPersistido {
  return {
    id: row.id,
    carritoId: row.carrito_id,
    tipo: row.tipo,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    estadoAnterior: asItemCarrito(row.estado_anterior),
    itemRemovido: asItemCarrito(row.item_removido),
    deshecho: row.deshecho,
    creadoEn: row.creado_en,
  };
}

export class CarritoRepository {
  constructor(_db: Kysely<Database>) {
    // db retained for constructor parity; methods take explicit executors.
    void _db;
  }

  async crearCarrito(executor: Executor): Promise<string> {
    const row = await executor
      .insertInto('carritos')
      .values({ estado: 'Abierto' })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async obtenerCarrito(
    executor: Executor,
    id: string,
  ): Promise<CarritoPersistido | undefined> {
    const carrito = await executor
      .selectFrom('carritos')
      .select(['id', 'estado'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!carrito) return undefined;

    const items = await executor
      .selectFrom('carrito_items')
      .select(['id', 'producto_id', 'cantidad', 'precio_unitario'])
      .where('carrito_id', '=', id)
      .orderBy('producto_id')
      .orderBy('id')
      .execute();

    return {
      id: carrito.id,
      estado: carrito.estado,
      items: items.map(mapItem),
    };
  }

  async guardarItems(
    executor: Executor,
    carritoId: string,
    items: readonly ItemCarrito[],
  ): Promise<void> {
    try {
      await executor
        .deleteFrom('carrito_items')
        .where('carrito_id', '=', carritoId)
        .execute();

      if (items.length > 0) {
        await executor
          .insertInto('carrito_items')
          .values(
            items.map((item) => ({
              id: item.itemId,
              carrito_id: carritoId,
              producto_id: item.productoId,
              cantidad: item.cantidad,
              precio_unitario: item.precioUnitario,
            })),
          )
          .execute();
      }

      await executor
        .updateTable('carritos')
        .set({ actualizado_en: new Date() })
        .where('id', '=', carritoId)
        .execute();
    } catch (error) {
      traducirErrorBd(error, TRADUCCIONES_CARRITO);
    }
  }

  async registrarComando(
    executor: Executor,
    data: {
      carritoId: string;
      tipo: TipoComandoCarrito;
      payload: Record<string, unknown>;
      estadoAnterior: ItemCarrito | null;
      itemRemovido: ItemCarrito | null;
    },
  ): Promise<void> {
    await executor
      .insertInto('carrito_comandos')
      .values({
        carrito_id: data.carritoId,
        tipo: data.tipo,
        payload: JSON.stringify(data.payload),
        estado_anterior:
          data.estadoAnterior === null ? null : JSON.stringify(data.estadoAnterior),
        item_removido:
          data.itemRemovido === null ? null : JSON.stringify(data.itemRemovido),
        deshecho: false,
      })
      .execute();
  }

  async obtenerUltimoComandoNoDeshecho(
    executor: Executor,
    carritoId: string,
  ): Promise<ComandoCarritoPersistido | undefined> {
    const row = await executor
      .selectFrom('carrito_comandos')
      .selectAll()
      .where('carrito_id', '=', carritoId)
      .where('deshecho', '=', false)
      .orderBy('creado_en', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirst();

    return row ? mapComando(row) : undefined;
  }

  async marcarComandoDeshecho(executor: Executor, comandoId: string): Promise<void> {
    await executor
      .updateTable('carrito_comandos')
      .set({ deshecho: true })
      .where('id', '=', comandoId)
      .execute();
  }

  async actualizarEstado(
    executor: Executor,
    carritoId: string,
    estado: 'Abierto' | 'Cerrado' | 'Descartado',
  ): Promise<boolean> {
    const result = await executor
      .updateTable('carritos')
      .set({ estado, actualizado_en: new Date() })
      .where('id', '=', carritoId)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) > 0;
  }
}