// Patrón: Repository

import type { Kysely } from 'kysely';

import type { Database } from '../../shared/db/schema.js';

type Executor = Kysely<Database>;

interface UsuarioRow {
  id: string;
  nombre: string;
  rol: string;
  hash_password: string;
  creado_en: Date;
}

function mapUsuario(row: UsuarioRow): Usuario {
  return {
    id: row.id,
    nombre: row.nombre,
    rol: row.rol,
    hashPassword: row.hash_password,
  };
}

export interface Usuario {
  id: string;
  nombre: string;
  rol: string;
  hashPassword: string;
}

export interface CrearUsuarioInput {
  nombre: string;
  rol: string;
  hashPassword: string;
}

export interface LoginInput {
  nombre: string;
  password: string;
}

export class AuthRepository {
  readonly #db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.#db = db;
  }

  async obtenerUsuarioPorNombre(nombre: string): Promise<Usuario | null> {
    const row = await this.#db
      .selectFrom('usuarios')
      .selectAll()
      .where('nombre', '=', nombre)
      .executeTakeFirst();

    return row ? mapUsuario(row as unknown as UsuarioRow) : null;
  }

  async obtenerUsuarioPorId(id: string): Promise<Usuario | null> {
    const row = await this.#db
      .selectFrom('usuarios')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? mapUsuario(row as unknown as UsuarioRow) : null;
  }

  async crearUsuario(executor: Executor, datos: CrearUsuarioInput): Promise<Usuario> {
    const row = await executor
      .insertInto('usuarios')
      .values({
        nombre: datos.nombre,
        rol: datos.rol,
        hash_password: datos.hashPassword,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapUsuario(row as unknown as UsuarioRow);
  }

  async crearSesion(
    executor: Executor,
    datos: {
      usuarioId: string;
      tokenHash: string;
      expiraEn: Date;
    },
  ): Promise<void> {
    await executor
      .insertInto('sesiones')
      .values({
        usuario_id: datos.usuarioId,
        token_hash: datos.tokenHash,
        expira_en: datos.expiraEn,
      })
      .execute();
  }

  async obtenerSesionValida(tokenHash: string): Promise<boolean> {
    const row = await this.#db
      .selectFrom('sesiones')
      .select('id')
      .where('token_hash', '=', tokenHash)
      .where('expira_en', '>', new Date())
      .executeTakeFirst();

    return row !== undefined;
  }

  async invalidarSesion(tokenHash: string): Promise<void> {
    await this.#db
      .deleteFrom('sesiones')
      .where('token_hash', '=', tokenHash)
      .execute();
  }

  async invalidarSesionesUsuario(usuarioId: string): Promise<void> {
    await this.#db
      .deleteFrom('sesiones')
      .where('usuario_id', '=', usuarioId)
      .execute();
  }

  async listarUsuarios(rol?: string): Promise<Usuario[]> {
    let query = this.#db.selectFrom('usuarios').selectAll();

    if (rol) {
      query = query.where('rol', '=', rol);
    }

    const rows = await query.execute();
    return rows.map((row) => mapUsuario(row as unknown as UsuarioRow));
  }
}
