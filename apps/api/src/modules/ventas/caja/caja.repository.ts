// Patrón: Repository

import type { Kysely } from 'kysely';

import type { Database } from '../../../shared/db/schema.js';
import type {
  Caja,
  CajaRow,
  CerrarCajaInput,
  CrearCajaInput,
} from './caja.types.js';

export class CajaRepository {
  readonly #db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.#db = db;
  }

  async abrirCaja(data: CrearCajaInput): Promise<Caja> {
    const row = await this.#db
      .insertInto('cajas')
      .values({
        usuario_id: data.usuarioId,
        apertura: new Date(),
        cierre: null,
        monto_inicial: data.montoInicial,
        monto_final: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapCaja(row);
  }

  async obtenerCajaAbiertaPorUsuario(usuarioId: string): Promise<Caja | null> {
    const row = await this.#db
      .selectFrom('cajas')
      .selectAll()
      .where('usuario_id', '=', usuarioId)
      .where('cierre', 'is', null)
      .executeTakeFirst();

    return row ? mapCaja(row) : null;
  }

  async cerrarCaja(id: string, datos: CerrarCajaInput): Promise<Caja | null> {
    const row = await this.#db
      .updateTable('cajas')
      .set({
        cierre: new Date(),
        monto_final: datos.montoFinal,
      })
      .where('id', '=', id)
      .where('cierre', 'is', null)
      .returningAll()
      .executeTakeFirst();

    return row ? mapCaja(row) : null;
  }

  async listarCajas(): Promise<Caja[]> {
    const rows = await this.#db
      .selectFrom('cajas')
      .selectAll()
      .orderBy('apertura', 'desc')
      .execute();

    return rows.map(mapCaja);
  }
}

function mapCaja(row: CajaRow): Caja {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    apertura: row.apertura,
    cierre: row.cierre,
    montoInicial: Number(row.monto_inicial),
    montoFinal: row.monto_final === null ? null : Number(row.monto_final),
  };
}
