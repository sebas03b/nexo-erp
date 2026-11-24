// Patrón: Repository

import { type Kysely } from 'kysely';

import type { Database } from '../../shared/db/schema.js';
import type {
  ConceptoNomina,
  LiquidacionPersistida,
} from './domain/tipos.js';

type Executor = Kysely<Database>;

interface ConceptoRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'devengo' | 'deduccion';
  activo: boolean;
  creado_en: Date;
}

interface LiquidacionRow {
  id: string;
  empleado_id: string;
  periodo: string;
  salario_base: string;
  total_devengos: string;
  total_deducciones: string;
  neto_a_pagar: string;
  detalle: object;
  creado_en: Date;
  actualizado_en: Date;
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

function mapLiquidacion(row: LiquidacionRow): LiquidacionPersistida {
  return {
    id: row.id,
    empleadoId: row.empleado_id,
    periodo: row.periodo,
    salarioBase: Number(row.salario_base),
    totalDevengos: Number(row.total_devengos),
    totalDeducciones: Number(row.total_deducciones),
    netoAPagar: Number(row.neto_a_pagar),
    detalle: row.detalle as Record<string, unknown>,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
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

    return rows.map((row) => mapConcepto(row as unknown as ConceptoRow));
  }

  async crearLiquidacion(
    executor: Executor,
    datos: {
      empleadoId: string;
      periodo: string;
      salarioBase: number;
      totalDevengos: number;
      totalDeducciones: number;
      netoAPagar: number;
      detalle: Record<string, unknown>;
    },
  ): Promise<LiquidacionPersistida> {
    const row = await executor
      .insertInto('liquidaciones')
      .values({
        empleado_id: datos.empleadoId,
        periodo: datos.periodo,
        salario_base: datos.salarioBase,
        total_devengos: datos.totalDevengos,
        total_deducciones: datos.totalDeducciones,
        neto_a_pagar: datos.netoAPagar,
        detalle: JSON.stringify(datos.detalle),
        creado_en: new Date(),
        actualizado_en: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapLiquidacion(row as unknown as LiquidacionRow);
  }

  async obtenerLiquidacionPorId(
    executor: Executor,
    id: string,
  ): Promise<LiquidacionPersistida | null> {
    const row = await executor
      .selectFrom('liquidaciones')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? mapLiquidacion(row as unknown as LiquidacionRow) : null;
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
    return rows.map((row) => mapLiquidacion(row as unknown as LiquidacionRow));
  }

  async existeLiquidacion(
    executor: Executor,
    empleadoId: string,
    periodo: string,
  ): Promise<boolean> {
    const row = await executor
      .selectFrom('liquidaciones')
      .select('id')
      .where('empleado_id', '=', empleadoId)
      .where('periodo', '=', periodo)
      .executeTakeFirst();

    return row !== undefined;
  }
}
