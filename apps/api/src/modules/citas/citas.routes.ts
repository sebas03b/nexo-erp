import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { CitasService } from './citas.service.js';
import { ESTADOS_CITA } from './domain/cita-estado.js';

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const crearCitaSchema = z.object({
  clienteId: z.string().uuid(),
  empleadoId: z.string().uuid(),
  inicio: z.string().min(1),
  fin: z.string().min(1),
  motivo: z.string().trim().optional(),
});

const filtrosSchema = z.object({
  desde: z.string().min(1).optional(),
  hasta: z.string().min(1).optional(),
  estado: z.enum(ESTADOS_CITA).optional(),
});

export interface CitasRoutesOptions {
  service: CitasService;
}

export const citasRoutes: FastifyPluginCallback<CitasRoutesOptions> = (
  app,
  { service },
  done,
) => {

  app.get('/api/citas', async (request) => {
    const filtros = filtrosSchema.parse(request.query);
    return service.listarCitas(filtros);
  });

  app.get<{ Params: { id: string } }>('/api/citas/:id', async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    return service.obtenerCita(id);
  });

  app.post('/api/citas', async (request, reply) => {
    const data = crearCitaSchema.parse(request.body);
    const cita = await service.crearCita(data);

    return reply.code(201).send(cita);
  });

  app.post<{ Params: { id: string } }>(
    '/api/citas/:id/confirmar',
    async (request) => {
      const { id } = idParamsSchema.parse(request.params);
      return service.confirmarCita(id);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/citas/:id/iniciar',
    async (request) => {
      const { id } = idParamsSchema.parse(request.params);
      return service.iniciarCita(id);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/citas/:id/completar',
    async (request) => {
      const { id } = idParamsSchema.parse(request.params);
      return service.completarCita(id);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/citas/:id/cancelar',
    async (request) => {
      const { id } = idParamsSchema.parse(request.params);
      return service.cancelarCita(id);
    },
  );

  done();
};
