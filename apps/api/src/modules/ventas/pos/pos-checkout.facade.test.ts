import { describe, expect, it } from 'vitest';

import type { UnitOfWork, UnitOfWorkContext } from '../../../shared/db/unit-of-work.js';
import type { AppEventMap } from '../../../shared/events/app-event-map.js';
import type { DescuentoStrategy } from '../domain/pricing/descuento.strategy.js';
import type { ImpuestoStrategy } from '../domain/pricing/impuesto.strategy.js';
import type { PagoStrategy } from '../domain/payments/pago.strategy.js';
import type { CadenaValidacion } from '../domain/validation/cadena-validacion.js';
import type { CarritoRepository } from './carrito.repository.js';
import type { VentasRepository } from '../ventas.repository.js';
import type { EstrategiasVentas, MetodoPago } from '../ventas.service.js';
import { PosCheckoutFacade } from './pos-checkout.facade.js';

const CARRITO_ID = '11111111-1111-4111-8111-111111111111';

const clientes = {
  obtenerPorDocumento: async (): Promise<{
    id: string;
    esClienteFrecuente?: boolean;
  } | null> => ({ id: 'cliente-1', esClienteFrecuente: false }),
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
  cobrar: async ({ monto }: { monto: number }) => ({
    metodo: 'efectivo',
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
  } as Readonly<Record<MetodoPago, PagoStrategy>>,
};

const repository = {
  crearPedido: async () => {},
  actualizarEstado: async () => true,
  siguienteNumeroFactura: async () => 'FAC-001',
  crearFactura: async () => {},
  listarPedidos: async () => [],
  obtenerPedido: async () => {
    throw new Error('no se usa en esta prueba');
  },
  obtenerPedidoDetalle: async () => undefined,
  eliminarPedido: async () => true,
  listarFacturas: async () => [],
  obtenerFactura: async () => undefined,
  obtenerFacturaPorPedido: async () => undefined,
} as unknown as VentasRepository;

function crearCarritoRepository(items = [{ productoId: 'producto-1', cantidad: 2, precioUnitario: 100 }]) {
  const estado = { cerrado: false };
  const repo = {
    obtenerCarrito: async () => ({
      id: CARRITO_ID,
      estado: estado.cerrado ? 'Cerrado' : 'Abierto',
      items,
    }),
    actualizarEstado: async (_db: unknown, _id: string, nuevoEstado: string) => {
      if (nuevoEstado === 'Cerrado') estado.cerrado = true;
      return true;
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
  const clientes = clientesRows.map((c) => ({ ...c }));

  const db = {
    selectFrom: (table: string) => ({
      select: (_col: string) => ({
        where: (_col2: string, _op: string, value: string) => ({
          executeTakeFirst: async () => {
            if (table === 'productos') {
              const row = productoRows.find((p) => p.id === value);
              return row ? { precio: row.precio } : undefined;
            }
            if (table === 'stock') {
              const row = stockState.find((s) => s.producto_id === value);
              return row ? { cantidad: row.cantidad } : undefined;
            }
            if (table === 'clientes') {
              const row = clientes.find((c) => c.documento === value || c.id === value);
              return row ? { id: row.id } : undefined;
            }
            return undefined;
          },
        }),
      }),
    }),
    updateTable: (table: string) => ({
      set: (values: { cantidad: number }) => ({
        where: (_col: string, _op: string, value: string) => ({
          execute: async () => {
            if (table === 'stock') {
              const row = stockState.find((s) => s.producto_id === value);
              if (row) row.cantidad = values.cantidad;
            }
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
        publish: async (_tipo: string, _payload: unknown): Promise<void> => {
          eventos.push({ tipo: _tipo, payload: _payload });
        },
      };
      return work(context);
    },
  } as unknown as UnitOfWork<AppEventMap>;
}

const cadenaValidacion = {
  ejecutar: async () => {},
} as unknown as CadenaValidacion;

const verificarStock = async (): Promise<boolean> => true;

describe('Patrón Facade - checkout POS', () => {
  it('debe ejecutar todo el flujo de venta dentro de una transacción', async () => {
    const eventos: Array<{ tipo: string; payload: unknown }> = [];
    const { repo } = crearCarritoRepository();
    const { db, stockRows } = crearDbMock(
      [{ id: 'producto-1', precio: 100 }],
      [{ producto_id: 'producto-1', cantidad: 10 }],
    );

    const facade = new PosCheckoutFacade(
      cadenaValidacion,
      estrategias,
      clientes,
      repository,
      repo,
      crearUnitOfWork(eventos, db),
      verificarStock,
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
    expect(resultado.pago.metodo).toBe('efectivo');
    expect(stockRows.find((s) => s.producto_id === 'producto-1')?.cantidad).toBe(8);
    expect(eventos.some((e) => e.tipo === 'PedidoPagado')).toBe(true);
  });

  it('debe rechazar el checkout si el carrito no existe', async () => {
    const eventos: Array<{ tipo: string; payload: unknown }> = [];
    const repo = {
      obtenerCarrito: async () => undefined,
      actualizarEstado: async () => true,
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
    );

    await expect(
      facade.checkout({ documentoCliente: '123', carritoId: CARRITO_ID }),
    ).rejects.toMatchObject({ code: 'CARRITO_NO_ENCONTRADO' });
  });
});