import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { NominaService } from './nomina.service.js';

const calcularLiquidacionSchema = z.object({
  empleadoId: z.string().uuid('El ID de empleado debe ser un UUID valido'),
  periodo: z.string().min(1, 'El periodo es obligatorio'),
  salarioBase: z.coerce.number().nonnegative('El salario base no puede ser negativo'),
  horasExtras: z.coerce.number().nonnegative().optional(),
  auxilioTransporte: z.coerce.number().nonnegative().optional(),
});

const listarLiquidacionesSchema = z.object({
  empleadoId: z.string().uuid().optional(),
  periodo: z.string().optional(),
});

export interface NominaRoutesOptions {
  service: NominaService;
}

export const nominaRoutes: FastifyPluginCallback<NominaRoutesOptions> = (
  app,
  { service },
  done,
) => {
  app.post<{ Body: z.infer<typeof calcularLiquidacionSchema> }>(
    '/api/nomina/calcular',
    async (request, reply) => {
      const data = calcularLiquidacionSchema.parse(request.body);
      const resultado = await service.calcularLiquidacion(
        data.empleadoId,
        data.periodo,
        {
          empleadoId: data.empleadoId,
          salarioBase: data.salarioBase,
          horasExtras: data.horasExtras,
          auxilioTransporte: data.auxilioTransporte,
          periodo: data.periodo,
        },
      );
      return reply.code(201).send(resultado);
    },
  );

  app.get<{ Querystring: z.infer<typeof listarLiquidacionesSchema> }>(
    '/api/nomina/liquidaciones',
    async (request, reply) => {
      const data = listarLiquidacionesSchema.parse(request.query);
      const liquidaciones = await service.listarLiquidaciones(
        data.empleadoId,
        data.periodo,
      );
      return reply.code(200).send(liquidaciones);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/nomina/liquidaciones/:id',
    async (request, reply) => {
      const { id } = request.params;
      const liquidacion = await service.obtenerLiquidacion(id);
      return reply.code(200).send(liquidacion);
    },
  );

  done();
};
