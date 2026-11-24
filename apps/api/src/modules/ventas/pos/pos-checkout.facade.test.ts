import { describe, expect, it } from 'vitest';

import { FacturacionXmlAdapter } from '../../../integrations/facturacion-electronica/facturacion-xml.adapter.js';
import type { UnitOfWork, UnitOfWorkContext } from '../../../shared/db/unit-of-work.js';
import type { AppEventMap } from '../../../shared/events/app-event-map.js';
import type { DescuentoStrategy } from '../domain/pricing/descuento.strategy.js';
import type { ImpuestoStrategy } from '../domain/pricing/impuesto.strategy.js';
import type { PagoStrategy } from '../domain/payments/pago.strategy.js';
import type { CadenaValidacion } from '../domain/validation/cadena-validacion.js';
import type { CarritoRepository } from './carrito.repository.js';
import type { VentasRepository } from '../ventas.repository.js';
import type { EstrategiasVentas } from '../ventas.service.js';
import { PosCheckoutFacade } from './pos-checkout.facade.js';

const CARRITO_ID = '11111111-1111-4111-8111-111111111111';

const clientes = {
  obtenerPorDocumento: (): Promise<{
    id: string;
    esClienteFrecuente?: boolean;
  } | null> => Promise.resolve({ id: 'cliente-1', esClienteFrecuente: false }),
};

const descuentoMock: DescuentoStrategy = {
  nombre: 'volumen',
  calcular: () => 0,
};

const impuestoMock: ImpuestoStrategy = {
  nombre: 'exento',
  calcular: () => 0,
};

const pagoEfectivoMock: PagoStrategy = {
  metodo: 'efectivo',
  cobrar: ({ monto }: { monto: number }) =>
    Promise.resolve({
      metodo: 'efectivo' as const,
      monto,
      cambio: 0,
      referencia: 'EFECTIVO-1',
    }),
};

const estrategias: EstrategiasVentas = {
  descuento: descuentoMock,
  impuesto: impuestoMock,
  pagos: {
    efectivo: pagoEfectivoMock,
    pasarela: pagoEfectivoMock,
  },
};

const repository = {
  crearPedido: () => Promise.resolve(),
  actualizarEstado: () => Promise.resolve(true),
  siguienteNumeroFactura: () => Promise.resolve('FAC-001'),
  crearFactura: () => Promise.resolve(),
  listarPedidos: () => Promise.resolve([]),
  obtenerPedido: () => Promise.reject(new Error('no se usa en esta prueba')),
  obtenerPedidoDetalle: () => Promise.resolve(undefined),
  eliminarPedido: () => Promise.resolve(true),
  listarFacturas: () => Promise.resolve([]),
  obtenerFactura: () => Promise.resolve(undefined),
  obtenerFacturaPorPedido: () => Promise.resolve(undefined),
} as unknown as VentasRepository;

function crearCarritoRepository(items = [{ productoId: 'producto-1', cantidad: 2, precioUnitario: 100 }]) {
  const estado = { cerrado: false };
  const repo = {
    obtenerCarrito: () =>
      Promise.resolve({
        id: CARRITO_ID,
        estado: estado.cerrado ? 'Cerrado' : 'Abierto',
        items,
      }),
    actualizarEstado: (_db: unknown, _id: string, nuevoEstado: string) => {
      if (nuevoEstado === 'Cerrado') estado.cerrado = true;
      return Promise.resolve(true);
    },
  } as unknown as CarritoRepository;
  return { repo, estado };
}

function crearDbMock(
  productos: Array<{ id: string; precio: number }>,
  stock: Array<{ producto_id: string; cantidad: number }>,
  clientesRows: Array<{ id: string; documento: string }> = [
    { id: 'cliente-1', documento: '123' },
  ],
) {
  const stockState = stock.map((s) => ({ ...s }));
  const productoRows = productos.map((p) => ({ ...p }));
  const clientes = clientesRows.map((c) => ({ ...c, nombre: 'Cliente de prueba' }));

  const db = {
    selectFrom: (table: string) => ({
      select: (_col: string) => ({
        where: (_col2: string, _op: string, value: string) => ({
          executeTakeFirst: () => {
            if (table === 'productos') {
              const row = productoRows.find((p) => p.id === value);
              return Promise.resolve(row ? { precio: row.precio } : undefined);
            }
            if (table === 'stock') {
              const row = stockState.find((s) => s.producto_id === value);
              return Promise.resolve(row ? { cantidad: row.cantidad } : undefined);
            }
            if (table === 'clientes') {
              const row = clientes.find((c) => c.documento === value || c.id === value);
              return Promise.resolve(
                row
                  ? { id: row.id, nombre: row.nombre, documento: row.documento }
                  : undefined,
              );
            }
            return Promise.resolve(undefined);
          },
        }),
      }),
    }),
    updateTable: (table: string) => ({
      set: (values: { cantidad: number }) => ({
        where: (_col: string, _op: string, value: string) => ({
          execute: () => {
            if (table === 'stock') {
              const row = stockState.find((s) => s.producto_id === value);
              if (row) row.cantidad = values.cantidad;
            }
            return Promise.resolve();
          },
        }),
      }),
    }),
  } as never;

  return { db, stockRows: stockState };
}

