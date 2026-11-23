import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { UnitOfWork } from '../../shared/db/unit-of-work.js';
import {
  DomainError,
  RecursoNoEncontrado,
} from '../../shared/errors/domain-error.js';
import type { AppEventMap } from '../../shared/events/event-map.js';
import { Cita } from './domain/cita.js';
import type { EstadoCita } from './domain/cita-estado.js';
import type { CitasRepository } from './citas.repository.js';
import type { CitaDetalle } from './citas.types.js';
import type {
  ConsultorEmpleadosParaCita,
  VerificadorClienteParaCita,
} from './ports.js';

export interface CrearCitaInput {
  clienteId: string;
  empleadoId: string;
  inicio: string;
  fin: string;
  motivo?: string;
}

export interface FiltrosCitasInput {
  desde?: string;
  hasta?: string;
  estado?: EstadoCita;
}

type TransicionCita = 'confirmar' | 'iniciar' | 'completar' | 'cancelar';

const FECHA_ISO = z.iso.datetime({ offset: true });

function analizarFecha(valor: string, campo: string): Date {
  const validacion = FECHA_ISO.safeParse(valor);
  const fecha = new Date(valor);

  if (!validacion.success || Number.isNaN(fecha.getTime())) {
    throw new DomainError(`La fecha ${campo} de la cita es inválida`, {
      code: 'CITA_FECHAS_INVALIDAS',
      statusCode: 400,
    });
  }

  return fecha;
}

export class CitasService {
  readonly #repository: CitasRepository;
  readonly #unitOfWork: UnitOfWork<AppEventMap>;
  readonly #clientes: VerificadorClienteParaCita;
  readonly #empleados: ConsultorEmpleadosParaCita;

  constructor(
    repository: CitasRepository,
    unitOfWork: UnitOfWork<AppEventMap>,
    clientes: VerificadorClienteParaCita,
    empleados: ConsultorEmpleadosParaCita,
  ) {
    this.#repository = repository;
    this.#unitOfWork = unitOfWork;
    this.#clientes = clientes;
    this.#empleados = empleados;
  }

  async listarCitas(filtros: FiltrosCitasInput = {}): Promise<CitaDetalle[]> {
    return this.#repository.listarCitas({
      desde: filtros.desde
        ? analizarFecha(filtros.desde, 'desde')
        : undefined,
      hasta: filtros.hasta
        ? analizarFecha(filtros.hasta, 'hasta')
        : undefined,
      estado: filtros.estado,
    });
  }

  async obtenerCita(id: string): Promise<CitaDetalle> {
    const cita = await this.#repository.obtenerCita(id);

    if (!cita) {
      throw new RecursoNoEncontrado('CITA_NO_ENCONTRADA', 'Cita no encontrada');
    }

    return cita;
  }

  async crearCita(data: CrearCitaInput): Promise<CitaDetalle> {
    const inicio = analizarFecha(data.inicio, 'inicio');
    const fin = analizarFecha(data.fin, 'fin');

    if (fin.getTime() <= inicio.getTime()) {
      throw new DomainError(
        'Las fechas de la cita son inválidas: fin debe ser posterior a inicio',
        {
          code: 'CITA_FECHAS_INVALIDAS',
          statusCode: 400,
        },
      );
    }

    return this.#unitOfWork.execute(async ({ db }) => {
      const empleado = await this.#empleados.obtenerEmpleado(data.empleadoId, db);

      if (!empleado) {
        throw new RecursoNoEncontrado(
          'EMPLEADO_NO_ENCONTRADO',
          'Empleado no encontrado',
        );
      }

      if (!empleado.activo) {
        throw new DomainError('El empleado no está activo', {
          code: 'EMPLEADO_INACTIVO',
          statusCode: 409,
        });
      }

      const clienteExiste = await this.#clientes.existe(data.clienteId, db);
      if (!clienteExiste) {
        throw new RecursoNoEncontrado(
          'CLIENTE_NO_ENCONTRADO',
          'Cliente no encontrado',
        );
      }

      const solapada = await this.#repository.existeSolapamiento(
        db,
        data.empleadoId,
        inicio,
        fin,
      );

      if (solapada) {
        throw new DomainError('El empleado ya tiene una cita en ese horario', {
          code: 'CITA_SOLAPADA',
          statusCode: 409,
        });
      }

      const citaId = randomUUID();
      await this.#repository.crearCita(db, {
        id: citaId,
        clienteId: data.clienteId,
        empleadoId: data.empleadoId,
        inicio,
        fin,
        motivo: data.motivo?.trim() || null,
      });

      const creada = await this.#repository.obtenerCitaConExecutor(db, citaId);
      if (!creada) {
        throw new Error('No se pudo leer la cita creada');
      }

      return creada;
    });
  }

  confirmarCita(id: string): Promise<CitaDetalle> {
    return this.#transicionar(id, 'confirmar');
  }

  iniciarCita(id: string): Promise<CitaDetalle> {
    return this.#transicionar(id, 'iniciar');
  }

  completarCita(id: string): Promise<CitaDetalle> {
    return this.#transicionar(id, 'completar');
  }

  cancelarCita(id: string): Promise<CitaDetalle> {
    return this.#transicionar(id, 'cancelar');
  }

  async #transicionar(
    id: string,
    transicion: TransicionCita,
  ): Promise<CitaDetalle> {
    const persistida = await this.obtenerCita(id);
    const cita = new Cita({
      id: persistida.id,
      clienteId: persistida.clienteId,
      empleadoId: persistida.empleadoId,
      inicio: new Date(persistida.inicio),
      fin: new Date(persistida.fin),
      estado: persistida.estado,
      motivo: persistida.motivo,
    });
    const estadoEsperado = cita.estado;

    switch (transicion) {
      case 'confirmar':
        cita.confirmar();
        break;
      case 'iniciar':
        cita.iniciar();
        break;
      case 'completar':
        cita.completar();
        break;
      case 'cancelar':
        cita.cancelar();
        break;
    }

    return this.#unitOfWork.execute(async (context) => {
      const actualizada = await this.#repository.actualizarEstado(
        context.db,
        id,
        estadoEsperado,
        cita.estado,
      );

      if (!actualizada) {
        throw new DomainError(
          'La cita cambió de estado antes de completar la operación',
          {
            code: 'CONFLICTO_ESTADO_CITA',
            statusCode: 409,
            details: { estadoEsperado, estadoNuevo: cita.estado },
          },
        );
      }

      if (transicion === 'confirmar') {
        await context.publish('CitaConfirmada', {
          citaId: cita.id,
          clienteId: cita.clienteId,
          empleadoId: cita.empleadoId,
          empleadoNombre: persistida.empleadoNombre,
          motivo: cita.motivo,
          inicio: cita.inicio.toISOString(),
          fin: cita.fin.toISOString(),
          confirmadaEn: new Date().toISOString(),
        });
      }

      const citaActualizada = await this.#repository.obtenerCitaConExecutor(
        context.db,
        id,
      );
      if (!citaActualizada) {
        throw new Error('No se pudo leer la cita actualizada');
      }

      return citaActualizada;
    });
  }
}
