// Patrón: Repository

import { sql, type Kysely } from 'kysely';

import type { Database } from '../../shared/db/schema.js';
import type { Asiento, ResumenVentas, ProductoVendido } from './contabilidad.types.js';

type Executor = Kysely<Database>;

interface AsientoRow {
  id: string;
  fecha: Date;
  cuenta: string;
  debito: string;
  credito: string;
  origen_id: string;
  metodo_pago: string | null;
  descripcion: string | null;
  created_at: Date;
}

function mapAsiento(row: AsientoRow): Asiento {
  return {
    id: row.id,
    fecha: row.fecha.toISOString(),
    cuenta: row.cuenta,
    debito: Number(row.debito),
    credito: Number(row.credito),
    origenId: row.origen_id,
    metodoPago: row.metodo_pago,
    descripcion: row.descripcion,
    createdAt: row.created_at.toISOString(),
  };
}

export class ContabilidadRepository {
  readonly #db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.#db = db;
  }

  async registrarAsientos(
    executor: Executor,
    movimientos: Array<{ cuenta: string; debito: number; credito: number }>,
    origenId: string,
    fecha: string,
    metodoPago: string | null,
  ): Promise<void> {
    for (const movimiento of movimientos) {
      await executor
        .insertInto('asientos')
        .values({
          cuenta: movimiento.cuenta,
          debito: movimiento.debito,
          credito: movimiento.credito,
          origen_id: origenId,
          metodo_pago: metodoPago,
          descripcion: null,
          fecha: new Date(fecha),
        })
        .onConflict((oc) => oc.columns(['origen_id', 'cuenta']).doNothing())
        .execute();
    }
  }

  async listarAsientos(
    desde?: string,
    hasta?: string,
  ): Promise<Asiento[]> {
    let query = this.#db.selectFrom('asientos').selectAll();

    if (desde) {
      query = query.where('fecha', '>=', new Date(desde));
    }
    if (hasta) {
      query = query.where('fecha', '<=', new Date(hasta));
    }

    const rows = await query.orderBy('fecha', 'desc').execute();
    return rows.map(mapAsiento);
  }

  async resumenVentas(
    desde?: string,
    hasta?: string,
    agrupacion: 'dia' | 'mes' | 'anio' | 'medio_pago' = 'dia',
  ): Promise<ResumenVentas> {
    let query = this.#db
      .selectFrom('asientos')
      .where('cuenta', '=', 'INGRESOS_VENTAS');

    if (desde) {
      query = query.where('fecha', '>=', new Date(desde));
    }
    if (hasta) {
      query = query.where('fecha', '<=', new Date(hasta));
    }

    let datos: Array<{ clave: string; total: number; cantidad: number }>;

    if (agrupacion === 'medio_pago') {
      const rows = await query
        .select([
          'metodo_pago as clave',
          sql<number>`sum(credito)`.as('total'),
          sql<number>`count(id)`.as('cantidad'),
        ])
        .groupBy('metodo_pago')
        .orderBy('clave', 'asc')
        .execute();

      datos = rows.map((row) => ({
        clave: row.clave ?? 'sin_metodo',
        total: Number(row.total ?? 0),
        cantidad: Number(row.cantidad ?? 0),
      }));
    } else {
      let fechaExpr: string;
      if (agrupacion === 'dia') {
        fechaExpr = `to_char(fecha, 'YYYY-MM-DD')`;
      } else if (agrupacion === 'mes') {
        fechaExpr = `to_char(fecha, 'YYYY-MM')`;
      } else {
        fechaExpr = `to_char(fecha, 'YYYY')`;
      }

      const rows = await query
        .select([
          sql.raw(fechaExpr).as('clave'),
          sql<number>`sum(credito)`.as('total'),
          sql<number>`count(id)`.as('cantidad'),
        ])
        .groupBy('clave')
        .orderBy('clave', 'asc')
        .execute();

      datos = rows.map((row) => ({
        clave: (row.clave as string) ?? '',
        total: Number(row.total ?? 0),
        cantidad: Number(row.cantidad ?? 0),
      }));
    }

    const totalVentas = datos.reduce((acc, d) => acc + d.total, 0);
    const cantidadVentas = datos.reduce((acc, d) => acc + d.cantidad, 0);

    return {
      totalVentas,
      cantidadVentas,
      agrupacion,
      datos,
      productosServicios: [] as ProductoVendido[],
    };
  }

  async productosServiciosVendidos(): Promise<ProductoVendido[]> {
    await Promise.resolve();
    return [];
  }
}
