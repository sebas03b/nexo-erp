// Patrón: Repository

import { type Kysely } from 'kysely';

import type { Database } from '../../shared/db/schema.js';
import type {
  ConceptoNomina,
  LiquidacionPersistida,
} from './domain/tipos.js';

interface ConceptoRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'devengo' | 'deduccion';
  activo: boolean;
  creado_en: Date;
}

function mapConcepto(row: ConceptoRow): ConceptoNomina {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    tipo: row.tipo,
    activo: row.activo,
  };
}

export class NominaRepository {
  readonly #db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.#db = db;
  }

  async obtenerConceptosActivos(): Promise<ConceptoNomina[]> {
    const rows = await this.#db
      .selectFrom('conceptos_nomina')
      .selectAll()
      .where('activo', '=', true)
      .orderBy('codigo', 'asc')
      .execute();

    return rows.map((row) => mapConcepto(row));
  }

  async crearLiquidacion(
    datos: {
      id: string;
      empleadoId: string;
      periodo: string;
      salarioBase: number;
      totalDevengos: number;
      totalDeducciones: number;
      netoAPagar: number;
      detalle: Record<string, unknown>;
    },
  ): Promise<LiquidacionPersistida> {
    const row = await this.#db
      .insertInto('liquidaciones')
      .values({
        id: datos.id,
        empleado_id: datos.empleadoId,
        periodo: datos.periodo,
        salario_base: datos.salarioBase,
        total_devengos: datos.totalDevengos,
        total_deducciones: datos.totalDeducciones,
        neto_a_pagar: datos.netoAPagar,
        creado_en: new Date(),
        actualizado_en: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      empleadoId: row.empleado_id,
      periodo: row.periodo,
      salarioBase: row.salario_base as unknown as number,
      totalDevengos: row.total_devengos as unknown as number,
      totalDeducciones: row.total_deducciones as unknown as number,
      netoAPagar: row.neto_a_pagar as unknown as number,
      creadoEn: row.creado_en,
      actualizadoEn: row.actualizado_en,
    };
  }

  async obtenerLiquidacionPorId(
    id: string,
  ): Promise<LiquidacionPersistida | null> {
    const row = await this.#db
      .selectFrom('liquidaciones')
      .select([
        'id',
        'empleado_id',
        'periodo',
        'salario_base',
        'total_devengos',
        'total_deducciones',
        'neto_a_pagar',
        'creado_en',
        'actualizado_en',
      ])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      empleadoId: row.empleado_id,
      periodo: row.periodo,
      salarioBase: Number(row.salario_base),
      totalDevengos: Number(row.total_devengos),
      totalDeducciones: Number(row.total_deducciones),
      netoAPagar: Number(row.salario_base) * 0.9,
      creadoEn: row.creado_en,
      actualizadoEn: row.actualizado_en,
    };
  }

  async listarLiquidaciones(
    empleadoId?: string,
    periodo?: string,
  ): Promise<LiquidacionPersistida[]> {
    let query = this.#db.selectFrom('liquidaciones').selectAll();

    if (empleadoId) {
      query = query.where('empleado_id', '=', empleadoId);
    }
    if (periodo) {
      query = query.where('periodo', '=', periodo);
    }

    const rows = await query.orderBy('creado_en', 'desc').execute();
    return rows.map((row) => ({
      id: row.id,
      empleadoId: row.empleado_id,
      periodo: row.periodo,
      salarioBase: Number(row.salario_base),
      totalDevengos: Number(row.total_devengos),
      totalDeducciones: Number(row.total_deducciones),
      netoAPagar: Number(row.salario_base) * 0.9,
      detalle: {},
      creadoEn: row.creado_en,
      actualizadoEn: row.actualizado_en,
    }));
  }

  async existeLiquidacion(
    empleadoId: string,
    periodo: string,
  ): Promise<boolean> {
    const row = await this.#db
      .selectFrom('liquidaciones')
      .select('id')
      .where('empleado_id', '=', empleadoId)
      .where('periodo', '=', periodo)
      .executeTakeFirst();

    return row !== undefined;
  }
}
