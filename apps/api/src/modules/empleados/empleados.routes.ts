import type { FastifyPluginCallback } from 'fastify';

import type { EmpleadosRepository } from './empleados.repository.js';
import { EmpleadosService } from './empleados.service.js';

export interface EmpleadosRoutesOptions {
  repository: EmpleadosRepository;
}

export const empleadosRoutes: FastifyPluginCallback<EmpleadosRoutesOptions> = (
  app,
  { repository },
  done,
) => {
  const service = new EmpleadosService(repository);

  app.get('/api/empleados', async () => service.listarEmpleados());

  done();
};
