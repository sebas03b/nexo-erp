import type { Kysely } from 'kysely';

import {
  traducirErrorBd,
  type TraduccionesErrorBd,
} from '../../shared/db/errores-postgres.js';
import type { Database } from '../../shared/db/schema.js';
import {
  normalizarCanalNotificacion,
  type CanalNotificacion,
} from '../../shared/types/canal-notificacion.js';
import type {
  ActualizarClienteData,
  Cliente,
  CrearClienteData,
} from './clientes.types.js';

const TRADUCCIONES_CLIENTE: TraduccionesErrorBd = {
  '23505': {
    code: 'DOCUMENTO_DUPLICADO',
    message: 'Ya existe un cliente con ese documento',
    statusCode: 409,
  },
};

const TRADUCCIONES_ELIMINACION_CLIENTE: TraduccionesErrorBd = {
  '23503': {
    code: 'CLIENTE_EN_USO',
    message:
      'El cliente tiene pedidos asociados y no se puede eliminar',
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
    canalPreferido: normalizarCanalNotificacion(row.canal_preferido),
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

  async obtenerClienteBloqueado(
    executor: Kysely<Database>,
    id: string,
  ): Promise<Cliente | undefined> {
    const row = await executor
      .selectFrom('clientes')
      .selectAll()
      .where('id', '=', id)
      .forKeyShare()
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

  async actualizarCliente(
    id: string,
    data: ActualizarClienteData,
  ): Promise<Cliente | undefined> {
    const cambios: {
      email?: string | null;
      telefono?: string | null;
      canal_preferido?: CanalNotificacion;
    } = {};

    if (data.email !== undefined) {
      cambios.email = data.email;
    }

    if (data.telefono !== undefined) {
      cambios.telefono = data.telefono;
    }

    if (data.canalPreferido !== undefined) {
      cambios.canal_preferido = data.canalPreferido;
    }

    if (Object.keys(cambios).length === 0) {
      return this.obtenerCliente(id);
    }

    const row = await this.#db
      .updateTable('clientes')
      .set(cambios)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return row ? mapCliente(row) : undefined;
  }

  async eliminarCliente(id: string): Promise<boolean> {
    try {
      const result = await this.#db
        .deleteFrom('clientes')
        .where('id', '=', id)
        .executeTakeFirst();

      return Number(result.numDeletedRows) > 0;
    } catch (error) {
      traducirErrorBd(error, TRADUCCIONES_ELIMINACION_CLIENTE);
    }
  }
}
