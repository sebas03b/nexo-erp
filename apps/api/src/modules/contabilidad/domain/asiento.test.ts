import { describe, expect, it } from 'vitest';

import { construirAsientoVenta } from './asiento.js';

describe('Dominio Contabilidad - partida doble', () => {
  it('construye asientos de partida doble con débito igual a crédito', () => {
    const movimientos = construirAsientoVenta(150000);

    expect(movimientos).toHaveLength(2);

    const caja = movimientos.find((m) => m.cuenta === 'CAJA');
    const ingresos = movimientos.find((m) => m.cuenta === 'INGRESOS_VENTAS');

    expect(caja).toEqual({ cuenta: 'CAJA', debito: 150000, credito: 0 });
    expect(ingresos).toEqual({ cuenta: 'INGRESOS_VENTAS', debito: 0, credito: 150000 });

    const totalDebito = movimientos.reduce((acc, m) => acc + m.debito, 0);
    const totalCredito = movimientos.reduce((acc, m) => acc + m.credito, 0);
    expect(totalDebito).toBe(150000);
    expect(totalCredito).toBe(150000);
  });
});
