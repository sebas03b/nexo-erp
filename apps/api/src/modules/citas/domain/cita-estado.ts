// Patrón: State

import { DomainError } from '../../../shared/errors/domain-error.js';

export const ESTADOS_CITA = [
  'Pendiente',
  'Confirmada',
  'En Proceso',
  'Completada',
  'Cancelada',
] as const;

export type EstadoCita = (typeof ESTADOS_CITA)[number];

export class TransicionCitaInvalida extends DomainError {
  constructor(actual: EstadoCita, intento: EstadoCita) {
    super(`Transición de cita inválida: ${actual} → ${intento}`, {
      code: 'TRANSICION_INVALIDA',
      statusCode: 409,
    });
  }
}

export abstract class CitaEstado {
  abstract readonly nombre: EstadoCita;

  confirmar(): CitaEstado {
    throw new TransicionCitaInvalida(this.nombre, 'Confirmada');
  }

  iniciar(): CitaEstado {
    throw new TransicionCitaInvalida(this.nombre, 'En Proceso');
  }

  completar(): CitaEstado {
    throw new TransicionCitaInvalida(this.nombre, 'Completada');
  }

  cancelar(): CitaEstado {
    throw new TransicionCitaInvalida(this.nombre, 'Cancelada');
  }
}
