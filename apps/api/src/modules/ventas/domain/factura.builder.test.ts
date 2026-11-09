import { describe, expect, it } from 'vitest';

import { FacturaBuilder } from './factura.builder.js';

describe('Patrón Builder - construcción de factura', () => {
  it('debe construir una factura paso a paso con todos los datos', () => {
    const factura = new FacturaBuilder()
      .conId('factura-1')
      .conPedidoId('pedido-1')
      .conNumero('FAC-001')
      .conEstado('Emitida')
      .conPayloadExterno(null)
      .construir();

    expect(factura.id).toBe('factura-1');
    expect(factura.pedidoId).toBe('pedido-1');
    expect(factura.numero).toBe('FAC-001');
    expect(factura.estado).toBe('Emitida');
    expect(factura.payloadExterno).toBeNull();
  });

  it('debe permitir construir sin payload externo', () => {
    const factura = new FacturaBuilder()
      .conId('factura-2')
      .conPedidoId('pedido-2')
      .conNumero('FAC-002')
      .conEstado('Emitida')
      .construir();

    expect(factura.payloadExterno).toBeNull();
  });

  it('debe rechazar la construcción si faltan datos obligatorios', () => {
    const builder = new FacturaBuilder().conId('factura-3');

    expect(() => builder.construir()).toThrow(/datos obligatorios/);
  });
});
