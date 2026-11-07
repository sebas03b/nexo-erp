// Patrón: Strategy

import { DomainError } from '../../../../shared/errors/domain-error.js';
import { redondearMoneda } from '../dinero.js';
import type { ImpuestoContexto, ImpuestoStrategy } from './impuesto.strategy.js';

const TASA_POR_DEFECTO = 0.19;

export class ImpuestoIva implements ImpuestoStrategy {
  readonly nombre = 'iva';
  readonly #tasa: number;

  constructor(tasa: number = TASA_POR_DEFECTO) {
    if (tasa < 0 || tasa > 1) {
      throw new DomainError('La tasa de IVA no es válida', {
        code: 'ESTRATEGIA_IMPUESTO_INVALIDA',
        statusCode: 400,
      });
    }

    this.#tasa = tasa;
  }

  calcular({ baseImponible }: ImpuestoContexto): number {
    return redondearMoneda(baseImponible * this.#tasa);
  }
}
