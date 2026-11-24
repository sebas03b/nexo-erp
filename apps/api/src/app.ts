import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { ZodError } from 'zod';

import { env } from './config/env.js';
import { CitasRepository } from './modules/citas/citas.repository.js';
import { citasRoutes } from './modules/citas/citas.routes.js';
import { CitasService } from './modules/citas/citas.service.js';
import type {
  ConsultorEmpleadosParaCita,
  VerificadorClienteParaCita,
} from './modules/citas/ports.js';
import { ClientesRepository } from './modules/clientes/clientes.repository.js';
import { clientesRoutes } from './modules/clientes/clientes.routes.js';
import { EmpleadosRepository } from './modules/empleados/empleados.repository.js';
import { empleadosRoutes } from './modules/empleados/empleados.routes.js';
import { EmpleadosService } from './modules/empleados/empleados.service.js';
import { InventarioRepository } from './modules/inventario/inventario.repository.js';
import { inventarioRoutes } from './modules/inventario/inventario.routes.js';
import { NotificacionFactory } from './modules/notificaciones/notificacion.factory.js';
import { registrarSuscriptoresNotificaciones } from './modules/notificaciones/notificaciones.suscriptores.js';
import { NotificacionesService } from './modules/notificaciones/notificaciones.service.js';
import type { ConsultorContactos } from './modules/notificaciones/ports.js';
import type { AppEventMap } from './shared/events/event-map.js';
import { PagoEfectivo } from './modules/ventas/domain/payments/pago-efectivo.strategy.js';
import { PagoPasarela } from './modules/ventas/domain/payments/pago-pasarela.strategy.js';
import type { CatalogoProductos, VerificadorClientes } from './modules/ventas/domain/ports.js';
import { DescuentoPorVolumen } from './modules/ventas/domain/pricing/descuento-volumen.strategy.js';
import { ImpuestoExento } from './modules/ventas/domain/pricing/impuesto-exento.strategy.js';
import { CadenaValidacion } from './modules/ventas/domain/validation/cadena-validacion.js';
import { ValidarClienteValido } from './modules/ventas/domain/validation/cadena-validacion.js';
import { ValidarStockSuficiente } from './modules/ventas/domain/validation/cadena-validacion.js';
import { CarritoRepository } from './modules/ventas/pos/carrito.repository.js';
import { carritoRoutes } from './modules/ventas/pos/carrito.routes.js';
import { CarritoService } from './modules/ventas/pos/carrito.service.js';
import { CajaRepository } from './modules/ventas/caja/caja.repository.js';
import { cajaRoutes } from './modules/ventas/caja/caja.routes.js';
import { CajaService } from './modules/ventas/caja/caja.service.js';
import { ContabilidadRepository } from './modules/contabilidad/contabilidad.repository.js';
import { contabilidadRoutes } from './modules/contabilidad/contabilidad.routes.js';
import { ContabilidadService } from './modules/contabilidad/contabilidad.service.js';
import { registrarSuscripcionesContabilidad } from './modules/contabilidad/contabilidad.suscriptores.js';
import { NominaRepository } from './modules/nomina/nomina.repository.js';
import { nominaRoutes } from './modules/nomina/nomina.routes.js';
import { NominaService } from './modules/nomina/nomina.service.js';
import { CadenaLiquidacion } from './modules/nomina/cadena-liquidacion.js';
import { PosCheckoutFacade } from './modules/ventas/pos/pos-checkout.facade.js';
import { AdapterFacturacionElectronicaMock } from './integrations/facturacion-electronica/adapter-mock.js';
import { VentasRepository } from './modules/ventas/ventas.repository.js';
import { ventasRoutes } from './modules/ventas/ventas.routes.js';
import type { EstrategiasVentas } from './modules/ventas/ventas.service.js';
import { createDatabase } from './shared/db/database.js';
import type { Database } from './shared/db/schema.js';
import { UnitOfWork } from './shared/db/unit-of-work.js';
import { DomainError } from './shared/errors/domain-error.js';
import { InMemoryEventBus } from './shared/events/event-bus.js';

