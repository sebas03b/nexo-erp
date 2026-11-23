import type { FastifyPluginCallback } from 'fastify';

import type { EmpleadosService } from './empleados.service.js';

export interface EmpleadosRoutesOptions {
  service: EmpleadosService;
}

export const empleadosRoutes: FastifyPluginCallback<EmpleadosRoutesOptions> = (
  app,
  { service },
  done,
) => {
  app.get('/api/empleados', async () => service.listarEmpleados());

  done();
};
