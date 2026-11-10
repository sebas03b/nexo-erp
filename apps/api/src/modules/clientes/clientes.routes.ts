import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

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
  canalPreferido: z.enum(['email', 'sms', 'whatsapp']),
});

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

  app.delete<{ Params: { id: string } }>('/api/clientes/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await service.eliminarCliente(id);

    return reply.code(204).send();
  });

  done();
};
