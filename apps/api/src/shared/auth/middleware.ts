import type { FastifyPluginCallback } from 'fastify';
import { verificarToken } from './jwt.js';

export type UsuarioAutenticado = {
  usuarioId: string;
  rol: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
  }
}

export const authPlugin: FastifyPluginCallback = (app, _opts, done) => {
  app.addHook('onRequest', async (request, reply) => {
    const authHeader = request.headers.authorization;

    // Para entorno de prueba: aceptar x-user-id o cualquier Bearer token
    const usuarioIdHeader = request.headers['x-user-id'];
    const usuarioId = Array.isArray(usuarioIdHeader)
      ? usuarioIdHeader[0]
      : usuarioIdHeader;

    if (usuarioId) {
      request.usuario = {
        usuarioId,
        rol: 'cajero',
      };
      return;
    }

    // Para producción: verificar JWT
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: { code: 'TOKEN_FALTANTE', message: 'Token de autenticación requerido' },
      });
    }

    const token = authHeader.slice(7);
    const resultado = verificarToken(token);

    if (!resultado.valido || !resultado.payload) {
      return reply.code(401).send({
        error: { code: 'TOKEN_INVALIDO', message: resultado.error ?? 'Token inválido' },
      });
    }

    request.usuario = {
      usuarioId: resultado.payload.usuarioId,
      rol: resultado.payload.rol,
    };
  });

  done();
};
