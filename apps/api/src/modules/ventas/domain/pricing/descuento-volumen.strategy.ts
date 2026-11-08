// Patrón: Strategy

import { DomainError } from '../../../../shared/errors/domain-error.js';
import { redondearMoneda } from '../dinero.js';
import type { DescuentoContexto, DescuentoStrategy } from './descuento.strategy.js';

export interface TramoDescuentoVolumen {
  readonly cantidadMinima: number;
  readonly porcentaje: number;
}

const TRAMOS_POR_DEFECTO: readonly TramoDescuentoVolumen[] = [
  { cantidadMinima: 11, porcentaje: 0.1 },
];

export class DescuentoPorVolumen implements DescuentoStrategy {
  readonly nombre = 'volumen';
  readonly #tramos: readonly TramoDescuentoVolumen[];

  constructor(tramos: readonly TramoDescuentoVolumen[] = TRAMOS_POR_DEFECTO) {
    for (const tramo of tramos) {
      if (
        tramo.cantidadMinima < 0 ||
        tramo.porcentaje < 0 ||
        tramo.porcentaje > 1
      ) {
        throw new DomainError('Los tramos de descuento por volumen no son válidos', {
          code: 'ESTRATEGIA_DESCUENTO_INVALIDA',
          statusCode: 400,
        });
      }
    }

    this.#tramos = [...tramos].sort(
      (a, b) => b.cantidadMinima - a.cantidadMinima,
    );
  }

  calcular({ subtotal, cantidadTotal }: DescuentoContexto): number {
    const tramo = this.#tramos.find(
      ({ cantidadMinima }) => cantidadTotal >= cantidadMinima,
    );

    if (!tramo) {
      return 0;
    }

    return redondearMoneda(subtotal * tramo.porcentaje);
  }
}
