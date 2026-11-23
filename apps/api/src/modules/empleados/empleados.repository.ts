import type { Kysely } from 'kysely';

import type { Database } from '../../shared/db/schema.js';
import type { Empleado } from './empleados.types.js';

type Executor = Kysely<Database>;

function mapEmpleado(row: Empleado): Empleado {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono,
    activo: row.activo,
  };
}

export class EmpleadosRepository {
  readonly #db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.#db = db;
  }

  async listarEmpleados(): Promise<Empleado[]> {
    const rows = await this.#db
      .selectFrom('empleados')
      .selectAll()
      .orderBy('nombre')
      .execute();

    return rows.map(mapEmpleado);
  }

  async obtenerEmpleado(id: string): Promise<Empleado | null> {
    const row = await this.#db
      .selectFrom('empleados')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? mapEmpleado(row) : null;
  }

  async obtenerEmpleadoParaCita(
    executor: Executor,
    id: string,
  ): Promise<Empleado | null> {
    const row = await executor
      .selectFrom('empleados')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();

    return row ? mapEmpleado(row) : null;
  }
}
