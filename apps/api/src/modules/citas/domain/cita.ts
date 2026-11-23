// Patrón: State

import type { CitaEstado, EstadoCita } from './cita-estado.js';
import { CanceladaState } from './states/cancelada.state.js';
import { CompletadaState } from './states/completada.state.js';
import { ConfirmadaState } from './states/confirmada.state.js';
import { EnProcesoState } from './states/en-proceso.state.js';
import { PendienteState } from './states/pendiente.state.js';

export interface CitaData {
  id: string;
  clienteId: string;
  empleadoId: string | null;
  inicio: Date;
  fin: Date;
  estado: EstadoCita;
  notas: string | null;
}

function crearEstado(estado: EstadoCita): CitaEstado {
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
  }
}

export class Cita {
  readonly id: string;
  readonly clienteId: string;
  readonly empleadoId: string | null;
  readonly inicio: Date;
  readonly fin: Date;
  readonly notas: string | null;

  #estado: CitaEstado;

  constructor(data: CitaData) {
    this.id = data.id;
    this.clienteId = data.clienteId;
    this.empleadoId = data.empleadoId;
    this.inicio = data.inicio;
    this.fin = data.fin;
    this.notas = data.notas;
    this.#estado = crearEstado(data.estado);
  }

  static crear(data: Omit<CitaData, 'estado'>): Cita {
    return new Cita({ ...data, estado: 'Pendiente' });
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

  toJSON() {
    return {
      id: this.id,
      clienteId: this.clienteId,
      empleadoId: this.empleadoId ?? undefined,
      inicio: this.inicio.toISOString(),
      fin: this.fin.toISOString(),
      estado: this.estado,
      notas: this.notas ?? undefined,
    };
  }
}
