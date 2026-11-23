import type { Kysely } from 'kysely';

import type { Database } from '../../shared/db/schema.js';
import { Cita } from './domain/cita.js';
import type { EstadoCita } from './domain/cita-estado.js';

type Executor = Kysely<Database>;

interface CitaRow {
  id: string;
  cliente_id: string;
  empleado_id: string | null;
  inicio: Date;
  fin: Date;
  estado: EstadoCita;
  notas: string | null;
}

function mapCita(row: CitaRow): Cita {
  return new Cita({
    id: row.id,
    clienteId: row.cliente_id,
    empleadoId: row.empleado_id,
    inicio: row.inicio,
    fin: row.fin,
    estado: row.estado,
    notas: row.notas,
  });
}

export class CitasRepository {
  async crear(db: Executor, cita: Cita): Promise<Cita> {
    const row = await db
      .insertInto('citas')
      .values({
        id: cita.id,
        cliente_id: cita.clienteId,
        empleado_id: cita.empleadoId,
        inicio: cita.inicio,
        fin: cita.fin,
        estado: cita.estado,
        notas: cita.notas,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapCita(row as CitaRow);
  }

  async obtener(db: Executor, id: string): Promise<Cita | undefined> {
    const row = await db
      .selectFrom('citas')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? mapCita(row as CitaRow) : undefined;
  }

  async listar(db: Executor, desde?: Date, hasta?: Date): Promise<Cita[]> {
    let query = db.selectFrom('citas').selectAll().orderBy('inicio', 'asc');

    if (desde) {
      query = query.where('inicio', '>=', desde);
    }

    if (hasta) {
      query = query.where('fin', '<=', hasta);
    }

    const rows = await query.execute();
    return rows.map((row) => mapCita(row as CitaRow));
  }

  async actualizarEstado(
    db: Executor,
    id: string,
    esperado: EstadoCita,
    nuevo: EstadoCita,
  ): Promise<boolean> {
    const result = await db
      .updateTable('citas')
      .set({ estado: nuevo })
      .where('id', '=', id)
      .where('estado', '=', esperado)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  async existeSolapamiento(
    db: Executor,
    inicio: Date,
    fin: Date,
    empleadoId?: string | null,
  ): Promise<boolean> {
    let query = db
      .selectFrom('citas')
      .select('id')
      .where('inicio', '<', fin)
      .where('fin', '>', inicio)
      .where('estado', '!=', 'Cancelada');

    query =
      empleadoId === null || empleadoId === undefined
        ? query.where('empleado_id', 'is', null)
        : query.where('empleado_id', '=', empleadoId);

    const row = await query.executeTakeFirst();
    return row !== undefined;
  }
}
