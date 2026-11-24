import { randomUUID } from 'node:crypto';

import type { UnitOfWork } from '../../shared/db/unit-of-work.js';
import { DomainError, RecursoNoEncontrado } from '../../shared/errors/domain-error.js';
import type { AppEventMap } from '../../shared/events/app-event-map.js';
import type { CitasRepository } from './citas.repository.js';
import { Cita } from './domain/cita.js';

export type AccionCita = 'confirmar' | 'iniciar' | 'completar' | 'cancelar';

export interface CrearCitaData {
  clienteId: string;
  empleadoId?: string | null;
  inicio: Date;
  fin: Date;
  notas?: string | null;
}

export class CitasService {
  constructor(
    private readonly repo: CitasRepository,
    private readonly uow: UnitOfWork<AppEventMap>,
  ) {}

  async crear(data: CrearCitaData): Promise<Cita> {
    if (data.fin <= data.inicio) {
      throw new DomainError('La fecha de fin debe ser posterior a la de inicio.', {
        code: 'RANGO_INVALIDO',
        statusCode: 400,
      });
    }

    const cliente = await this.uow.db
      .selectFrom('clientes')
      .select('id')
      .where('id', '=', data.clienteId)
      .executeTakeFirst();

    if (!cliente) {
      throw new RecursoNoEncontrado('CLIENTE_NO_ENCONTRADO', 'Cliente no encontrado');
    }

    const empleadoId = data.empleadoId ?? null;
    const solapada = await this.repo.existeSolapamiento(
      this.uow.db,
      data.inicio,
      data.fin,
      empleadoId,
    );

    if (solapada) {
      throw new DomainError('El horario seleccionado ya está ocupado.', {
        code: 'HORARIO_OCUPADO',
        statusCode: 409,
      });
    }

    const cita = Cita.crear({
      id: randomUUID(),
      clienteId: data.clienteId,
      empleadoId,
      inicio: data.inicio,
      fin: data.fin,
      notas: data.notas ?? null,
    });

    return this.repo.crear(this.uow.db, cita);
  }

  async listar(desde?: Date, hasta?: Date): Promise<Cita[]> {
    return this.repo.listar(this.uow.db, desde, hasta);
  }

  async obtener(id: string): Promise<Cita> {
    const cita = await this.repo.obtener(this.uow.db, id);
    if (!cita) {
      throw new RecursoNoEncontrado('CITA_NO_ENCONTRADA', 'Cita no encontrada');
    }
    return cita;
  }

  async cambiarEstado(id: string, accion: AccionCita): Promise<Cita> {
    return this.uow.execute(async (ctx) => {
      const cita = await this.repo.obtener(ctx.db, id);
      if (!cita) {
        throw new RecursoNoEncontrado('CITA_NO_ENCONTRADA', 'Cita no encontrada');
      }

      const anterior = cita.estado;
      cita[accion]();

      const ok = await this.repo.actualizarEstado(ctx.db, id, anterior, cita.estado);
      if (!ok) {
        throw new DomainError('La cita cambió de estado', {
          code: 'CONFLICTO_ESTADO_CITA',
          statusCode: 409,
        });
      }

      if (accion === 'confirmar') {
        await ctx.publish('CitaConfirmada', {
          citaId: cita.id,
          clienteId: cita.clienteId,
          inicio: cita.inicio.toISOString(),
          fin: cita.fin.toISOString(),
          confirmadaEn: new Date().toISOString(),
        });
      }

      return cita;
    });
  }
}
