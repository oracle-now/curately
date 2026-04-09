import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/authenticate';

const styleConfigSchema = z.object({
  tone: z.string().min(1),
  length: z.enum(['short', 'medium', 'long']),
  use_emoji: z.boolean(),
  hashtag_count: z.number().int().min(0).max(30),
  hashtag_strategy: z.string().min(1),
  custom_instructions: z.string().optional(),
});

const createProfileSchema = z.object({
  name: z.string().min(1),
  style_config: styleConfigSchema,
});

const updateProfileSchema = z.object({
  name: z.string().optional(),
  style_config: styleConfigSchema.optional(),
});

export async function captionProfilesRoutes(server: FastifyInstance) {
  // GET /api/v1/caption-profiles
  server.get('/caption-profiles', { preHandler: authenticate }, async (request, reply) => {
    const profiles = await server.prisma.captionProfile.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(profiles);
  });

  // POST /api/v1/caption-profiles
  server.post('/caption-profiles', { preHandler: authenticate }, async (request, reply) => {
    const body = createProfileSchema.parse(request.body);
    const profile = await server.prisma.captionProfile.create({
      data: {
        userId: request.user.id,
        name: body.name,
        styleConfig: body.style_config,
      },
    });
    return reply.code(201).send(profile);
  });

  // PATCH /api/v1/caption-profiles/:id
  server.patch<{ Params: { id: string } }>(
    '/caption-profiles/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const body = updateProfileSchema.parse(request.body);
      const profile = await server.prisma.captionProfile.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      });
      if (!profile) return reply.code(404).send({ error: 'Profile not found' });

      const updated = await server.prisma.captionProfile.update({
        where: { id: request.params.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.style_config !== undefined ? { styleConfig: body.style_config } : {}),
        },
      });
      return reply.send(updated);
    }
  );

  // DELETE /api/v1/caption-profiles/:id
  server.delete<{ Params: { id: string } }>(
    '/caption-profiles/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const profile = await server.prisma.captionProfile.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      });
      if (!profile) return reply.code(404).send({ error: 'Profile not found' });

      await server.prisma.captionProfile.delete({ where: { id: request.params.id } });
      return reply.code(204).send();
    }
  );
}
