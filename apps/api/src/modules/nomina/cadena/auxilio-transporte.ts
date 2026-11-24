// Patrón: Chain of Responsibility

import { EslabonLiquidacionBase } from '../cadena-liquidacion.js';
import type { EntradaConcepto, ResultadoConcepto } from '../domain/tipos.js';

export class AuxilioTransporteEslabon extends EslabonLiquidacionBase {
  readonly codigo = 'AUXILIO_TRANSPORTE';
  readonly nombre = 'Auxilio de transporte';
  readonly tipo = 'devengo' as const;

  private readonly umbralSalario = 2000000;
  private readonly valorAuxilio = 162000;

  async ejecutar(
    entrada: EntradaConcepto,
    acumulado: ResultadoConcepto[],
  ): Promise<ResultadoConcepto[]> {
    const tieneAuxilio =
      entrada.auxilioTransporte !== undefined
        ? entrada.auxilioTransporte === 1
        : entrada.salarioBase <= this.umbralSalario;

    const resultado: ResultadoConcepto = {
      codigo: this.codigo,
      nombre: this.nombre,
      tipo: this.tipo,
      valor: tieneAuxilio ? this.valorAuxilio : 0,
    };

    return this.siguiente(entrada, [...acumulado, resultado]);
  }
}
