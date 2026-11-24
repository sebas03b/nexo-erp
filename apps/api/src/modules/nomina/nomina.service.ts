import { randomUUID } from 'node:crypto';
import type { UnitOfWork } from '../../shared/db/unit-of-work.js';
import type { AppEventMap } from '../../shared/events/event-map.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import type { CadenaLiquidacion } from './cadena-liquidacion.js';
import type { NominaRepository } from './nomina.repository.js';
import type {
  EntradaConcepto,
  LiquidacionResultado,
} from './domain/tipos.js';

export class NominaService {
  readonly #repository: NominaRepository;
  readonly #cadena: CadenaLiquidacion;
  readonly #unitOfWork: UnitOfWork<AppEventMap>;

  constructor(
    repository: NominaRepository,
    cadena: CadenaLiquidacion,
    unitOfWork: UnitOfWork<AppEventMap>,
  ) {
    this.#repository = repository;
    this.#cadena = cadena;
    this.#unitOfWork = unitOfWork;
  }

  async calcularLiquidacion(
    empleadoId: string,
    periodo: string,
    entradas: EntradaConcepto,
  ): Promise<LiquidacionResultado> {
    // 1. Ejecutar la cadena de conceptos (operacion pura en memoria)
    const resultados = await this.#cadena.ejecutar(entradas);

    const totalDevengos = resultados
      .filter((r) => r.tipo === 'devengo')
      .reduce((acc, r) => acc + r.valor, 0);
    const totalDeducciones = resultados
      .filter((r) => r.tipo === 'deduccion')
      .reduce((acc, r) => acc + r.valor, 0);
    const netoAPagar = totalDevengos - totalDeducciones;

    // 2. Verificar que el empleado existe
    const empleado = await this.#unitOfWork.db
      .selectFrom('empleados')
      .select('id')
      .where('id', '=', empleadoId)
      .executeTakeFirst();

    if (!empleado) {
      throw new DomainError('Empleado no encontrado', {
        code: 'EMPLEADO_NO_ENCONTRADO',
        statusCode: 404,
      });
    }

    // 3. Verificar que no exista liquidacion previa
    const existente = await this.#repository.existeLiquidacion(empleadoId, periodo);
    if (existente) {
      throw new DomainError(
        'Ya existe una liquidacion para este empleado y periodo',
        { code: 'LIQUIDACION_YA_EXISTE', statusCode: 409 },
      );
    }

    const liquidacionRow = await this.#unitOfWork.db
      .insertInto('liquidaciones')
      .values({
        id: randomUUID(),
        empleado_id: empleadoId,
        periodo,
        salario_base: entradas.salarioBase,
        total_devengos: totalDevengos,
        total_deducciones: totalDeducciones,
        neto_a_pagar: netoAPagar,
        creado_en: new Date(),
        actualizado_en: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const liquidacion = {
      id: liquidacionRow.id,
      empleadoId: liquidacionRow.empleado_id,
      periodo: liquidacionRow.periodo,
      salarioBase: parseFloat(String(liquidacionRow.salario_base)),
      totalDevengos: parseFloat(String(liquidacionRow.total_devengos)),
      totalDeducciones: parseFloat(String(liquidacionRow.total_deducciones)),
      netoAPagar: parseFloat(String(liquidacionRow.neto_a_pagar)),
      creadoEn: liquidacionRow.creado_en,
      actualizadoEn: liquidacionRow.actualizado_en,
    };

    return {
      id: liquidacion.id,
      empleadoId: liquidacion.empleadoId,
      periodo: liquidacion.periodo,
      salarioBase: liquidacion.salarioBase,
      totalDevengos: liquidacion.totalDevengos,
      totalDeducciones: liquidacion.totalDeducciones,
      netoAPagar: liquidacion.netoAPagar,
      conceptos: resultados,
    };
  }

  async listarLiquidaciones(
    empleadoId?: string,
    periodo?: string,
  ): Promise<LiquidacionResultado[]> {
    const liquidaciones = await this.#repository.listarLiquidaciones(
      empleadoId,
      periodo,
    );

    return liquidaciones.map((l) => ({
      id: l.id,
      empleadoId: l.empleadoId,
      periodo: l.periodo,
      salarioBase: l.salarioBase,
      totalDevengos: l.totalDevengos,
      totalDeducciones: l.totalDeducciones,
      netoAPagar: l.netoAPagar,
      conceptos: [],
    }));
  }

  async obtenerLiquidacion(id: string): Promise<LiquidacionResultado> {
    const liquidacion = await this.#repository.obtenerLiquidacionPorId(id);

    if (!liquidacion) {
      throw new DomainError('Liquidacion no encontrada', {
        code: 'LIQUIDACION_NO_ENCONTRADA',
        statusCode: 404,
      });
    }

    return {
      id: liquidacion.id,
      empleadoId: liquidacion.empleadoId,
      periodo: liquidacion.periodo,
      salarioBase: liquidacion.salarioBase,
      totalDevengos: liquidacion.totalDevengos,
      totalDeducciones: liquidacion.totalDeducciones,
      netoAPagar: liquidacion.netoAPagar,
      conceptos: [],
    };
  }
}
