import { DomainError } from '../../../shared/errors/domain-error.js';

import type { CajaRepository } from './caja.repository.js';
import type { Caja } from './caja.types.js';

export class CajaService {
  readonly #repository: CajaRepository;

  constructor(repository: CajaRepository) {
    this.#repository = repository;
  }

  async abrirCaja(usuarioId: string, montoInicial: number): Promise<Caja> {
    if (typeof montoInicial !== 'number' || Number.isNaN(montoInicial) || montoInicial < 0) {
      throw new DomainError('El monto inicial no puede ser negativo', {
        code: 'MONTO_INVALIDO',
        statusCode: 400,
      });
    }

    const existente = await this.#repository.obtenerCajaAbiertaPorUsuario(usuarioId);

    if (existente) {
      throw new DomainError('El usuario ya tiene una caja abierta', {
        code: 'CAJA_YA_ABIERTA',
        statusCode: 409,
      });
    }

    return this.#repository.abrirCaja({ usuarioId, montoInicial });
  }

  async cerrarCaja(id: string, montoFinal: number): Promise<Caja> {
    if (typeof montoFinal !== 'number' || Number.isNaN(montoFinal) || montoFinal < 0) {
      throw new DomainError('El monto final no puede ser negativo', {
        code: 'MONTO_INVALIDO',
        statusCode: 400,
      });
    }

    const caja = await this.#repository.cerrarCaja(id, { montoFinal });

    if (!caja) {
      throw new DomainError('La caja no existe o ya está cerrada', {
        code: 'CAJA_NO_ABIERTA',
        statusCode: 409,
      });
    }

    return caja;
  }

  async listarCajas(): Promise<Caja[]> {
    return this.#repository.listarCajas();
  }
}
