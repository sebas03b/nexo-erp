import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { ZodError } from 'zod';

import { env } from './config/env.js';
import { ClientesRepository } from './modules/clientes/clientes.repository.js';
import { clientesRoutes } from './modules/clientes/clientes.routes.js';
import { InventarioRepository } from './modules/inventario/inventario.repository.js';
import { inventarioRoutes } from './modules/inventario/inventario.routes.js';
import type { AppEventMap } from './shared/events/app-event-map.js';
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
import { PosCheckoutFacade } from './modules/ventas/pos/pos-checkout.facade.js';
import { VentasRepository } from './modules/ventas/ventas.repository.js';
import { ventasRoutes } from './modules/ventas/ventas.routes.js';
import type { EstrategiasVentas } from './modules/ventas/ventas.service.js';
import { CitasRepository } from './modules/citas/citas.repository.js';
import { citasRoutes } from './modules/citas/citas.routes.js';
import { CitasService } from './modules/citas/citas.service.js';
import { NotificacionFactory } from './modules/notificaciones/notificacion.factory.js';
import { ServicioNotificaciones } from './modules/notificaciones/servicio-notificaciones.js';
import { registrarSuscripcionesNotificaciones } from './modules/notificaciones/suscripciones.js';
import { createDatabase } from './shared/db/database.js';
import type { Database } from './shared/db/schema.js';
import { UnitOfWork } from './shared/db/unit-of-work.js';
import { DomainError } from './shared/errors/domain-error.js';
import { InMemoryEventBus } from './shared/events/event-bus.js';

export interface BuildAppOptions {
  db?: Kysely<Database>;
  estrategiasVentas?: EstrategiasVentas;
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
  // PedidoPagado = OrdenPagada del plan de fases.
  const eventBus = new InMemoryEventBus<AppEventMap>();
  const unitOfWork = new UnitOfWork<AppEventMap>(db, eventBus);

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

  const clientesRepo = new ClientesRepository(db);
  const notificaciones = new ServicioNotificaciones(
    new NotificacionFactory(),
    async (id) => {
      const cliente = await clientesRepo.obtenerCliente(id);
      return cliente
        ? { nombre: cliente.nombre, canalPreferido: cliente.canalPreferido }
        : null;
    },
  );
  registrarSuscripcionesNotificaciones(eventBus, notificaciones);

  const ventasRepository = new VentasRepository(db);
  const carritoRepository = new CarritoRepository(db);
  const carritoService = new CarritoService(
    db,
    carritoRepository,
    estrategiasVentas,
  );

  const posCheckoutFacade = new PosCheckoutFacade(
    cadenaValidacion,
    estrategiasVentas,
    clientes,
    ventasRepository,
    carritoRepository,
    unitOfWork,
    async (productoId: string, cantidad: number) => {
      const producto = await inventarioRepository.obtenerProducto(productoId);
      if (producto?.tipo === 'servicio') {
        return true;
      }
      const stock = await inventarioRepository.obtenerStock(productoId);
      return stock !== undefined && stock.cantidad >= cantidad;
    },
  );

  const citasRepository = new CitasRepository();
  const citasService = new CitasService(citasRepository, unitOfWork);

  await app.register(inventarioRoutes, { repository: inventarioRepository });
  await app.register(clientesRoutes, {
    repository: clientesRepo,
  });
  await app.register(carritoRoutes, { service: carritoService });
  await app.register(ventasRoutes, {
    repository: ventasRepository,
    unitOfWork,
    catalogo,
    clientes,
    estrategias: estrategiasVentas,
    facade: posCheckoutFacade,
    carritoRepository,
  });
  await app.register(citasRoutes, { service: citasService });

  if (ownsDb) {
    app.addHook('onClose', async () => {
      await db.destroy();
    });
  }

  return app;
}
