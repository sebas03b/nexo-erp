import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import { CANALES_NOTIFICACION } from '../../shared/types/canal-notificacion.js';
import type { ClientesRepository } from './clientes.repository.js';
import { ClientesService } from './clientes.service.js';

const crearClienteSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  documento: z.string().trim().min(1, 'El documento es obligatorio'),
  email: z
    .string()
    .trim()
    .email('El correo electrónico no es válido')
    .optional(),
  telefono: z.string().trim().min(1, 'El teléfono no puede estar vacío').optional(),
  canalPreferido: z.enum(CANALES_NOTIFICACION),
});

const actualizarClienteSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('El correo electrónico no es válido')
      .nullable()
      .optional(),
    telefono: z
      .string()
      .trim()
      .min(1, 'El teléfono no puede estar vacío')
      .nullable()
      .optional(),
    canalPreferido: z.enum(CANALES_NOTIFICACION).optional(),
  })
  .refine(
    (data) =>
      data.email !== undefined ||
      data.telefono !== undefined ||
      data.canalPreferido !== undefined,
    {
      message: 'Debes enviar al menos un campo para actualizar',
    },
  );

export interface ClientesRoutesOptions {
  repository: ClientesRepository;
}

export const clientesRoutes: FastifyPluginCallback<ClientesRoutesOptions> = (
  app,
  { repository },
  done,
) => {
  const service = new ClientesService(repository);

  app.get('/api/clientes', async () => service.listarClientes());

  app.post<{ Body: z.infer<typeof crearClienteSchema> }>(
    '/api/clientes',
    async (request, reply) => {
      const data = crearClienteSchema.parse(request.body);
      const cliente = await service.crearCliente(data);

      return reply.code(201).send(cliente);
    },
  );

  app.patch<{
    Params: { id: string };
    Body: z.infer<typeof actualizarClienteSchema>;
  }>('/api/clientes/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = actualizarClienteSchema.parse(request.body);

    return service.actualizarCliente(id, data);
  });

  app.delete<{ Params: { id: string } }>('/api/clientes/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await service.eliminarCliente(id);

    return reply.code(204).send();
  });

  done();
};
