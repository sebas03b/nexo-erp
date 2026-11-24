import { describe, expect, it } from 'vitest';

import { HorasExtrasEslabon } from './horas-extras.js';
import type { EntradaConcepto } from '../domain/tipos.js';

const entradaBase: EntradaConcepto = {
  empleadoId: 'emp-1',
  salarioBase: 1500000,
  horasExtras: 10,
  periodo: '2026-11',
};

describe('Eslabon Horas Extras', () => {
  it('calcula valor de horas extras', async () => {
    const eslabon = new HorasExtrasEslabon();
    const resultado = await eslabon.ejecutar(entradaBase, []);

    // 1500000 / 240 / 2 = 3125 por hora; 10 horas = 31250
    expect(resultado).toHaveLength(1);
    expect(resultado[0]!.codigo).toBe('HORAS_EXTRAS');
    expect(resultado[0]!.tipo).toBe('devengo');
    expect(resultado[0]!.valor).toBe(31250);
  });

  it('devuelve 0 cuando no hay horas extras', async () => {
    const eslabon = new HorasExtrasEslabon();
    const resultado = await eslabon.ejecutar(
      { ...entradaBase, horasExtras: 0 },
      [],
    );

    expect(resultado[0]!.valor).toBe(0);
  });
});
