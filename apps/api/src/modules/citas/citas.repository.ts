// Patrón: Repository

import { sql, type Kysely } from 'kysely';

import type { Database, EstadoCitaPersistido } from '../../shared/db/schema.js';
import type { EstadoCita } from './domain/cita-estado.js';
import type {
  CitaDetalle,
  CitaPersistida,
  CrearCitaPersistidaData,
  FiltrosCitas,
} from './citas.types.js';

type Executor = Kysely<Database>;

interface CitaRow {
  id: string;
  cliente_id: string;
  empleado_id: string;
  inicio: Date;
  fin: Date;
  estado: EstadoCitaPersistido;
  motivo: string | null;
}

interface CitaDetalleRow extends CitaRow {
  cliente_nombre: string;
  empleado_nombre: string;
}

function mapCitaPersistida(row: CitaRow): CitaPersistida {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    empleadoId: row.empleado_id,
    inicio: row.inicio,
    fin: row.fin,
    estado: row.estado,
    motivo: row.motivo,
  };
}

function mapCitaDetalle(row: CitaDetalleRow): CitaDetalle {
  return {
    ...mapCitaPersistida(row),
    clienteNombre: row.cliente_nombre,
    empleadoNombre: row.empleado_nombre,
    inicio: row.inicio.toISOString(),
    fin: row.fin.toISOString(),
  };
}

export class CitasRepository {
  readonly #db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.#db = db;
  }

  async listarCitas(filtros: FiltrosCitas = {}): Promise<CitaDetalle[]> {
    let query = this.#db
      .selectFrom('citas')
      .innerJoin('clientes', 'clientes.id', 'citas.cliente_id')
      .innerJoin('empleados', 'empleados.id', 'citas.empleado_id')
      .select([
        'citas.id',
        'citas.cliente_id',
        'citas.empleado_id',
        'citas.inicio',
        'citas.fin',
        'citas.estado',
        'citas.motivo',
        'clientes.nombre as cliente_nombre',
        'empleados.nombre as empleado_nombre',
      ]);

    if (filtros.desde) {
      query = query.where('citas.fin', '>', filtros.desde);
    }

    if (filtros.hasta) {
      query = query.where('citas.inicio', '<', filtros.hasta);
    }

    if (filtros.estado) {
      query = query.where('citas.estado', '=', filtros.estado);
    }

    const rows = await query.orderBy('citas.inicio', 'asc').execute();
    return rows.map(mapCitaDetalle);
  }

  async obtenerCita(id: string): Promise<CitaDetalle | null> {
    return this.obtenerCitaConExecutor(this.#db, id);
  }

  async obtenerCitaConExecutor(
    executor: Executor,
    id: string,
  ): Promise<CitaDetalle | null> {
    const row = await executor
      .selectFrom('citas')
      .innerJoin('clientes', 'clientes.id', 'citas.cliente_id')
      .innerJoin('empleados', 'empleados.id', 'citas.empleado_id')
      .select([
        'citas.id',
        'citas.cliente_id',
        'citas.empleado_id',
        'citas.inicio',
        'citas.fin',
        'citas.estado',
        'citas.motivo',
        'clientes.nombre as cliente_nombre',
        'empleados.nombre as empleado_nombre',
      ])
      .where('citas.id', '=', id)
      .executeTakeFirst();

    return row ? mapCitaDetalle(row) : null;
  }

  async crearCita(
    executor: Executor,
    data: CrearCitaPersistidaData,
  ): Promise<CitaPersistida> {
    const row = await executor
      .insertInto('citas')
      .values({
        id: data.id,
        cliente_id: data.clienteId,
        empleado_id: data.empleadoId,
        inicio: data.inicio,
        fin: data.fin,
        estado: 'Pendiente',
        motivo: data.motivo,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapCitaPersistida(row);
  }

  async existeSolapamiento(
    executor: Executor,
    empleadoId: string,
    inicio: Date,
    fin: Date,
  ): Promise<boolean> {
    const existente = await executor
      .selectFrom('citas')
      .select('id')
      .where('empleado_id', '=', empleadoId)
      .where('estado', '!=', 'Cancelada')
      .where('inicio', '<', fin)
      .where('fin', '>', inicio)
      .executeTakeFirst();

    return existente !== undefined;
  }

  async actualizarEstado(
    executor: Executor,
    id: string,
    estadoEsperado: EstadoCita,
    estadoNuevo: EstadoCita,
  ): Promise<boolean> {
    const result = await executor
      .updateTable('citas')
      .set({ estado: estadoNuevo, actualizado_en: sql`now()` })
      .where('id', '=', id)
      .where('estado', '=', estadoEsperado)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }
}
