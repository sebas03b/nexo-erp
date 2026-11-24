import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { CajaService } from './caja.service.js';

const abrirCajaSchema = z.object({
  usuarioId: z.string().min(1, 'El usuario es obligatorio'),
  montoInicial: z.coerce.number().nonnegative('El monto inicial no puede ser negativo'),
});

const cerrarCajaSchema = z.object({
  montoFinal: z.coerce.number().nonnegative('El monto final no puede ser negativo'),
});

export interface CajaRoutesOptions {
  service: CajaService;
}

export const cajaRoutes: FastifyPluginCallback<CajaRoutesOptions> = (
  app,
  { service },
  done,
) => {
  app.post<{ Body: { usuarioId: string; montoInicial: number } }>(
    '/api/caja/apertura',
    async (request, reply) => {
      const data = abrirCajaSchema.parse(request.body);
      const caja = await service.abrirCaja(data.usuarioId, data.montoInicial);
      return reply.code(201).send(caja);
    },
  );

  app.get<{ Querystring: { usuarioId?: string } }>(
    '/api/caja/actual',
    async (request, reply) => {
      const { usuarioId } = request.query;
      if (!usuarioId) {
        return reply.code(400).send({
          error: { code: 'DATOS_INVALIDOS', message: 'Falta el parámetro usuarioId' },
        });
      }
      const cajas = await service.listarCajas();
      const abierta = cajas.find((c) => c.usuarioId === usuarioId && c.cierre === null);
      if (!abierta) {
        return reply.code(404).send({
          error: { code: 'CAJA_NO_ABIERTA', message: 'No hay caja abierta para este usuario' },
        });
      }
      return abierta;
    },
  );

  app.post<{ Params: { id: string }; Body: { montoFinal: number } }>(
    '/api/caja/:id/cierre',
    async (request) => {
      const { id } = request.params;
      const data = cerrarCajaSchema.parse(request.body);
      const caja = await service.cerrarCaja(id, data.montoFinal);
      return caja;
    },
  );

  done();
};
