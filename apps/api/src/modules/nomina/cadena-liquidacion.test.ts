import { describe, expect, it } from 'vitest';

import {
  CadenaLiquidacion,
} from './cadena-liquidacion.js';
import type { ResultadoConcepto } from './domain/tipos.js';
import { SalarioBaseEslabon } from './cadena/salario-base.js';
import { HorasExtrasEslabon } from './cadena/horas-extras.js';
import { AuxilioTransporteEslabon } from './cadena/auxilio-transporte.js';
import { SaludEslabon } from './cadena/salud.js';
import { PensionEslabon } from './cadena/pension.js';
import type { EntradaConcepto } from './domain/tipos.js';

const entrada: EntradaConcepto = {
  empleadoId: 'emp-1',
  salarioBase: 1500000,
  horasExtras: 10,
  auxilioTransporte: 1,
  periodo: '2026-11',
};

describe('Cadena de Liquidacion - patron Chain of Responsibility', () => {
  it('ejecuta todos los eslabones en orden y acumula resultados', async () => {
    const cadena = new CadenaLiquidacion();
    cadena.agregar(new SalarioBaseEslabon());
    cadena.agregar(new HorasExtrasEslabon());
    cadena.agregar(new AuxilioTransporteEslabon());
    cadena.agregar(new SaludEslabon());
    cadena.agregar(new PensionEslabon());

    const resultados = await cadena.ejecutar(entrada);

    expect(resultados).toHaveLength(5);

    const salario = resultados.find((r: ResultadoConcepto) => r.codigo === 'SALARIO_BASE');
    const horas = resultados.find((r: ResultadoConcepto) => r.codigo === 'HORAS_EXTRAS');
    const auxilio = resultados.find((r: ResultadoConcepto) => r.codigo === 'AUXILIO_TRANSPORTE');
    const salud = resultados.find((r: ResultadoConcepto) => r.codigo === 'SALUD');
    const pension = resultados.find((r: ResultadoConcepto) => r.codigo === 'PENSION');

    expect(salario?.valor).toBe(1500000);
    expect(salario?.tipo).toBe('devengo');
    expect(horas?.valor).toBe(31250);
    expect(horas?.tipo).toBe('devengo');
    expect(auxilio?.valor).toBe(162000);
    expect(auxilio?.tipo).toBe('devengo');
    expect(salud?.valor).toBe(60000);
    expect(salud?.tipo).toBe('deduccion');
    expect(pension?.valor).toBe(60000);
    expect(pension?.tipo).toBe('deduccion');
  });

  it('calcula neto a pagar correctamente', async () => {
    const cadena = new CadenaLiquidacion();
    cadena.agregar(new SalarioBaseEslabon());
    cadena.agregar(new HorasExtrasEslabon());
    cadena.agregar(new AuxilioTransporteEslabon());
    cadena.agregar(new SaludEslabon());
    cadena.agregar(new PensionEslabon());

    const resultados = await cadena.ejecutar(entrada);

    const devengos = resultados
      .filter((r: ResultadoConcepto) => r.tipo === 'devengo')
      .reduce((acc: number, r: ResultadoConcepto) => acc + r.valor, 0);
    const deducciones = resultados
      .filter((r: ResultadoConcepto) => r.tipo === 'deduccion')
      .reduce((acc: number, r: ResultadoConcepto) => acc + r.valor, 0);
    const neto = devengos - deducciones;

    expect(devengos).toBe(1500000 + 31250 + 162000); // 1693250
    expect(deducciones).toBe(60000 + 60000); // 120000
    expect(neto).toBe(1573250);
  });

  it('permite agregar o quitar eslabones sin modificar los demas', async () => {
    const cadenaSinHoras = new CadenaLiquidacion();
    cadenaSinHoras.agregar(new SalarioBaseEslabon());
    cadenaSinHoras.agregar(new SaludEslabon());
    cadenaSinHoras.agregar(new PensionEslabon());

    const resultados = await cadenaSinHoras.ejecutar(entrada);

    expect(resultados).toHaveLength(3);
    expect(resultados.find((r: ResultadoConcepto) => r.codigo === 'HORAS_EXTRAS')).toBeUndefined();
    expect(resultados.find((r: ResultadoConcepto) => r.codigo === 'AUXILIO_TRANSPORTE')).toBeUndefined();
  });

  it('cadena vacia devuelve arreglo vacio', async () => {
    const cadena = new CadenaLiquidacion();
    const resultados = await cadena.ejecutar(entrada);

    expect(resultados).toEqual([]);
  });
});
