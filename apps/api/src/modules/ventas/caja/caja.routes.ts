import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { CajaService } from './caja.service.js';

const abrirCajaSchema = z.object({
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
  app.post<{ Body: { montoInicial: number } }>(
    '/apertura',
    async (request, reply) => {
      const data = abrirCajaSchema.parse(request.body);
      const usuarioId = request.usuario?.usuarioId;
      if (!usuarioId) {
        return reply.code(401).send({
          error: { code: 'USUARIO_NO_AUTENTICADO', message: 'Usuario no autenticado' },
        });
      }
      const caja = await service.abrirCaja(usuarioId, data.montoInicial);
      return reply.code(201).send(caja);
    },
  );

  app.get('/actual', async (request, reply) => {
    const usuarioId = request.usuario?.usuarioId;
    if (!usuarioId) {
      return reply.code(401).send({
        error: { code: 'USUARIO_NO_AUTENTICADO', message: 'Usuario no autenticado' },
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
  });

  app.post<{ Params: { id: string }; Body: { montoFinal: number } }>(
    '/:id/cierre',
    async (request) => {
      const { id } = request.params;
      const data = cerrarCajaSchema.parse(request.body);
      const caja = await service.cerrarCaja(id, data.montoFinal);
      return caja;
    },
  );

  done();
};
