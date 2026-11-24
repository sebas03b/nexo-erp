// Patrón: Chain of Responsibility

import { EslabonLiquidacionBase } from '../cadena-liquidacion.js';
import type { EntradaConcepto, ResultadoConcepto } from '../domain/tipos.js';

export class HorasExtrasEslabon extends EslabonLiquidacionBase {
  readonly codigo = 'HORAS_EXTRAS';
  readonly nombre = 'Horas extras';
  readonly tipo = 'devengo' as const;

  async ejecutar(
    entrada: EntradaConcepto,
    acumulado: ResultadoConcepto[],
  ): Promise<ResultadoConcepto[]> {
    const horasExtras = entrada.horasExtras ?? 0;
    const valorHora =
      entrada.salarioBase > 0 ? entrada.salarioBase / 240 / 2 : 0;

    const resultado: ResultadoConcepto = {
      codigo: this.codigo,
      nombre: this.nombre,
      tipo: this.tipo,
      valor: Math.round(horasExtras * valorHora * 100) / 100,
    };

    return this.siguiente(entrada, [...acumulado, resultado]);
  }
}
