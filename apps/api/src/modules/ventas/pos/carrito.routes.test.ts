import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { Kysely, PGliteDialect, sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../app.js';
import type { Database } from '../../../shared/db/schema.js';
import { SqlFileMigrationProvider } from '../../../shared/db/sql-file-migration.provider.js';

interface ProductoJson {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  tipo: string;
}

interface CarritoJson {
  id: string;
  estado: string;
  items: Array<{ itemId: string; productoId: string; cantidad: number; precioUnitario: number }>;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
}

const DOCUMENTO_CLIENTE = '123456789';
const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../../db/migrations', import.meta.url),
);

describe('Carrito POS - Command API', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;

  beforeAll(async () => {
    const pglite = new PGlite();
    db = new Kysely<Database>({ dialect: new PGliteDialect({ pglite }) });
    const migrator = new Migrator({
      db,
      provider: new SqlFileMigrationProvider(MIGRATIONS_DIRECTORY),
    });
    const { error } = await migrator.migrateToLatest();
    if (error) throw new Error('No se pudieron aplicar migraciones', { cause: error });
    app = await buildApp({ db });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  beforeEach(async () => {
    await db.deleteFrom('outbox_events').execute();
    await db.deleteFrom('facturas').execute();
    await db.deleteFrom('pedido_items').execute();
    await db.deleteFrom('pedidos').execute();
    await db.deleteFrom('carrito_comandos').execute();
    await db.deleteFrom('carrito_items').execute();
    await db.deleteFrom('carritos').execute();
    await db.deleteFrom('citas').execute();
    await db.deleteFrom('stock').execute();
    await db.deleteFrom('productos').execute();
    await db.deleteFrom('clientes').execute();
    await sql`alter sequence facturas_numero_seq restart with 1`.execute(db);

    await db
      .insertInto('clientes')
      .values({
        nombre: 'Cliente de prueba',
        documento: DOCUMENTO_CLIENTE,
        email: null,
        telefono: null,
        canal_preferido: null,
      })
      .execute();
  });

  async function crearProducto(precio = 100, cantidadStock = 10): Promise<ProductoJson> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/productos',
      payload: { sku: `SKU-${randomUUID()}`, nombre: 'Producto', precio, tipo: 'producto' },
    });
    expect(res.statusCode).toBe(201);
    const producto = res.json<ProductoJson>();
    await app.inject({
      method: 'PUT',
      url: `/api/stock/${producto.id}`,
      payload: { cantidad: cantidadStock },
    });
    return producto;
  }

  async function crearCarrito(): Promise<CarritoJson> {
    const res = await app.inject({ method: 'POST', url: '/api/carritos' });
    expect(res.statusCode).toBe(201);
    return res.json<CarritoJson>();
  }

  async function comando(carritoId: string, accion: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: `/api/carritos/${carritoId}/comandos`,
      payload: { accion, payload },
    });
  }

  it('crea carrito, agrega con precio del catálogo y calcula totales', async () => {
    const producto = await crearProducto(100, 10);
    const carrito = await crearCarrito();

    const res = await comando(carrito.id, 'AGREGAR_ITEM', { productoId: producto.id, cantidad: 2 });
    expect(res.statusCode).toBe(200);
    const body = res.json<CarritoJson>();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ productoId: producto.id, cantidad: 2, precioUnitario: 100 });
    expect(body.items[0]?.itemId).toEqual(expect.any(String));
    expect(body.subtotal).toBe(200);
    expect(body.total).toBe(200);
  });

  it('devuelve 409 por stock insuficiente y 404 por producto inexistente', async () => {
    const producto = await crearProducto(100, 1);
    const carrito = await crearCarrito();

    const stockInsuf = await comando(carrito.id, 'AGREGAR_ITEM', { productoId: producto.id, cantidad: 2 });
    expect(stockInsuf.statusCode).toBe(409);
    expect(stockInsuf.json()).toMatchObject({ error: { code: 'STOCK_INSUFICIENTE' } });

    const inexistente = await comando(carrito.id, 'AGREGAR_ITEM', {
      productoId: randomUUID(),
      cantidad: 1,
    });
    expect(inexistente.statusCode).toBe(404);
    expect(inexistente.json()).toMatchObject({ error: { code: 'PRODUCTO_NO_ENCONTRADO' } });
  });

  it('decrementa, quita, establece cantidad y deshace comandos', async () => {
    const producto = await crearProducto(100, 10);
    const carrito = await crearCarrito();

    await comando(carrito.id, 'AGREGAR_ITEM', { productoId: producto.id, cantidad: 3 });
    const dec = await comando(carrito.id, 'DECREMENTAR_ITEM', { productoId: producto.id, cantidad: 1 });
    expect(dec.json<CarritoJson>().items[0]?.cantidad).toBe(2);

    const set = await comando(carrito.id, 'ESTABLECER_CANTIDAD', { productoId: producto.id, cantidad: 5 });
    expect(set.json<CarritoJson>().items[0]?.cantidad).toBe(5);

    const quit = await comando(carrito.id, 'QUITAR_ITEM', { productoId: producto.id });
    expect(quit.json<CarritoJson>().items).toHaveLength(0);

    // deshacer eliminación la restaura
    const undo1 = await app.inject({ method: 'POST', url: `/api/carritos/${carrito.id}/deshacer` });
    expect(undo1.statusCode).toBe(200);
    expect(undo1.json<CarritoJson>().items[0]?.cantidad).toBe(5);

    // deshacer establecer cantidad
    const undo2 = await app.inject({ method: 'POST', url: `/api/carritos/${carrito.id}/deshacer` });
    expect(undo2.json<CarritoJson>().items[0]?.cantidad).toBe(2);
  });

  it('deshacer un alta de línea nueva la elimina y persiste tras recargar', async () => {
    const producto = await crearProducto(100, 10);
    const carrito = await crearCarrito();

    await comando(carrito.id, 'AGREGAR_ITEM', { productoId: producto.id, cantidad: 1 });

    const undo = await app.inject({ method: 'POST', url: `/api/carritos/${carrito.id}/deshacer` });
    expect(undo.statusCode).toBe(200);
    expect(undo.json<CarritoJson>().items).toHaveLength(0);

    // "recargar": GET desde BD
    const recargado = await app.inject({ method: 'GET', url: `/api/carritos/${carrito.id}` });
    expect(recargado.statusCode).toBe(200);
    expect(recargado.json<CarritoJson>().items).toHaveLength(0);
  });

  it('checkout con carritoId crea pedido/factura, descuenta stock y cierra carrito', async () => {
    const producto = await crearProducto(100, 10);
    const carrito = await crearCarrito();
    await comando(carrito.id, 'AGREGAR_ITEM', { productoId: producto.id, cantidad: 2 });

    const checkout = await app.inject({
      method: 'POST',
      url: '/api/ventas/checkout',
      payload: { documentoCliente: DOCUMENTO_CLIENTE, carritoId: carrito.id, metodoPago: 'efectivo' },
    });

    expect(checkout.statusCode).toBe(201);
    const body = checkout.json<{ pedido: { estado: string }; factura: { numero: string } }>();
    expect(body.pedido.estado).toBe('Pagado');
    expect(body.factura.numero).toBe('FAC-000001');

    const stockRes = await app.inject({ method: 'GET', url: `/api/stock/${producto.id}` });
    expect(stockRes.json<{ cantidad: number }>().cantidad).toBe(8);

    const carritoRes = await app.inject({ method: 'GET', url: `/api/carritos/${carrito.id}` });
    expect(carritoRes.json<CarritoJson>().estado).toBe('Cerrado');
  });
});