export interface BuildAppOptions {
  db?: Kysely<Database>;
  estrategiasVentas?: EstrategiasVentas;
  notificacionSalida?: (linea: string) => void;
  notificacionAdvertencia?: (mensaje: string) => void;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const db = options.db ?? createDatabase();
  const ownsDb = options.db === undefined;

  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.LOG_LEVEL,
          },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'DATOS_INVALIDOS',
          message: 'Datos de entrada inválidos',
          details: error.issues,
        },
      });
    }

    const statusCode =
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    const esErrorInterno = statusCode >= 500;
    const message = esErrorInterno
      ? 'Error interno del servidor'
      : error instanceof Error
        ? error.message
        : 'Error inesperado';

    if (esErrorInterno) {
      request.log.error(error);
    }

    return reply.code(statusCode).send({
      error: {
        code: esErrorInterno ? 'ERROR_INTERNO' : 'ERROR_HTTP',
        message,
      },
    });
  });

  app.get('/health', () => ({
    status: 'ok',
    service: 'nexo-erp-api',
    timestamp: new Date().toISOString(),
  }));

  const inventarioRepository = new InventarioRepository(db);
  const clientesRepository = new ClientesRepository(db);
  const empleadosRepository = new EmpleadosRepository(db);
  const empleadosService = new EmpleadosService(empleadosRepository);
  const citasRepository = new CitasRepository(db);
  const eventBus = new InMemoryEventBus<AppEventMap>();
  const unitOfWork = new UnitOfWork<AppEventMap>(db, eventBus);

  const contactos: ConsultorContactos = {
    obtenerContacto: async (clienteId) => {
      const cliente = await clientesRepository.obtenerCliente(clienteId);
      if (!cliente) {
        return null;
      }

      return {
        nombre: cliente.nombre,
        email: cliente.email,
        telefono: cliente.telefono,
        canalPreferido: cliente.canalPreferido,
      };
    },
  };
  const notificacionFactory = new NotificacionFactory(
    options.notificacionSalida,
  );
  const notificacionesService = new NotificacionesService(
    notificacionFactory,
    contactos,
    options.notificacionAdvertencia,
  );
  const cancelarNotificaciones = registrarSuscriptoresNotificaciones(
    eventBus,
    notificacionesService,
  );

  const catalogo: CatalogoProductos = {
    obtenerPrecio: (productoId) => inventarioRepository.obtenerPrecio(productoId),
  };

  const clientes: VerificadorClientes = {
    obtenerPorDocumento: async (documento) => {
      const cliente = await db
        .selectFrom('clientes')
        .select('id')
        .where('documento', '=', documento)
        .executeTakeFirst();

      return cliente ?? null;
    },
  };

  const clientesParaCita: VerificadorClienteParaCita = {
    existeBloqueado: async (clienteId, executor) =>
      (
        await clientesRepository.obtenerClienteBloqueado(executor, clienteId)
      ) !== undefined,
  };

  const empleadosParaCita: ConsultorEmpleadosParaCita = {
    obtenerEmpleadoBloqueado: (empleadoId, executor) =>
      empleadosRepository.obtenerEmpleadoBloqueado(executor, empleadoId),
  };

  const citasService = new CitasService(
    citasRepository,
    unitOfWork,
    clientesParaCita,
    empleadosParaCita,
  );

  const estrategiasVentas: EstrategiasVentas = options.estrategiasVentas ?? {
    descuento: new DescuentoPorVolumen(),
    impuesto: new ImpuestoExento(),
    pagos: {
      efectivo: new PagoEfectivo(),
      pasarela: new PagoPasarela(),
    },
  };

  const cadenaValidacion = new CadenaValidacion();
  cadenaValidacion.agregar(new ValidarClienteValido());
  cadenaValidacion.agregar(new ValidarStockSuficiente());

  const ventasRepository = new VentasRepository(db);
  const carritoRepository = new CarritoRepository(db);
  const carritoService = new CarritoService(
    db,
    carritoRepository,
    estrategiasVentas,
  );

  const cajaRepository = new CajaRepository(db);
  const cajaService = new CajaService(cajaRepository);

  const contabilidadRepository = new ContabilidadRepository(db);
  const contabilidadService = new ContabilidadService(
    contabilidadRepository,
    unitOfWork,
  );

  registrarSuscripcionesContabilidad(eventBus, contabilidadService);

  const nominaRepository = new NominaRepository(db);
  const nominaService = new NominaService(
    nominaRepository,
    new CadenaLiquidacion(),
    unitOfWork,
  );

  const posCheckoutFacade = new PosCheckoutFacade(
    cadenaValidacion,
    estrategiasVentas,
    clientes,
    ventasRepository,
    carritoRepository,
    unitOfWork,
    async (productoId: string, cantidad: number) => {
      const stock = await inventarioRepository.obtenerStock(productoId);
      return stock !== undefined && stock.cantidad >= cantidad;
    },
    new AdapterFacturacionElectronicaMock(),
  );

  await app.register(inventarioRoutes, { repository: inventarioRepository });
  await app.register(clientesRoutes, { repository: clientesRepository });
  await app.register(empleadosRoutes, { service: empleadosService });
  await app.register(citasRoutes, { service: citasService });
  await app.register(carritoRoutes, { service: carritoService });
  await app.register(cajaRoutes, { service: cajaService });
  await app.register(contabilidadRoutes, { service: contabilidadService });
  await app.register(nominaRoutes, { service: nominaService });
  await app.register(ventasRoutes, {
    repository: ventasRepository,
    unitOfWork,
    catalogo,
    clientes,
    estrategias: estrategiasVentas,
    facade: posCheckoutFacade,
    carritoRepository,
  });

  app.addHook('onClose', async () => {
    cancelarNotificaciones();
    if (ownsDb) {
      await db.destroy();
    }
  });

  return app;
}
