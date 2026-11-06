import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import { env } from './config/env.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.LOG_LEVEL,
          },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
  });

  app.get('/health', () => ({
    status: 'ok',
    service: 'nexo-erp-api',
    timestamp: new Date().toISOString(),
  }));

  return app;
}
