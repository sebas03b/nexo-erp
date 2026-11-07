// Patrón: Strategy

import { DomainError } from '../../../../shared/errors/domain-error.js';
import { redondearMoneda } from '../dinero.js';
import type { ImpuestoStrategy } from './impuesto.strategy.js';

export class ImpuestoFijo implements ImpuestoStrategy {
  readonly nombre = 'fijo';
  readonly #monto: number;

  constructor(monto: number) {
    if (monto < 0) {
      throw new DomainError('El monto fijo de impuesto no es válido', {
        code: 'ESTRATEGIA_IMPUESTO_INVALIDA',
        statusCode: 400,
      });
    }

    this.#monto = monto;
  }

  calcular(): number {
    return redondearMoneda(this.#monto);
  }
}
