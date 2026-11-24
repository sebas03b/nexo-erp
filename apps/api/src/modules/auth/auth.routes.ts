import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { AuthService } from './auth.service.js';

const loginSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const registroSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  rol: z.enum(['admin', 'cajero', 'contador']),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export interface AuthRoutesOptions {
  service: AuthService;
}

export const authRoutes: FastifyPluginCallback<AuthRoutesOptions> = (
  app,
  { service },
  done,
) => {
  app.post<{ Body: z.infer<typeof loginSchema> }>(
    '/api/auth/login',
    async (request, reply) => {
      const data = loginSchema.parse(request.body);
      const { usuario, token } = await service.login(data.nombre, data.password);

      return reply.code(200).send({
        token,
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          rol: usuario.rol,
        },
      });
    },
  );

  app.post<{ Body: z.infer<typeof registroSchema> }>(
    '/api/auth/registro',
    async (request, reply) => {
      const data = registroSchema.parse(request.body);
      const usuario = await service.registrarUsuario(
        data.nombre,
        data.rol,
        data.password,
      );

      return reply.code(201).send({
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          rol: usuario.rol,
        },
      });
    },
  );

  app.get<{ Querystring?: { rol?: string } }>(
    '/api/usuarios',
    async (request, reply) => {
      const { rol } = request.query;
      const usuarios = await service.listarUsuarios(rol);
      return reply.code(200).send(
        usuarios.map((u) => ({
          id: u.id,
          nombre: u.nombre,
          rol: u.rol,
        })),
      );
    },
  );

  done();
};
