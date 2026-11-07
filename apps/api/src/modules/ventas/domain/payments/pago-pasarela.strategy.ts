// Patrón: Strategy

import { randomUUID } from 'node:crypto';

import { DomainError } from '../../../../shared/errors/domain-error.js';
import { redondearMoneda } from '../dinero.js';
import type { PagoContexto, PagoStrategy, ResultadoPago } from './pago.strategy.js';

export class PagoPasarela implements PagoStrategy {
  readonly metodo = 'pasarela';

  cobrar({ monto, referencia }: PagoContexto): Promise<ResultadoPago> {
    if (monto < 0) {
      return Promise.reject(
        new DomainError('El monto a cobrar no puede ser negativo', {
          code: 'PAGO_INVALIDO',
          statusCode: 400,
        }),
      );
    }

    return Promise.resolve({
      metodo: this.metodo,
      monto: redondearMoneda(monto),
      cambio: 0,
      referencia: referencia ?? `PASARELA-${randomUUID()}`,
    });
  }
}
