// Patrón: Chain of Responsibility

import { DomainError } from '../../../shared/errors/domain-error.js';
import { EslabonLiquidacionBase } from '../cadena-liquidacion.js';
import type { EntradaConcepto, ResultadoConcepto } from '../domain/tipos.js';

export class SalarioBaseEslabon extends EslabonLiquidacionBase {
  readonly codigo = 'SALARIO_BASE';
  readonly nombre = 'Salario base';
  readonly tipo: 'devengo' = 'devengo';

  async ejecutar(
    entrada: EntradaConcepto,
    acumulado: ResultadoConcepto[],
  ): Promise<ResultadoConcepto[]> {
    if (
      typeof entrada.salarioBase !== 'number' ||
      Number.isNaN(entrada.salarioBase) ||
      entrada.salarioBase < 0
    ) {
      throw new DomainError('El salario base es obligatorio y debe ser positivo', {
        code: 'SALARIO_BASE_INVALIDO',
        statusCode: 400,
      });
    }

    const resultado: ResultadoConcepto = {
      codigo: this.codigo,
      nombre: this.nombre,
      tipo: this.tipo,
      valor: entrada.salarioBase,
    };

    return this.siguiente(entrada, [...acumulado, resultado]);
  }
}
