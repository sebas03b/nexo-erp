// Patrón: State

import { DomainError } from '../../../shared/errors/domain-error.js';
import type { CitaEstado, EstadoCita } from './cita-estado.js';
import { CanceladaState } from './states/cancelada.state.js';
import { CompletadaState } from './states/completada.state.js';
import { ConfirmadaState } from './states/confirmada.state.js';
import { EnProcesoState } from './states/en-proceso.state.js';
import { PendienteState } from './states/pendiente.state.js';

export interface CitaData {
  id: string;
  clienteId: string;
  empleadoId: string;
  inicio: Date;
  fin: Date;
  estado: EstadoCita;
  motivo?: string | null;
}

export interface CitaJson {
  id: string;
  clienteId: string;
  empleadoId: string;
  inicio: string;
  fin: string;
  estado: EstadoCita;
  motivo: string | null;
}

function validarId(valor: string, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new DomainError(`El campo ${campo} de la cita es obligatorio`, {
      code: 'CITA_DATOS_INVALIDOS',
      statusCode: 400,
    });
  }

  return valor.trim();
}

function validarFechas(inicio: Date, fin: Date): void {
  const inicioValido = inicio instanceof Date && !Number.isNaN(inicio.getTime());
  const finValido = fin instanceof Date && !Number.isNaN(fin.getTime());

  if (!inicioValido || !finValido || fin.getTime() <= inicio.getTime()) {
    throw new DomainError(
      'Las fechas de la cita son inválidas: fin debe ser posterior a inicio',
      {
        code: 'CITA_FECHAS_INVALIDAS',
        statusCode: 400,
      },
    );
  }
}

function normalizarMotivo(motivo: string | null | undefined): string | null {
  if (motivo === null || motivo === undefined) {
    return null;
  }

  const normalizado = motivo.trim();
  return normalizado === '' ? null : normalizado;
}

export function crearEstadoCita(estado: unknown): CitaEstado {
  switch (estado) {
    case 'Pendiente':
      return new PendienteState();
    case 'Confirmada':
      return new ConfirmadaState();
    case 'En Proceso':
      return new EnProcesoState();
    case 'Completada':
      return new CompletadaState();
    case 'Cancelada':
      return new CanceladaState();
    default:
      throw new DomainError('Estado de cita desconocido', {
        code: 'ESTADO_CITA_INVALIDO',
        statusCode: 409,
      });
  }
}

export class Cita {
  readonly id: string;
  readonly #clienteId: string;
  readonly #empleadoId: string;
  readonly #inicio: Date;
  readonly #fin: Date;
  readonly #motivo: string | null;
  #estado: CitaEstado;

  constructor(data: CitaData) {
    this.id = validarId(data.id, 'id');
    this.#clienteId = validarId(data.clienteId, 'clienteId');
    this.#empleadoId = validarId(data.empleadoId, 'empleadoId');
    validarFechas(data.inicio, data.fin);
    this.#inicio = new Date(data.inicio.getTime());
    this.#fin = new Date(data.fin.getTime());
    this.#motivo = normalizarMotivo(data.motivo);
    this.#estado = crearEstadoCita(data.estado);
  }

  get clienteId(): string {
    return this.#clienteId;
  }

  get empleadoId(): string {
    return this.#empleadoId;
  }

  get inicio(): Date {
    return new Date(this.#inicio.getTime());
  }

  get fin(): Date {
    return new Date(this.#fin.getTime());
  }

  get motivo(): string | null {
    return this.#motivo;
  }

  get estado(): EstadoCita {
    return this.#estado.nombre;
  }

  confirmar(): void {
    this.#estado = this.#estado.confirmar();
  }

  iniciar(): void {
    this.#estado = this.#estado.iniciar();
  }

  completar(): void {
    this.#estado = this.#estado.completar();
  }

  cancelar(): void {
    this.#estado = this.#estado.cancelar();
  }

  toJSON(): CitaJson {
    return {
      id: this.id,
      clienteId: this.#clienteId,
      empleadoId: this.#empleadoId,
      inicio: this.#inicio.toISOString(),
      fin: this.#fin.toISOString(),
      estado: this.estado,
      motivo: this.#motivo,
    };
  }
}
