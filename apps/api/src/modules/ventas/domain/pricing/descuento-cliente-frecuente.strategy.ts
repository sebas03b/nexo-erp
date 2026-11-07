// Patrón: Strategy

import { DomainError } from '../../../../shared/errors/domain-error.js';
import { redondearMoneda } from '../dinero.js';
import type { DescuentoContexto, DescuentoStrategy } from './descuento.strategy.js';

const PORCENTAJE_POR_DEFECTO = 0.05;

export class DescuentoClienteFrecuente implements DescuentoStrategy {
  readonly nombre = 'cliente_frecuente';
  readonly #porcentaje: number;

  constructor(porcentaje: number = PORCENTAJE_POR_DEFECTO) {
    if (porcentaje < 0 || porcentaje > 1) {
      throw new DomainError('El porcentaje de cliente frecuente no es válido', {
        code: 'ESTRATEGIA_DESCUENTO_INVALIDA',
        statusCode: 400,
      });
    }

    this.#porcentaje = porcentaje;
  }

  calcular({ subtotal, esClienteFrecuente }: DescuentoContexto): number {
    if (!esClienteFrecuente) {
      return 0;
    }

    return redondearMoneda(subtotal * this.#porcentaje);
  }
}
