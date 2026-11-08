import { describe, expect, it } from 'vitest';

import { Pedido, type PedidoItem } from '../pedido.js';
import { DescuentoClienteFrecuente } from './descuento-cliente-frecuente.strategy.js';
import { DescuentoPorVolumen } from './descuento-volumen.strategy.js';
import { DescuentoPromocion } from './descuento-promocion.strategy.js';
import { ImpuestoExento } from './impuesto-exento.strategy.js';
import { ImpuestoIva } from './impuesto-iva.strategy.js';

const items: readonly PedidoItem[] = [
  { productoId: 'producto-1', cantidad: 10, precioUnitario: 100 },
];

describe('Patrón Strategy en el cálculo del pedido', () => {
  it('cambia el total al sustituir la estrategia de descuento sin modificar Pedido', () => {
    const conVolumen = Pedido.crear(
      {
        id: 'pedido-1',
        clienteId: 'cliente-1',
        estado: 'Borrador',
        items,
      },
      {
        descuento: new DescuentoPorVolumen([
          { cantidadMinima: 5, porcentaje: 0.1 },
        ]),
        impuesto: new ImpuestoExento(),
      },
    );
    const conPromocion = Pedido.crear(
      {
        id: 'pedido-2',
        clienteId: 'cliente-1',
        estado: 'Borrador',
        items,
      },
      {
        descuento: new DescuentoPromocion({ montoFijo: 250 }),
        impuesto: new ImpuestoExento(),
      },
    );

    expect(conVolumen.descuento).toBe(100);
    expect(conVolumen.total).toBe(900);
    expect(conPromocion.descuento).toBe(250);
    expect(conPromocion.total).toBe(750);
  });

  it('cambia el total al sustituir la estrategia de impuesto sin modificar Pedido', () => {
    const conExento = Pedido.calcularTotales(items, {
      descuento: new DescuentoPromocion({ montoFijo: 0 }),
      impuesto: new ImpuestoExento(),
    });
    const conIva = Pedido.calcularTotales(items, {
      descuento: new DescuentoPromocion({ montoFijo: 0 }),
      impuesto: new ImpuestoIva(0.19),
    });

    expect(conExento).toEqual({
      subtotal: 1000,
      descuento: 0,
      impuesto: 0,
      total: 1000,
    });
    expect(conIva).toEqual({
      subtotal: 1000,
      descuento: 0,
      impuesto: 190,
      total: 1190,
    });
  });

  it('aplica el descuento por volumen solo cuando la cantidad supera 10 unidades', () => {
    const estrategia = new DescuentoPorVolumen();

    for (const cantidadTotal of [1, 10]) {
      expect(
        estrategia.calcular({
          subtotal: 1000,
          cantidadTotal,
          esClienteFrecuente: false,
        }),
      ).toBe(0);
    }

    expect(
      estrategia.calcular({
        subtotal: 1000,
        cantidadTotal: 11,
        esClienteFrecuente: false,
      }),
    ).toBe(100);
  });

  it('aplica el tramo de volumen más alto que corresponda', () => {
    const estrategia = new DescuentoPorVolumen([
      { cantidadMinima: 11, porcentaje: 0.1 },
      { cantidadMinima: 21, porcentaje: 0.15 },
    ]);

    expect(
      estrategia.calcular({
        subtotal: 1000,
        cantidadTotal: 20,
        esClienteFrecuente: false,
      }),
    ).toBe(100);
    expect(
      estrategia.calcular({
        subtotal: 1000,
        cantidadTotal: 21,
        esClienteFrecuente: false,
      }),
    ).toBe(150);
  });

  it('solo aplica el descuento de cliente frecuente a quien está marcado', () => {
    const estrategia = new DescuentoClienteFrecuente(0.1);

    expect(
      estrategia.calcular({
        subtotal: 1000,
        cantidadTotal: 1,
        esClienteFrecuente: false,
      }),
    ).toBe(0);
    expect(
      estrategia.calcular({
        subtotal: 1000,
        cantidadTotal: 1,
        esClienteFrecuente: true,
      }),
    ).toBe(100);
  });

  it('calcula una promoción porcentual sobre el subtotal', () => {
    const estrategia = new DescuentoPromocion({ porcentaje: 0.25 });

    expect(
      estrategia.calcular({
        subtotal: 200,
        cantidadTotal: 1,
        esClienteFrecuente: false,
      }),
    ).toBe(50);
  });
});
