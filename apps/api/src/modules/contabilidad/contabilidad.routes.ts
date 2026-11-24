import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { ContabilidadService } from './contabilidad.service.js';

const reporteVentasSchema = z.object({
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional(),
  agrupacion: z.enum(['dia', 'mes', 'anio', 'medio_pago']).optional().default('dia'),
});

export interface ContabilidadRoutesOptions {
  service: ContabilidadService;
}

export const contabilidadRoutes: FastifyPluginCallback<ContabilidadRoutesOptions> = (
  app,
  { service },
  done,
) => {
  app.get<{ Querystring: { desde?: string; hasta?: string } }>(
    '/api/contabilidad/asientos',
    async (request, reply) => {
      const { desde, hasta } = request.query;
      const asientos = await service.listarAsientos(desde, hasta);
      return reply.code(200).send(asientos);
    },
  );

  app.get<{ Querystring: { desde?: string; hasta?: string; agrupacion?: string } }>(
    '/api/contabilidad/reporte-ventas',
    async (request, reply) => {
      const params = reporteVentasSchema.parse(request.query);
      const resumen = await service.resumenVentas(
        params.desde,
        params.hasta,
        params.agrupacion,
      );
      return reply.code(200).send(resumen);
    },
  );

  done();
};
