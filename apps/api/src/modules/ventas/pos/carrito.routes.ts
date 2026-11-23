import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { CarritoService } from './carrito.service.js';

const carritoParamsSchema = z.object({
  id: z.string().uuid(),
});

const accionSchema = z.enum([
  'AGREGAR_ITEM',
  'DECREMENTAR_ITEM',
  'QUITAR_ITEM',
  'ESTABLECER_CANTIDAD',
]);

const payloadAgregarItemSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.coerce.number().int().positive(),
});

const payloadDecrementarItemSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.coerce.number().int().positive(),
});

const payloadQuitarItemSchema = z.object({
  productoId: z.string().uuid(),
});

const payloadEstablecerCantidadSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.coerce.number().int().min(0),
});

const comandoSchema = z.object({
  accion: accionSchema,
  payload: z.record(z.string(), z.unknown()),
});

function parsearPayload(
  accion: z.infer<typeof accionSchema>,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  switch (accion) {
    case 'AGREGAR_ITEM':
      return payloadAgregarItemSchema.parse(payload);
    case 'DECREMENTAR_ITEM':
      return payloadDecrementarItemSchema.parse(payload);
    case 'QUITAR_ITEM':
      return payloadQuitarItemSchema.parse(payload);
    case 'ESTABLECER_CANTIDAD':
      return payloadEstablecerCantidadSchema.parse(payload);
  }
}

export interface CarritoRoutesOptions {
  service: CarritoService;
}

export const carritoRoutes: FastifyPluginCallback<CarritoRoutesOptions> = (
  app,
  { service },
  done,
) => {
  app.post('/api/carritos', async (_request, reply) => {
    const carrito = await service.crearCarrito();
    return reply.code(201).send(carrito);
  });

  app.get<{ Params: { id: string } }>('/api/carritos/:id', async (request) => {
    const { id } = carritoParamsSchema.parse(request.params);
    return service.obtenerCarrito(id);
  });

  app.post<{ Params: { id: string } }>(
    '/api/carritos/:id/comandos',
    async (request) => {
      const { id } = carritoParamsSchema.parse(request.params);
      const { accion, payload } = comandoSchema.parse(request.body);
      const payloadNormalizado = parsearPayload(accion, payload);
      return service.ejecutarComando(id, accion, payloadNormalizado);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/carritos/:id/deshacer',
    async (request) => {
      const { id } = carritoParamsSchema.parse(request.params);
      return service.deshacer(id);
    },
  );

  app.delete<{ Params: { id: string } }>('/api/carritos/:id', async (request, reply) => {
    const { id } = carritoParamsSchema.parse(request.params);
    await service.descartarCarrito(id);
    return reply.code(204).send();
  });

  done();
};