import type { Kysely } from 'kysely';

import {
  traducirErrorBd,
  type TraduccionesErrorBd,
} from '../../shared/db/errores-postgres.js';
import type { Database } from '../../shared/db/schema.js';
import type { CanalPreferido, Cliente, CrearClienteData } from './clientes.types.js';

const TRADUCCIONES_CLIENTE: TraduccionesErrorBd = {
  '23505': {
    code: 'DOCUMENTO_DUPLICADO',
    message: 'Ya existe un cliente con ese documento',
    statusCode: 409,
  },
};

interface ClienteRow {
  id: string;
  nombre: string;
  documento: string;
  email: string | null;
  telefono: string | null;
  canal_preferido: string | null;
}

function mapCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    nombre: row.nombre,
    documento: row.documento,
    email: row.email ?? undefined,
    telefono: row.telefono ?? undefined,
    canalPreferido: (row.canal_preferido ?? 'email') as CanalPreferido,
  };
}

export class ClientesRepository {
  readonly #db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.#db = db;
  }

  async listarClientes(): Promise<Cliente[]> {
    const rows = await this.#db
      .selectFrom('clientes')
      .selectAll()
      .orderBy('nombre')
      .execute();

    return rows.map(mapCliente);
  }

  async obtenerCliente(id: string): Promise<Cliente | undefined> {
    const row = await this.#db
      .selectFrom('clientes')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? mapCliente(row) : undefined;
  }

  async obtenerClientePorDocumento(documento: string): Promise<Cliente | undefined> {
    const row = await this.#db
      .selectFrom('clientes')
      .selectAll()
      .where('documento', '=', documento)
      .executeTakeFirst();

    return row ? mapCliente(row) : undefined;
  }

  async crearCliente(data: CrearClienteData): Promise<Cliente> {
    try {
      const row = await this.#db
        .insertInto('clientes')
        .values({
          nombre: data.nombre,
          documento: data.documento,
          email: data.email ?? null,
          telefono: data.telefono ?? null,
          canal_preferido: data.canalPreferido,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return mapCliente(row);
    } catch (error) {
      traducirErrorBd(error, TRADUCCIONES_CLIENTE);
    }
  }
}
