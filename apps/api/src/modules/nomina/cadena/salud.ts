// Patrón: Chain of Responsibility

import { EslabonLiquidacionBase } from '../cadena-liquidacion.js';
import type { EntradaConcepto, ResultadoConcepto } from '../domain/tipos.js';

export class SaludEslabon extends EslabonLiquidacionBase {
  readonly codigo = 'SALUD';
  readonly nombre = 'Salud (4%)';
  readonly tipo = 'deduccion' as const;

  private readonly porcentaje = 0.04;

  async ejecutar(
    entrada: EntradaConcepto,
    acumulado: ResultadoConcepto[],
  ): Promise<ResultadoConcepto[]> {
    const resultado: ResultadoConcepto = {
      codigo: this.codigo,
      nombre: this.nombre,
      tipo: this.tipo,
      valor: Math.round(entrada.salarioBase * this.porcentaje * 100) / 100,
    };

    return this.siguiente(entrada, [...acumulado, resultado]);
  }
}
