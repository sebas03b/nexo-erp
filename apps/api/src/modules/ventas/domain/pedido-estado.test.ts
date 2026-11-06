import { describe, expect, it } from 'vitest';

import { Pedido } from './pedido.js';
import {
  type EstadoPedido,
  TransicionEstadoInvalida,
} from './pedido-estado.js';

const acciones = {
  emitir: (pedido: Pedido) => {
    pedido.emitir();
  },
  pagar: (pedido: Pedido) => {
    pedido.pagar();
  },
  anular: (pedido: Pedido) => {
    pedido.anular();
  },
} as const;

type Accion = keyof typeof acciones;

function crearPedido(estado: EstadoPedido): Pedido {
  return new Pedido({
    id: 'pedido-1',
    clienteId: 'cliente-1',
    estado,
    subtotal: 100,
    descuento: 0,
    impuesto: 0,
    total: 100,
    items: [{ productoId: 'producto-1', cantidad: 1, precioUnitario: 100 }],
  });
}

describe('Patrón State del pedido', () => {
  const transicionesLegales: Array<[EstadoPedido, Accion, EstadoPedido]> = [
    ['Borrador', 'emitir', 'Emitido'],
    ['Borrador', 'anular', 'Anulado'],
    ['Emitido', 'pagar', 'Pagado'],
    ['Emitido', 'anular', 'Anulado'],
  ];

  it.each(transicionesLegales)(
    'permite la transición legal %s --%s--> %s',
    (estadoInicial, accion, estadoEsperado) => {
      const pedido = crearPedido(estadoInicial);

      acciones[accion](pedido);

      expect(pedido.estado).toBe(estadoEsperado);
    },
  );

  const transicionesIlegales: Array<[EstadoPedido, Accion, EstadoPedido]> = [
    ['Borrador', 'pagar', 'Pagado'],
    ['Emitido', 'emitir', 'Emitido'],
    ['Pagado', 'emitir', 'Emitido'],
    ['Pagado', 'pagar', 'Pagado'],
    ['Pagado', 'anular', 'Anulado'],
    ['Anulado', 'emitir', 'Emitido'],
    ['Anulado', 'pagar', 'Pagado'],
    ['Anulado', 'anular', 'Anulado'],
  ];

  it.each(transicionesIlegales)(
    'rechaza la transición ilegal %s --%s--> %s',
    (estadoInicial, accion, estadoIntento) => {
      const pedido = crearPedido(estadoInicial);
      let errorCapturado: unknown;

      try {
        acciones[accion](pedido);
      } catch (error) {
        errorCapturado = error;
      }

      expect(errorCapturado).toBeInstanceOf(TransicionEstadoInvalida);
      expect(pedido.estado).toBe(estadoInicial);

      if (errorCapturado instanceof TransicionEstadoInvalida) {
        expect(errorCapturado.code).toBe('TRANSICION_INVALIDA');
        expect(errorCapturado.statusCode).toBe(409);
        expect(errorCapturado.message).toContain(`${estadoInicial} → ${estadoIntento}`);
      }
    },
  );

  it('recorre el flujo completo Borrador → Emitido → Pagado', () => {
    const pedido = crearPedido('Borrador');

    pedido.emitir();
    expect(pedido.estado).toBe('Emitido');

    pedido.pagar();
    expect(pedido.estado).toBe('Pagado');

    expect(() => pedido.anular()).toThrow(TransicionEstadoInvalida);
    expect(pedido.estado).toBe('Pagado');
  });

  it('no permite saltar de Borrador a Pagado ni anular un pedido pagado', () => {
    const borrador = crearPedido('Borrador');

    expect(() => borrador.pagar()).toThrow(
      'Transición de pedido inválida: Borrador → Pagado',
    );

    const pagado = crearPedido('Pagado');

    expect(() => pagado.anular()).toThrow(
      'Transición de pedido inválida: Pagado → Anulado',
    );
  });

  it('valida las invariantes del pedido en el constructor', () => {
    const datos = {
      id: 'pedido-2',
      clienteId: 'cliente-1',
      estado: 'Borrador' as const,
      subtotal: 100,
      descuento: 0,
      impuesto: 0,
      total: 100,
      items: [{ productoId: 'producto-1', cantidad: 1, precioUnitario: 100 }],
    };

    const capturarError = (accion: () => void): unknown => {
      try {
        accion();
      } catch (error) {
        return error;
      }

      return undefined;
    };

    expect(capturarError(() => new Pedido({ ...datos, items: [] }))).toMatchObject({
      code: 'PEDIDO_SIN_ITEMS',
      statusCode: 400,
    });

    expect(capturarError(() => new Pedido({ ...datos, total: -1 }))).toMatchObject({
      code: 'PEDIDO_TOTAL_INVALIDO',
      statusCode: 400,
    });
  });
});
