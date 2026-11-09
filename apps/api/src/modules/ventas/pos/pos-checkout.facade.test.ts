import { describe, expect, it } from 'vitest';

import type { UnitOfWork, UnitOfWorkContext } from '../../../shared/db/unit-of-work.js';
import type { VentasEventMap } from '../domain/eventos.js';
import type { DescuentoStrategy } from '../domain/pricing/descuento.strategy.js';
import type { ImpuestoStrategy } from '../domain/pricing/impuesto.strategy.js';
import type { PagoStrategy } from '../domain/payments/pago.strategy.js';
import type { CadenaValidacion } from '../domain/validation/cadena-validacion.js';
import type { VentasRepository } from '../ventas.repository.js';
import type { EstrategiasVentas, MetodoPago } from '../ventas.service.js';
import { PosCheckoutFacade } from './pos-checkout.facade.js';

const productosPrecios = new Map<string, number>([['producto-1', 100]]);

const catalogo = {
  obtenerPrecio: async (productoId: string): Promise<number | null> =>
    productosPrecios.get(productoId) ?? null,
};

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

const eventosPublicados: Array<{ tipo: string; payload: unknown }> = [];

const unitOfWork = {
  execute: async <TResult>(
    work: (context: UnitOfWorkContext<VentasEventMap>) => Promise<TResult>,
  ): Promise<TResult> => {
    const context: UnitOfWorkContext<VentasEventMap> = {
      db: {} as never,
      correlationId: 'test',
      publish: async (
        _tipo: string,
        _payload: unknown,
      ): Promise<void> => {
        eventosPublicados.push({ tipo: _tipo, payload: _payload });
      },
    };
    return work(context);
  },
} as unknown as UnitOfWork<VentasEventMap>;

const cadenaValidacion = {
  ejecutar: async () => {},
} as unknown as CadenaValidacion;

const verificarStockCalls: Array<{ productoId: string; cantidad: number }> = [];
const verificarStock = async (
  productoId: string,
  cantidad: number,
): Promise<boolean> => {
  verificarStockCalls.push({ productoId, cantidad });
  return true;
};

const descontarStockCalls: Array<{ productoId: string; cantidad: number }> = [];
const descontarStock = async (
  productoId: string,
  cantidad: number,
): Promise<void> => {
  descontarStockCalls.push({ productoId, cantidad });
};

describe('Patrón Facade - checkout POS', () => {
  it('debe ejecutar todo el flujo de venta dentro de una transacción', async () => {
    const facade = new PosCheckoutFacade(
      cadenaValidacion,
      estrategias,
      catalogo,
      clientes,
      repository,
      unitOfWork,
      verificarStock,
      descontarStock,
    );

    const resultado = await facade.checkout({
      documentoCliente: '123',
      items: [{ productoId: 'producto-1', cantidad: 2 }],
      metodoPago: 'efectivo',
    });

    expect(resultado.pedido.id).toBeDefined();
    expect(resultado.pedido.estado).toBe('Pagado');
    expect(resultado.factura.numero).toBe('FAC-001');
    expect(resultado.factura.estado).toBe('Emitida');
    expect(resultado.pago.metodo).toBe('efectivo');
    expect(descontarStockCalls).toEqual([
      { productoId: 'producto-1', cantidad: 2 },
    ]);
    expect(
      eventosPublicados.some((e) => e.tipo === 'PedidoPagado'),
    ).toBe(true);
  });

  it('debe rechazar el checkout si el cliente no existe', async () => {
    const clientesVacios = {
      obtenerPorDocumento: async () => null,
    };

    const facade = new PosCheckoutFacade(
      cadenaValidacion,
      estrategias,
      catalogo,
      clientesVacios as never,
      repository,
      unitOfWork,
      verificarStock,
      descontarStock,
    );

    await expect(
      facade.checkout({
        documentoCliente: 'inexistente',
        items: [{ productoId: 'producto-1', cantidad: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'CLIENTE_NO_ENCONTRADO' });
  });

  it('debe rechazar el checkout si el producto no existe', async () => {
    const catalogoVacio = {
      obtenerPrecio: async () => null,
    };

    const facade = new PosCheckoutFacade(
      cadenaValidacion,
      estrategias,
      catalogoVacio as never,
      clientes,
      repository,
      unitOfWork,
      verificarStock,
      descontarStock,
    );

    await expect(
      facade.checkout({
        documentoCliente: '123',
        items: [{ productoId: 'producto-inexistente', cantidad: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'PRODUCTO_NO_ENCONTRADO' });
  });

  it('debe usar el descuento de la estrategia configurada', async () => {
    const descuentoConValor: DescuentoStrategy = {
      nombre: 'volumen',
      calcular: () => 10,
    };

    const estrategiasConDescuento: EstrategiasVentas = {
      descuento: descuentoConValor,
      impuesto: impuestoMock,
      pagos: {
        efectivo: pagoEfectivoMock,
        pasarela: pagoEfectivoMock,
      } as Readonly<Record<MetodoPago, PagoStrategy>>,
    };

    const facade = new PosCheckoutFacade(
      cadenaValidacion,
      estrategiasConDescuento,
      catalogo,
      clientes,
      repository,
      unitOfWork,
      verificarStock,
      descontarStock,
    );

    const resultado = await facade.checkout({
      documentoCliente: '123',
      items: [{ productoId: 'producto-1', cantidad: 2 }],
    });

    expect(resultado.pedido.descuento).toBe(10);
  });
});
