import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { CitasService } from './citas.service.js';

const crearCitaSchema = z
  .object({
    clienteId: z.string().uuid(),
    inicio: z.string().datetime({ offset: true }),
    fin: z.string().datetime({ offset: true }),
    empleadoId: z.string().optional(),
    notas: z.string().optional(),
  })
  .refine((data) => new Date(data.fin) > new Date(data.inicio), {
    message: 'La fecha de fin debe ser posterior a la de inicio.',
    path: ['fin'],
  });

const listarCitasQuerySchema = z.object({
  desde: z.string().datetime({ offset: true }).optional(),
  hasta: z.string().datetime({ offset: true }).optional(),
});

const citaParamsSchema = z.object({
  id: z.string().uuid(),
});

const accionSchema = z.object({
  accion: z.enum(['confirmar', 'iniciar', 'completar', 'cancelar']),
});

export interface CitasRoutesOptions {
  service: CitasService;
}

export const citasRoutes: FastifyPluginCallback<CitasRoutesOptions> = (
  app,
  { service },
  done,
) => {
  app.post('/api/citas', async (request, reply) => {
    const data = crearCitaSchema.parse(request.body);
    const cita = await service.crear({
      clienteId: data.clienteId,
      empleadoId: data.empleadoId ?? null,
      inicio: new Date(data.inicio),
      fin: new Date(data.fin),
      notas: data.notas ?? null,
    });

    return reply.code(201).send(cita.toJSON());
  });

  app.get('/api/citas', async (request) => {
    const { desde, hasta } = listarCitasQuerySchema.parse(request.query ?? {});
    const citas = await service.listar(
      desde ? new Date(desde) : undefined,
      hasta ? new Date(hasta) : undefined,
    );
    return citas.map((cita) => cita.toJSON());
  });

  app.get<{ Params: { id: string } }>('/api/citas/:id', async (request) => {
    const { id } = citaParamsSchema.parse(request.params);
    const cita = await service.obtener(id);
    return cita.toJSON();
  });

  app.patch<{ Params: { id: string } }>(
    '/api/citas/:id/estado',
    async (request) => {
      const { id } = citaParamsSchema.parse(request.params);
      const { accion } = accionSchema.parse(request.body);
      const cita = await service.cambiarEstado(id, accion);
      return cita.toJSON();
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/citas/:id/recordatorio',
    async (request) => {
      const { id } = citaParamsSchema.parse(request.params);
      const cita = await service.solicitarRecordatorio(id);
      return { ok: true, citaId: cita.id };
    },
  );

  done();
};
