import { describe, expect, it } from 'vitest';

import { AuxilioTransporteEslabon } from './auxilio-transporte.js';

describe('Eslabon Auxilio de Transporte', () => {
  it('otorga auxilio cuando salario es menor o igual al umbral', async () => {
    const eslabon = new AuxilioTransporteEslabon();
    const resultado = await eslabon.ejecutar(
      { empleadoId: 'emp-1', salarioBase: 1500000, periodo: '2026-11' },
      [],
    );

    expect(resultado[0]!.valor).toBe(162000);
    expect(resultado[0]!.tipo).toBe('devengo');
  });

  it('no otorga auxilio cuando salario supera el umbral', async () => {
    const eslabon = new AuxilioTransporteEslabon();
    const resultado = await eslabon.ejecutar(
      { empleadoId: 'emp-1', salarioBase: 2500000, periodo: '2026-11' },
      [],
    );

    expect(resultado[0]!.valor).toBe(0);
  });

  it('respeta el flag auxilioTransporte cuando se envia', async () => {
    const eslabon = new AuxilioTransporteEslabon();
    const resultado = await eslabon.ejecutar(
      {
        empleadoId: 'emp-1',
        salarioBase: 2500000,
        auxilioTransporte: 1,
        periodo: '2026-11',
      },
      [],
    );

    expect(resultado[0]!.valor).toBe(162000);
  });
});
