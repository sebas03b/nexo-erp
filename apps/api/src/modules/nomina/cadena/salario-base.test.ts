import { describe, expect, it } from 'vitest';

import { SalarioBaseEslabon } from './salario-base.js';
import type { EntradaConcepto } from '../domain/tipos.js';

const entradaBase: EntradaConcepto = {
  empleadoId: 'emp-1',
  salarioBase: 1500000,
  periodo: '2026-11',
};

describe('Eslabon Salario Base', () => {
  it('devuelve el salario base como devengo', async () => {
    const eslabon = new SalarioBaseEslabon();
    const resultado = await eslabon.ejecutar(entradaBase, []);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toEqual({
      codigo: 'SALARIO_BASE',
      nombre: 'Salario base',
      tipo: 'devengo',
      valor: 1500000,
    });
  });

  it('rechaza salario base negativo', async () => {
    const eslabon = new SalarioBaseEslabon();
    await expect(
      eslabon.ejecutar({ ...entradaBase, salarioBase: -100 }, []),
    ).rejects.toMatchObject({ code: 'SALARIO_BASE_INVALIDO' });
  });

  it('rechaza salario base ausente', async () => {
    const eslabon = new SalarioBaseEslabon();
    await expect(
      eslabon.ejecutar(
        { ...entradaBase, salarioBase: NaN as unknown as number },
        [],
      ),
    ).rejects.toMatchObject({ code: 'SALARIO_BASE_INVALIDO' });
  });
});
