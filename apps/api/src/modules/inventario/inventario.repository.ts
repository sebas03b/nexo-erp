import type { Kysely } from 'kysely';

import { DomainError } from '../../shared/errors/domain-error.js';
import {
  traducirErrorBd,
  type TraduccionesErrorBd,
} from '../../shared/db/errores-postgres.js';
import type { Database } from '../../shared/db/schema.js';
import type { Producto, Stock } from './domain/producto.js';

export interface CrearProductoData {
  sku: string;
  nombre: string;
  precio: number;
  tipo: string;
}

export type ActualizarProductoData = Partial<CrearProductoData>;

const TRADUCCIONES_PRODUCTO: TraduccionesErrorBd = {
  '23505': {
    code: 'SKU_DUPLICADO',
    message: 'Ya existe un producto con ese SKU',
    statusCode: 409,
  },
};

const TRADUCCIONES_ELIMINACION: TraduccionesErrorBd = {
  '23503': {
    code: 'PRODUCTO_EN_USO',
    message: 'El producto está referenciado por otros registros',
    statusCode: 409,
  },
};

const TRADUCCIONES_STOCK: TraduccionesErrorBd = {
  '23503': {
    code: 'PRODUCTO_NO_ENCONTRADO',
    message: 'Producto no encontrado',
    statusCode: 404,
  },
  '23514': {
    code: 'STOCK_INVALIDO',
    message: 'La cantidad de stock no es válida',
    statusCode: 400,
  },
};

interface ProductoRow {
  id: string;
  sku: string;
  nombre: string;
  precio: string;
  tipo: string;
}

function mapProducto(row: ProductoRow): Producto {
  return {
    id: row.id,
    sku: row.sku,
    nombre: row.nombre,
    precio: Number(row.precio),
    tipo: row.tipo,
  };
}

export class InventarioRepository {
  readonly #db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.#db = db;
  }

  async listarProductos(): Promise<Producto[]> {
    const rows = await this.#db.selectFrom('productos').selectAll().orderBy('nombre').execute();

    return rows.map(mapProducto);
  }

  async obtenerProducto(id: string): Promise<Producto | undefined> {
    const row = await this.#db
      .selectFrom('productos')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? mapProducto(row) : undefined;
  }

  async obtenerProductoPorSku(sku: string): Promise<Producto | undefined> {
    const row = await this.#db
      .selectFrom('productos')
      .selectAll()
      .where('sku', '=', sku)
      .executeTakeFirst();

    return row ? mapProducto(row) : undefined;
  }

  async crearProducto(data: CrearProductoData): Promise<Producto> {
    try {
      const row = await this.#db
        .insertInto('productos')
        .values(data)
        .returningAll()
        .executeTakeFirstOrThrow();

      return mapProducto(row);
    } catch (error) {
      traducirErrorBd(error, TRADUCCIONES_PRODUCTO);
    }
  }

  async actualizarProducto(
    id: string,
    data: ActualizarProductoData,
  ): Promise<Producto | undefined> {
    const changes: ActualizarProductoData = {};

    if (data.sku !== undefined) changes.sku = data.sku;
    if (data.nombre !== undefined) changes.nombre = data.nombre;
    if (data.precio !== undefined) changes.precio = data.precio;
    if (data.tipo !== undefined) changes.tipo = data.tipo;

    if (Object.keys(changes).length === 0) {
      return this.obtenerProducto(id);
    }

    try {
      const row = await this.#db
        .updateTable('productos')
        .set(changes)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      return row ? mapProducto(row) : undefined;
    } catch (error) {
      traducirErrorBd(error, TRADUCCIONES_PRODUCTO);
    }
  }

  async eliminarProducto(id: string): Promise<boolean> {
    try {
      const result = await this.#db
        .deleteFrom('productos')
        .where('id', '=', id)
        .executeTakeFirst();

      return Number(result.numDeletedRows) > 0;
    } catch (error) {
      traducirErrorBd(error, TRADUCCIONES_ELIMINACION);
    }
  }

  async listarStock(): Promise<Stock[]> {
    const rows = await this.#db.selectFrom('stock').selectAll().orderBy('producto_id').execute();

    return rows.map((row) => ({ productoId: row.producto_id, cantidad: row.cantidad }));
  }

  async obtenerStock(productoId: string): Promise<Stock | undefined> {
    const row = await this.#db
      .selectFrom('stock')
      .selectAll()
      .where('producto_id', '=', productoId)
      .executeTakeFirst();

    return row ? { productoId: row.producto_id, cantidad: row.cantidad } : undefined;
  }

  async fijarStock(productoId: string, cantidad: number): Promise<Stock> {
    try {
      const row = await this.#db
        .insertInto('stock')
        .values({ producto_id: productoId, cantidad })
        .onConflict((conflict) =>
          conflict.column('producto_id').doUpdateSet({ cantidad }),
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      return { productoId: row.producto_id, cantidad: row.cantidad };
    } catch (error) {
      traducirErrorBd(error, TRADUCCIONES_STOCK);
    }
  }

  async eliminarStock(productoId: string): Promise<boolean> {
    const result = await this.#db
      .deleteFrom('stock')
      .where('producto_id', '=', productoId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async decrementarStock(productoId: string, cantidad: number): Promise<void> {
    const stock = await this.obtenerStock(productoId);

    if (!stock || stock.cantidad < cantidad) {
      throw new DomainError('Stock insuficiente', {
        code: 'STOCK_INSUFICIENTE',
        statusCode: 409,
      });
    }

    await this.#db
      .updateTable('stock')
      .set({ cantidad: stock.cantidad - cantidad })
      .where('producto_id', '=', productoId)
      .execute();
  }

  async obtenerPrecio(productoId: string): Promise<number | null> {
    const row = await this.#db
      .selectFrom('productos')
      .select('precio')
      .where('id', '=', productoId)
      .executeTakeFirst();

    return row ? Number(row.precio) : null;
  }
}
