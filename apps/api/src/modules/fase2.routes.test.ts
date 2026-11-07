import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { Kysely, PGliteDialect, sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';
import type { Database } from '../shared/db/schema.js';
import { SqlFileMigrationProvider } from '../shared/db/sql-file-migration.provider.js';
import { InventarioRepository } from './inventario/inventario.repository.js';
import { PagoEfectivo } from './ventas/domain/payments/pago-efectivo.strategy.js';
import { PagoPasarela } from './ventas/domain/payments/pago-pasarela.strategy.js';
import { Pedido } from './ventas/domain/pedido.js';
import { DescuentoPorVolumen } from './ventas/domain/pricing/descuento-volumen.strategy.js';
import { ImpuestoIva } from './ventas/domain/pricing/impuesto-iva.strategy.js';
import { VentasRepository } from './ventas/ventas.repository.js';

interface ProductoJson {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  tipo: string;
}

interface PedidoJson {
  id: string;
  clienteId: string;
  clienteNombre?: string;
  clienteDocumento?: string;
  estado: string;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  items: Array<{
    productoId: string;
    productoNombre?: string;
    cantidad: number;
    precioUnitario: number;
  }>;
}

interface FacturaJson {
  id: string;
  pedidoId: string;
  numero: string;
  estado: string;
  payloadExterno: object | null;
}

const DOCUMENTO_CLIENTE = '123456789';

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../db/migrations', import.meta.url),
);

