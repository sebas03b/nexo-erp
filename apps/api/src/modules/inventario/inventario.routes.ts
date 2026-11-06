import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { InventarioRepository } from './inventario.repository.js';
import { InventarioService } from './inventario.service.js';

const productoSchema = z.object({
  sku: z.string().trim().min(1),
  nombre: z.string().trim().min(1),
  precio: z.coerce.number().nonnegative(),
  tipo: z.string().trim().min(1),
});

const actualizarProductoSchema = productoSchema.partial();

const stockSchema = z.object({
  cantidad: z.coerce.number().int().nonnegative(),
});

const productoParamsSchema = z.object({
  id: z.string().uuid(),
});

const stockParamsSchema = z.object({
  productoId: z.string().uuid(),
});

export interface InventarioRoutesOptions {
  repository: InventarioRepository;
}

export const inventarioRoutes: FastifyPluginCallback<InventarioRoutesOptions> = (
  app,
  { repository },
  done,
) => {
  const service = new InventarioService(repository);

  app.get('/api/productos', async () => service.listarProductos());

  app.get<{ Params: { id: string } }>('/api/productos/:id', async (request) => {
    const { id } = productoParamsSchema.parse(request.params);

    return service.obtenerProducto(id);
  });

  app.post('/api/productos', async (request, reply) => {
    const data = productoSchema.parse(request.body);
    const producto = await service.crearProducto(data);

    return reply.code(201).send(producto);
  });

  app.patch<{ Params: { id: string } }>('/api/productos/:id', async (request) => {
    const { id } = productoParamsSchema.parse(request.params);
    const data = actualizarProductoSchema.parse(request.body);

    return service.actualizarProducto(id, data);
  });

  app.delete<{ Params: { id: string } }>('/api/productos/:id', async (request, reply) => {
    const { id } = productoParamsSchema.parse(request.params);
    await service.eliminarProducto(id);

    return reply.code(204).send();
  });

  app.get('/api/stock', async () => service.listarStock());

  app.get<{ Params: { productoId: string } }>('/api/stock/:productoId', async (request) => {
    const { productoId } = stockParamsSchema.parse(request.params);

    return service.obtenerStock(productoId);
  });

  app.put<{ Params: { productoId: string } }>('/api/stock/:productoId', async (request) => {
    const { productoId } = stockParamsSchema.parse(request.params);
    const { cantidad } = stockSchema.parse(request.body);

    return service.fijarStock(productoId, cantidad);
  });

  app.delete<{ Params: { productoId: string } }>(
    '/api/stock/:productoId',
    async (request, reply) => {
      const { productoId } = stockParamsSchema.parse(request.params);
      await service.eliminarStock(productoId);

      return reply.code(204).send();
    },
  );

  done();
};
