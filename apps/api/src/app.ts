import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { ZodError } from 'zod';

import { env } from './config/env.js';
import { InventarioRepository } from './modules/inventario/inventario.repository.js';
import { inventarioRoutes } from './modules/inventario/inventario.routes.js';
import type { VentasEventMap } from './modules/ventas/domain/eventos.js';
import type { CatalogoProductos, VerificadorClientes } from './modules/ventas/domain/ports.js';
import { VentasRepository } from './modules/ventas/ventas.repository.js';
import { ventasRoutes } from './modules/ventas/ventas.routes.js';
import { createDatabase } from './shared/db/database.js';
import type { Database } from './shared/db/schema.js';
import { UnitOfWork } from './shared/db/unit-of-work.js';
import { DomainError } from './shared/errors/domain-error.js';
import { InMemoryEventBus } from './shared/events/event-bus.js';

export interface BuildAppOptions {
  db?: Kysely<Database>;
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
  const eventBus = new InMemoryEventBus<VentasEventMap>();
  const unitOfWork = new UnitOfWork<VentasEventMap>(db, eventBus);

  const catalogo: CatalogoProductos = {
    obtenerPrecio: (productoId) => inventarioRepository.obtenerPrecio(productoId),
  };

  const clientes: VerificadorClientes = {
    existe: async (clienteId) => {
      const cliente = await db
        .selectFrom('clientes')
        .select('id')
        .where('id', '=', clienteId)
        .executeTakeFirst();

      return cliente !== undefined;
    },
  };

  await app.register(inventarioRoutes, { repository: inventarioRepository });
  await app.register(ventasRoutes, {
    repository: new VentasRepository(db),
    unitOfWork,
    catalogo,
    clientes,
  });

  if (ownsDb) {
    app.addHook('onClose', async () => {
      await db.destroy();
    });
  }

  return app;
}
