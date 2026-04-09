import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { prismaPlugin } from './plugins/prisma';
import { authRoutes } from './routes/auth';
import { instagramRoutes } from './routes/instagram';
import { sourcesRoutes } from './routes/sources';
import { candidatesRoutes } from './routes/candidates';
import { queueRoutes } from './routes/queue';
import { captionProfilesRoutes } from './routes/captionProfiles';

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
});

async function bootstrap() {
  // Core plugins
  await server.register(cors, {
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  await server.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-replace-in-prod',
  });

  // DB
  await server.register(prismaPlugin);

  // Routes — all prefixed under /api/v1
  const prefix = '/api/v1';
  await server.register(authRoutes, { prefix });
  await server.register(instagramRoutes, { prefix });
  await server.register(sourcesRoutes, { prefix });
  await server.register(candidatesRoutes, { prefix });
  await server.register(queueRoutes, { prefix });
  await server.register(captionProfilesRoutes, { prefix });

  // Health check
  server.get('/health', async () => ({ status: 'ok' }));

  const port = Number(process.env.PORT ?? 3001);
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`API running on port ${port}`);
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  server.log.info(`Received ${signal}, shutting down gracefully`);
  await server.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