describe('Endpoints REST de inventario y ventas', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let clienteId: string;

  beforeAll(async () => {
    const pglite = new PGlite();

    db = new Kysely<Database>({
      dialect: new PGliteDialect({ pglite }),
    });

    const migrator = new Migrator({
      db,
      provider: new SqlFileMigrationProvider(MIGRATIONS_DIRECTORY),
    });
    const { error } = await migrator.migrateToLatest();

    if (error) {
      throw new Error('No se pudieron aplicar las migraciones de prueba', { cause: error });
    }

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
    await db.deleteFrom('stock').execute();
    await db.deleteFrom('productos').execute();
    await db.deleteFrom('clientes').execute();
    await sql`alter sequence facturas_numero_seq restart with 1`.execute(db);

    const cliente = await db
      .insertInto('clientes')
      .values({
        nombre: 'Cliente de prueba',
        documento: DOCUMENTO_CLIENTE,
        email: null,
        telefono: null,
        canal_preferido: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    clienteId = cliente.id;
  });

  async function crearProducto(precio = 100): Promise<ProductoJson> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/productos',
      payload: {
        sku: `SKU-${randomUUID()}`,
        nombre: 'Café de prueba',
        precio,
        tipo: 'producto',
      },
    });

    expect(response.statusCode).toBe(201);

    return response.json<ProductoJson>();
  }

  async function crearPedidoBorrador(): Promise<PedidoJson> {
    const producto = await crearProducto(100);
    const response = await app.inject({
      method: 'POST',
      url: '/api/pedidos',
      payload: {
        documentoCliente: DOCUMENTO_CLIENTE,
        items: [{ productoId: producto.id, cantidad: 1 }],
      },
    });

    expect(response.statusCode).toBe(201);

    return response.json<PedidoJson>();
  }

  async function crearPedidoPagado(): Promise<PedidoJson> {
    const pedido = await crearPedidoBorrador();

    const emision = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/emitir`,
    });
    expect(emision.statusCode).toBe(200);

    const pago = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/pagar`,
    });
    expect(pago.statusCode).toBe(200);

    return pedido;
  }

  it('permite el CRUD de productos y stock', async () => {
    const producto = await crearProducto();

    const listado = await app.inject({ method: 'GET', url: '/api/productos' });
    expect(listado.statusCode).toBe(200);
    expect(listado.json<ProductoJson[]>()).toEqual([producto]);

    const actualizacion = await app.inject({
      method: 'PATCH',
      url: `/api/productos/${producto.id}`,
      payload: { precio: 150, nombre: 'Café actualizado' },
    });
    expect(actualizacion.statusCode).toBe(200);
    expect(actualizacion.json<ProductoJson>()).toMatchObject({
      id: producto.id,
      nombre: 'Café actualizado',
      precio: 150,
    });

    const stock = await app.inject({
      method: 'PUT',
      url: `/api/stock/${producto.id}`,
      payload: { cantidad: 10 },
    });
    expect(stock.statusCode).toBe(200);
    expect(stock.json()).toEqual({ productoId: producto.id, cantidad: 10 });

    const consultaStock = await app.inject({
      method: 'GET',
      url: `/api/stock/${producto.id}`,
    });
    expect(consultaStock.statusCode).toBe(200);
    expect(consultaStock.json()).toEqual({ productoId: producto.id, cantidad: 10 });

    const eliminacion = await app.inject({
      method: 'DELETE',
      url: `/api/productos/${producto.id}`,
    });
    expect(eliminacion.statusCode).toBe(204);

    const listadoFinal = await app.inject({ method: 'GET', url: '/api/productos' });
    expect(listadoFinal.json<ProductoJson[]>()).toEqual([]);
  });

  it('crea pedidos, controla sus transiciones y emite la factura', async () => {
    const producto = await crearProducto(100);

    await app.inject({
      method: 'PUT',
      url: `/api/stock/${producto.id}`,
      payload: { cantidad: 5 },
    });

    const creacion = await app.inject({
      method: 'POST',
      url: '/api/pedidos',
      payload: {
        documentoCliente: `  ${DOCUMENTO_CLIENTE}  `,
        items: [{ productoId: producto.id, cantidad: 2 }],
        descuento: 10,
        impuesto: 5,
      },
    });

    expect(creacion.statusCode).toBe(201);

    const pedido = creacion.json<PedidoJson>();

    expect(pedido).toMatchObject({
      clienteId,
      estado: 'Borrador',
      subtotal: 200,
      descuento: 10,
      impuesto: 5,
      total: 195,
      items: [{ productoId: producto.id, cantidad: 2, precioUnitario: 100 }],
    });

    const pagoDesdeBorrador = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/pagar`,
    });
    expect(pagoDesdeBorrador.statusCode).toBe(409);
    expect(pagoDesdeBorrador.json()).toMatchObject({
      error: { code: 'TRANSICION_INVALIDA' },
    });

    const emision = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/emitir`,
    });
    expect(emision.statusCode).toBe(200);
    expect(emision.json<PedidoJson>().estado).toBe('Emitido');

    const pago = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/pagar`,
    });
    expect(pago.statusCode).toBe(200);
    expect(pago.json<PedidoJson>().estado).toBe('Pagado');

    const anulacion = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/anular`,
    });
    expect(anulacion.statusCode).toBe(409);
    expect(anulacion.json()).toMatchObject({
      error: { code: 'TRANSICION_INVALIDA' },
    });

    const factura = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/factura`,
    });
    expect(factura.statusCode).toBe(201);
    expect(factura.json<FacturaJson>()).toMatchObject({
      pedidoId: pedido.id,
      numero: 'FAC-000001',
      estado: 'Emitida',
      payloadExterno: null,
    });

    const facturas = await app.inject({ method: 'GET', url: '/api/facturas' });
    expect(facturas.statusCode).toBe(200);
    expect(facturas.json<FacturaJson[]>()).toHaveLength(1);

    const facturaDuplicada = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/factura`,
    });
    expect(facturaDuplicada.statusCode).toBe(409);
    expect(facturaDuplicada.json()).toMatchObject({
      error: { code: 'FACTURA_EXISTENTE' },
    });
  });

  it('expone datos legibles del cliente y de los productos en el listado y el detalle', async () => {
    const producto = await crearProducto(100);

    const creacion = await app.inject({
      method: 'POST',
      url: '/api/pedidos',
      payload: {
        documentoCliente: DOCUMENTO_CLIENTE,
        items: [{ productoId: producto.id, cantidad: 2 }],
      },
    });

    expect(creacion.statusCode).toBe(201);
    const pedido = creacion.json<PedidoJson>();

    const listado = await app.inject({ method: 'GET', url: '/api/pedidos' });
    expect(listado.statusCode).toBe(200);
    expect(listado.json<PedidoJson[]>()).toMatchObject([
      {
        id: pedido.id,
        clienteId,
        clienteNombre: 'Cliente de prueba',
        clienteDocumento: DOCUMENTO_CLIENTE,
        items: [
          {
            productoId: producto.id,
            productoNombre: 'Café de prueba',
            cantidad: 2,
            precioUnitario: 100,
          },
        ],
      },
    ]);

    const detalle = await app.inject({
      method: 'GET',
      url: `/api/pedidos/${pedido.id}`,
    });
    expect(detalle.statusCode).toBe(200);
    expect(detalle.json<PedidoJson>()).toMatchObject({
      id: pedido.id,
      clienteId,
      clienteNombre: 'Cliente de prueba',
      clienteDocumento: DOCUMENTO_CLIENTE,
      items: [
        {
          productoId: producto.id,
          productoNombre: 'Café de prueba',
          cantidad: 2,
          precioUnitario: 100,
        },
      ],
    });
  });

  it('cambia el total al cambiar las estrategias inyectadas sin tocar Pedido ni VentasService', async () => {
    const producto = await crearProducto(100);
    const appConOtrasEstrategias = await buildApp({
      db,
      estrategiasVentas: {
        descuento: new DescuentoPorVolumen([
          { subtotalMinimo: 100, porcentaje: 0.1 },
        ]),
        impuesto: new ImpuestoIva(0.19),
        pagos: {
          efectivo: new PagoEfectivo(),
          pasarela: new PagoPasarela(),
        },
      },
    });

    try {
      const response = await appConOtrasEstrategias.inject({
        method: 'POST',
        url: '/api/pedidos',
        payload: {
          documentoCliente: DOCUMENTO_CLIENTE,
          items: [{ productoId: producto.id, cantidad: 2 }],
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json<PedidoJson>()).toMatchObject({
        subtotal: 200,
        descuento: 20,
        impuesto: 34.2,
        total: 214.2,
      });
    } finally {
      await appConOtrasEstrategias.close();
    }
  });

  it('rechaza pedidos con datos inválidos o clientes inexistentes', async () => {
    const producto = await crearProducto();

    const clienteInexistente = await app.inject({
      method: 'POST',
      url: '/api/pedidos',
      payload: {
        documentoCliente: 'DOCUMENTO-INEXISTENTE',
        items: [{ productoId: producto.id, cantidad: 1 }],
      },
    });
    expect(clienteInexistente.statusCode).toBe(404);
    expect(clienteInexistente.json()).toMatchObject({
      error: { code: 'CLIENTE_NO_ENCONTRADO' },
    });

    const sinItems = await app.inject({
      method: 'POST',
      url: '/api/pedidos',
      payload: { documentoCliente: DOCUMENTO_CLIENTE, items: [] },
    });
    expect(sinItems.statusCode).toBe(400);
    expect(sinItems.json()).toMatchObject({
      error: { code: 'DATOS_INVALIDOS' },
    });
  });

  it('traduce las violaciones unique y de clave foránea a DomainError', async () => {
    const inventario = new InventarioRepository(db);
    const sku = `SKU-${randomUUID()}`;

    await inventario.crearProducto({
      sku,
      nombre: 'Producto original',
      precio: 10,
      tipo: 'producto',
    });

    await expect(
      inventario.crearProducto({
        sku,
        nombre: 'Producto duplicado',
        precio: 20,
        tipo: 'producto',
      }),
    ).rejects.toMatchObject({ code: 'SKU_DUPLICADO', statusCode: 409 });

    const ventas = new VentasRepository(db);
    const pedidoInvalido = new Pedido({
      id: randomUUID(),
      clienteId: randomUUID(),
      estado: 'Borrador',
      subtotal: 10,
      descuento: 0,
      impuesto: 0,
      total: 10,
      items: [{ productoId: randomUUID(), cantidad: 1, precioUnitario: 10 }],
    });

    await expect(ventas.crearPedido(db, pedidoInvalido)).rejects.toMatchObject({
      code: 'PEDIDO_REFERENCIA_INVALIDA',
      statusCode: 409,
    });
  });

  it('responde 409 ante dos productos concurrentes con el mismo SKU', async () => {
    const sku = `SKU-${randomUUID()}`;
    const payload = {
      sku,
      nombre: 'Producto concurrente',
      precio: 10,
      tipo: 'producto',
    };

    const respuestas = await Promise.all([
      app.inject({ method: 'POST', url: '/api/productos', payload }),
      app.inject({ method: 'POST', url: '/api/productos', payload }),
    ]);

    expect(respuestas.map((respuesta) => respuesta.statusCode).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);

    const rechazada = respuestas.find((respuesta) => respuesta.statusCode === 409);
    expect(rechazada?.json()).toMatchObject({ error: { code: 'SKU_DUPLICADO' } });
  });

  it('protege la transición concurrente con WHERE id AND estado', async () => {
    const pedido = await crearPedidoBorrador();
    const ventas = new VentasRepository(db);

    const resultados = await Promise.all([
      ventas.actualizarEstado(db, pedido.id, 'Borrador', 'Emitido'),
      ventas.actualizarEstado(db, pedido.id, 'Borrador', 'Emitido'),
    ]);

    expect(resultados.filter((actualizado) => actualizado)).toHaveLength(1);

    const persistido = await db
      .selectFrom('pedidos')
      .select('estado')
      .where('id', '=', pedido.id)
      .executeTakeFirstOrThrow();

    expect(persistido.estado).toBe('Emitido');
  });

  it('responde 409 a una segunda emisión concurrente y publica un solo evento', async () => {
    const pedido = await crearPedidoBorrador();

    const respuestas = await Promise.all([
      app.inject({ method: 'POST', url: `/api/pedidos/${pedido.id}/emitir` }),
      app.inject({ method: 'POST', url: `/api/pedidos/${pedido.id}/emitir` }),
    ]);

    expect(respuestas.map((respuesta) => respuesta.statusCode).sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ tipo: 'PedidoEmitido', procesado_en: null });
  });

  it('publica PedidoEmitido y PedidoPagado dentro del UnitOfWork', async () => {
    const pedido = await crearPedidoBorrador();

    const emision = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/emitir`,
    });
    expect(emision.statusCode).toBe(200);

    const pago = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/pagar`,
    });
    expect(pago.statusCode).toBe(200);

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    const eventosPorTipo = new Map(eventos.map((evento) => [evento.tipo, evento]));

    expect([...eventosPorTipo.keys()].sort()).toEqual(['PedidoEmitido', 'PedidoPagado']);
    expect(eventosPorTipo.get('PedidoEmitido')?.payload).toMatchObject({
      pedidoId: pedido.id,
      clienteId,
      total: 100,
    });
    expect(eventosPorTipo.get('PedidoPagado')?.payload).toMatchObject({
      pedidoId: pedido.id,
      clienteId,
      total: 100,
    });
  });

  it('cobra con la estrategia de pago y rechaza efectivo insuficiente', async () => {
    const pedido = await crearPedidoBorrador();

    const emision = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/emitir`,
    });
    expect(emision.statusCode).toBe(200);

    const pagoInsuficiente = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/pagar`,
      payload: { montoRecibido: 50 },
    });
    expect(pagoInsuficiente.statusCode).toBe(400);
    expect(pagoInsuficiente.json()).toMatchObject({
      error: { code: 'PAGO_INSUFICIENTE' },
    });

    const pago = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/pagar`,
      payload: { montoRecibido: 150 },
    });
    expect(pago.statusCode).toBe(200);
    expect(pago.json<PedidoJson>().estado).toBe('Pagado');

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    const pagado = eventos.find((evento) => evento.tipo === 'PedidoPagado');

    expect(pagado?.payload).toMatchObject({
      pedidoId: pedido.id,
      total: 100,
      metodoPago: 'efectivo',
    });
  });

  it('cobra con la estrategia de pasarela cuando se solicita', async () => {
    const pedido = await crearPedidoBorrador();

    const emision = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/emitir`,
    });
    expect(emision.statusCode).toBe(200);

    const pago = await app.inject({
      method: 'POST',
      url: `/api/pedidos/${pedido.id}/pagar`,
      payload: { metodoPago: 'pasarela' },
    });
    expect(pago.statusCode).toBe(200);
    expect(pago.json<PedidoJson>().estado).toBe('Pagado');

    const eventos = await db.selectFrom('outbox_events').selectAll().execute();
    const pagado = eventos.find((evento) => evento.tipo === 'PedidoPagado');

    expect(pagado?.payload).toMatchObject({
      pedidoId: pedido.id,
      total: 100,
      metodoPago: 'pasarela',
    });
  });

  it('numera las facturas de forma atómica con la secuencia de PostgreSQL', async () => {
    const primerPedido = await crearPedidoPagado();
    const segundoPedido = await crearPedidoPagado();

    const respuestas = await Promise.all([
      app.inject({ method: 'POST', url: `/api/pedidos/${primerPedido.id}/factura` }),
      app.inject({ method: 'POST', url: `/api/pedidos/${segundoPedido.id}/factura` }),
    ]);

    expect(respuestas.map((respuesta) => respuesta.statusCode)).toEqual([201, 201]);

    const numeros = respuestas.map((respuesta) => respuesta.json<FacturaJson>().numero).sort();
    expect(numeros).toEqual(['FAC-000001', 'FAC-000002']);
  });
});
