// Patrón: Strategy

import type { ImpuestoStrategy } from './impuesto.strategy.js';

export class ImpuestoExento implements ImpuestoStrategy {
  readonly nombre = 'exento';

  calcular(): number {
    return 0;
  }
}
