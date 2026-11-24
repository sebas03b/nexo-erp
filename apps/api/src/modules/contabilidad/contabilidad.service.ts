import type { UnitOfWork } from '../../shared/db/unit-of-work.js';
import type { AppEventMap } from '../../shared/events/event-map.js';
import { construirAsientoVenta } from './domain/asiento.js';
import type { ContabilidadRepository } from './contabilidad.repository.js';
import type {
  Asiento,
  ProductoVendido,
  RegistrarVentaInput,
  ResumenVentas,
} from './contabilidad.types.js';

export class ContabilidadService {
  readonly #repository: ContabilidadRepository;
  readonly #unitOfWork: UnitOfWork<AppEventMap>;

  constructor(
    repository: ContabilidadRepository,
    unitOfWork: UnitOfWork<AppEventMap>,
  ) {
    this.#repository = repository;
    this.#unitOfWork = unitOfWork;
  }

  async registrarVenta(input: RegistrarVentaInput): Promise<void> {
    const movimientos = construirAsientoVenta(input.total);

    await this.#unitOfWork.execute(async (context) => {
      await this.#repository.registrarAsientos(
        context.db,
        movimientos,
        input.pedidoId,
        input.fecha,
        input.metodoPago,
      );
    });
  }

  async listarAsientos(desde?: string, hasta?: string): Promise<Asiento[]> {
    return this.#repository.listarAsientos(desde, hasta);
  }

  async resumenVentas(
    desde?: string,
    hasta?: string,
    agrupacion: 'dia' | 'mes' | 'anio' | 'medio_pago' = 'dia',
  ): Promise<ResumenVentas> {
    const resumen = await this.#repository.resumenVentas(
      desde,
      hasta,
      agrupacion,
    );

    return {
      ...resumen,
      productosServicios: [],
    };
  }

  async productosServiciosVendidos(): Promise<ProductoVendido[]> {
    await Promise.resolve();
    return [];
  }
}
