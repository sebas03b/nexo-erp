import { describe, expect, it } from 'vitest';

import { PensionEslabon } from './pension.js';
import type { EntradaConcepto } from '../domain/tipos.js';

const entradaBase: EntradaConcepto = {
  empleadoId: 'emp-1',
  salarioBase: 1500000,
  periodo: '2026-11',
};

describe('Eslabon Pension', () => {
  it('calcula 4% del salario base como deduccion', async () => {
    const eslabon = new PensionEslabon();
    const resultado = await eslabon.ejecutar(entradaBase, []);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]!.codigo).toBe('PENSION');
    expect(resultado[0]!.tipo).toBe('deduccion');
    expect(resultado[0]!.valor).toBe(60000); // 1500000 * 0.04
  });
});
