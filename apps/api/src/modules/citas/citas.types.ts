import type { EstadoCita } from './domain/cita-estado.js';

export interface CitaPersistida {
  id: string;
  clienteId: string;
  empleadoId: string;
  inicio: Date;
  fin: Date;
  estado: EstadoCita;
  motivo: string | null;
}

export interface CitaDetalle extends Omit<CitaPersistida, 'inicio' | 'fin'> {
  clienteNombre: string;
  empleadoNombre: string;
  inicio: string;
  fin: string;
}

export interface CrearCitaPersistidaData {
  id: string;
  clienteId: string;
  empleadoId: string;
  inicio: Date;
  fin: Date;
  motivo: string | null;
}

export interface FiltrosCitas {
  desde?: Date;
  hasta?: Date;
  estado?: EstadoCita;
}
