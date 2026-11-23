// Patrón: State

import { DomainError } from '../../../shared/errors/domain-error.js';

export type EstadoCita =
  | 'Pendiente'
  | 'Confirmada'
  | 'En Proceso'
  | 'Completada'
  | 'Cancelada';

export abstract class CitaEstado {
  abstract readonly nombre: EstadoCita;

  confirmar(): CitaEstado {
    return this.rechazar('Confirmada');
  }

  iniciar(): CitaEstado {
    return this.rechazar('En Proceso');
  }

  completar(): CitaEstado {
    return this.rechazar('Completada');
  }

  cancelar(): CitaEstado {
    return this.rechazar('Cancelada');
  }

  protected rechazar(destino: EstadoCita): never {
    throw new DomainError(
      `Transición de cita inválida: ${this.nombre} → ${destino}`,
      {
        code: 'TRANSICION_CITA_INVALIDA',
        statusCode: 409,
        details: { estadoActual: this.nombre, estadoDestino: destino },
      },
    );
  }
}
