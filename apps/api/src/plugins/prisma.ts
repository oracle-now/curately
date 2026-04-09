import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

// Singleton Prisma client — shared across all requests
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (server: FastifyInstance) => {
  server.decorate('prisma', prisma);

  server.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
