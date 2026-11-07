// Patrón: Strategy

import { DomainError } from '../../../../shared/errors/domain-error.js';
import { redondearMoneda } from '../dinero.js';
import type { DescuentoContexto, DescuentoStrategy } from './descuento.strategy.js';

export interface OpcionesDescuentoPromocion {
  readonly porcentaje?: number;
  readonly montoFijo?: number;
}

const OPCIONES_POR_DEFECTO: OpcionesDescuentoPromocion = { porcentaje: 0.1 };

export class DescuentoPromocion implements DescuentoStrategy {
  readonly nombre = 'promocion';
  readonly #porcentaje: number | null;
  readonly #montoFijo: number | null;

  constructor(opciones: OpcionesDescuentoPromocion = OPCIONES_POR_DEFECTO) {
    const { porcentaje, montoFijo } = opciones;

    if (porcentaje !== undefined && montoFijo !== undefined) {
      throw new DomainError(
        'La promoción debe definir un porcentaje o un monto fijo, pero no ambos',
        {
          code: 'ESTRATEGIA_DESCUENTO_INVALIDA',
          statusCode: 400,
        },
      );
    }

    if (porcentaje === undefined && montoFijo === undefined) {
      throw new DomainError('La promoción debe definir un porcentaje o un monto fijo', {
        code: 'ESTRATEGIA_DESCUENTO_INVALIDA',
        statusCode: 400,
      });
    }

    if (porcentaje !== undefined && (porcentaje < 0 || porcentaje > 1)) {
      throw new DomainError('El porcentaje de la promoción no es válido', {
        code: 'ESTRATEGIA_DESCUENTO_INVALIDA',
        statusCode: 400,
      });
    }

    if (montoFijo !== undefined && montoFijo < 0) {
      throw new DomainError('El monto fijo de la promoción no es válido', {
        code: 'ESTRATEGIA_DESCUENTO_INVALIDA',
        statusCode: 400,
      });
    }

    this.#porcentaje = porcentaje ?? null;
    this.#montoFijo = montoFijo ?? null;
  }

  calcular({ subtotal }: DescuentoContexto): number {
    const descuento = this.#montoFijo ?? subtotal * (this.#porcentaje ?? 0);

    return redondearMoneda(Math.min(Math.max(descuento, 0), subtotal));
  }
}