function crearUnitOfWork(
  eventos: Array<{ tipo: string; payload: unknown }>,
  db: unknown,
) {
  return {
    db,
    execute: async <TResult>(
      work: (context: UnitOfWorkContext<AppEventMap>) => Promise<TResult>,
    ): Promise<TResult> => {
      const context: UnitOfWorkContext<AppEventMap> = {
        db: db as UnitOfWorkContext<AppEventMap>['db'],
        correlationId: 'test',
        publish: (_tipo: string, _payload: unknown): Promise<void> => {
          eventos.push({ tipo: _tipo, payload: _payload });
          return Promise.resolve();
        },
      };
      return work(context);
    },
  } as unknown as UnitOfWork<AppEventMap>;
}

const cadenaValidacion = {
  ejecutar: () => Promise.resolve(),
} as unknown as CadenaValidacion;

const verificarStock = (): Promise<boolean> => Promise.resolve(true);

describe('Patrón Facade - checkout POS', () => {
  it('debe ejecutar todo el flujo de venta dentro de una transacción', async () => {
    const eventos: Array<{ tipo: string; payload: unknown }> = [];
    const facturasCreadas: Array<Parameters<VentasRepository['crearFactura']>[1]> = [];
    const { repo } = crearCarritoRepository();
    const { db, stockRows } = crearDbMock(
      [{ id: 'producto-1', precio: 100 }],
      [{ producto_id: 'producto-1', cantidad: 10 }],
    );
    const repositoryConFactura = {
      ...repository,
      crearFactura: (
        _db: Parameters<VentasRepository['crearFactura']>[0],
        factura: Parameters<VentasRepository['crearFactura']>[1],
      ) => {
        facturasCreadas.push(factura);
        return Promise.resolve();
      },
    } as unknown as VentasRepository;

    const facade = new PosCheckoutFacade(
      cadenaValidacion,
      estrategias,
      clientes,
      repositoryConFactura,
      repo,
      crearUnitOfWork(eventos, db),
      verificarStock,
      new FacturacionXmlAdapter(),
    );

    const resultado = await facade.checkout({
      documentoCliente: '123',
      carritoId: CARRITO_ID,
      metodoPago: 'efectivo',
    });

    expect(resultado.pedido.id).toBeDefined();
    expect(resultado.pedido.estado).toBe('Pagado');
    expect(resultado.factura.numero).toBe('FAC-001');
    expect(resultado.factura.estado).toBe('Emitida');
    expect(resultado.factura.payloadExterno).toContain('<AmountCents>20000</AmountCents>');
    expect(facturasCreadas[0]?.payloadExterno).toBe(resultado.factura.payloadExterno);
    expect(resultado.pago.metodo).toBe('efectivo');
    expect(stockRows.find((s) => s.producto_id === 'producto-1')?.cantidad).toBe(8);
    expect(eventos.some((e) => e.tipo === 'PedidoPagado')).toBe(true);
  });

  it('debe rechazar el checkout si el carrito no existe', async () => {
    const eventos: Array<{ tipo: string; payload: unknown }> = [];
    const repo = {
      obtenerCarrito: () => Promise.resolve(undefined),
      actualizarEstado: () => Promise.resolve(true),
    } as unknown as CarritoRepository;
    const { db } = crearDbMock([], []);

    const facade = new PosCheckoutFacade(
      cadenaValidacion,
      estrategias,
      clientes,
      repository,
      repo,
      crearUnitOfWork(eventos, db),
      verificarStock,
      new FacturacionXmlAdapter(),
    );

    await expect(
      facade.checkout({ documentoCliente: '123', carritoId: CARRITO_ID }),
    ).rejects.toMatchObject({ code: 'CARRITO_NO_ENCONTRADO' });
  });
});