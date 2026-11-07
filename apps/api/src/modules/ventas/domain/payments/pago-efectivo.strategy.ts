// Patrón: Strategy

import { randomUUID } from 'node:crypto';

import { DomainError } from '../../../../shared/errors/domain-error.js';
import { redondearMoneda } from '../dinero.js';
import type { PagoContexto, PagoStrategy, ResultadoPago } from './pago.strategy.js';

export class PagoEfectivo implements PagoStrategy {
  readonly metodo = 'efectivo';

  cobrar({
    monto,
    montoRecibido = monto,
  }: PagoContexto): Promise<ResultadoPago> {
    if (monto < 0) {
      return Promise.reject(
        new DomainError('El monto a cobrar no puede ser negativo', {
          code: 'PAGO_INVALIDO',
          statusCode: 400,
        }),
      );
    }

    if (montoRecibido < monto) {
      return Promise.reject(
        new DomainError('El efectivo recibido no cubre el total del pedido', {
          code: 'PAGO_INSUFICIENTE',
          statusCode: 400,
          details: { monto, montoRecibido },
        }),
      );
    }

    return Promise.resolve({
      metodo: this.metodo,
      monto: redondearMoneda(monto),
      cambio: redondearMoneda(montoRecibido - monto),
      referencia: `EFECTIVO-${randomUUID()}`,
    });
  }
}
