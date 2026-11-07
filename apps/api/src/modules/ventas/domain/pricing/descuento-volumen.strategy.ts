// Patrón: Strategy

import { DomainError } from '../../../../shared/errors/domain-error.js';
import { redondearMoneda } from '../dinero.js';
import type { DescuentoContexto, DescuentoStrategy } from './descuento.strategy.js';

export interface TramoDescuentoVolumen {
  readonly subtotalMinimo: number;
  readonly porcentaje: number;
}

const TRAMOS_POR_DEFECTO: readonly TramoDescuentoVolumen[] = [
  { subtotalMinimo: 1000, porcentaje: 0.1 },
  { subtotalMinimo: 500, porcentaje: 0.05 },
];

export class DescuentoPorVolumen implements DescuentoStrategy {
  readonly nombre = 'volumen';
  readonly #tramos: readonly TramoDescuentoVolumen[];

  constructor(tramos: readonly TramoDescuentoVolumen[] = TRAMOS_POR_DEFECTO) {
    for (const tramo of tramos) {
      if (
        tramo.subtotalMinimo < 0 ||
        tramo.porcentaje < 0 ||
        tramo.porcentaje > 1
      ) {
        throw new DomainError('Los tramos de descuento por volumen no son válidos', {
          code: 'ESTRATEGIA_DESCUENTO_INVALIDA',
          statusCode: 400,
        });
      }
    }

    this.#tramos = [...tramos].sort((a, b) => b.subtotalMinimo - a.subtotalMinimo);
  }

  calcular({ subtotal }: DescuentoContexto): number {
    const tramo = this.#tramos.find(
      ({ subtotalMinimo }) => subtotal >= subtotalMinimo,
    );

    if (!tramo) {
      return 0;
    }

    return redondearMoneda(subtotal * tramo.porcentaje);
  }
}
