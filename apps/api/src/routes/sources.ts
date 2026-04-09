import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/authenticate';

const createSourceSchema = z.object({
  type: z.enum(['instagram', 'tumblr', 'hashtag']),
  value: z.string().min(1),
  rss_url: z.string().url(),
});

const updateSourceSchema = z.object({
  active: z.boolean().optional(),
});

export async function sourcesRoutes(server: FastifyInstance) {
  // GET /api/v1/sources
  server.get('/sources', { preHandler: authenticate }, async (request, reply) => {
    const sources = await server.prisma.source.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(sources);
  });

  // POST /api/v1/sources
  server.post('/sources', { preHandler: authenticate }, async (request, reply) => {
    const body = createSourceSchema.parse(request.body);
    const source = await server.prisma.source.create({
      data: {
        userId: request.user.id,
        type: body.type,
        value: body.value,
        rssUrl: body.rss_url,
      },
    });
    return reply.code(201).send(source);
  });

  // PATCH /api/v1/sources/:id
  server.patch<{ Params: { id: string } }>(
    '/sources/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const body = updateSourceSchema.parse(request.body);
      const source = await server.prisma.source.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      });
      if (!source) return reply.code(404).send({ error: 'Source not found' });

      const updated = await server.prisma.source.update({
        where: { id: request.params.id },
        data: body.active !== undefined ? { active: body.active } : {},
      });
      return reply.send(updated);
    }
  );

  // DELETE /api/v1/sources/:id
  server.delete<{ Params: { id: string } }>(
    '/sources/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const source = await server.prisma.source.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      });
      if (!source) return reply.code(404).send({ error: 'Source not found' });

      await server.prisma.source.delete({ where: { id: request.params.id } });
      return reply.code(204).send();
    }
  );
}
