import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/authenticate';
import { CaptionService } from '../services/CaptionService';
import { publishQueue } from '../lib/queues';

const createQueueItemSchema = z.object({
  post_candidate_id: z.string().uuid(),
});

const updateQueueItemSchema = z.object({
  caption_text: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  scheduled_at: z.string().datetime().optional(),
  status: z.enum(['queued', 'caption_ready', 'scheduled']).optional(),
});

const generateCaptionSchema = z.object({
  caption_profile_id: z.string().uuid().optional(),
});

export async function queueRoutes(server: FastifyInstance) {
  const captionService = new CaptionService(server.prisma);

  // GET /api/v1/queue
  server.get<{ Querystring: { status?: string; limit?: string; cursor?: string } }>(
    '/queue',
    { preHandler: authenticate },
    async (request, reply) => {
      const { status, limit = '20', cursor } = request.query;
      const take = Math.min(Number(limit), 50);

      const items = await server.prisma.queueItem.findMany({
        where: {
          userId: request.user.id,
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { postCandidate: true, captionProfile: true },
      });

      const hasMore = items.length > take;
      const sliced = hasMore ? items.slice(0, take) : items;
      return reply.send({ items: sliced, nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null });
    }
  );

  // POST /api/v1/queue — add a candidate to the queue
  server.post('/queue', { preHandler: authenticate }, async (request, reply) => {
    const body = createQueueItemSchema.parse(request.body);

    // Verify candidate belongs to user
    const candidate = await server.prisma.postCandidate.findFirst({
      where: { id: body.post_candidate_id, userId: request.user.id },
    });
    if (!candidate) return reply.code(404).send({ error: 'Candidate not found' });

    const item = await server.prisma.queueItem.create({
      data: {
        userId: request.user.id,
        postCandidateId: body.post_candidate_id,
        status: 'queued',
      },
      include: { postCandidate: true },
    });
    return reply.code(201).send(item);
  });

  // POST /api/v1/queue/:id/generate-caption
  server.post<{ Params: { id: string } }>(
    '/queue/:id/generate-caption',
    { preHandler: authenticate },
    async (request, reply) => {
      const body = generateCaptionSchema.parse(request.body ?? {});

      const item = await server.prisma.queueItem.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      });
      if (!item) return reply.code(404).send({ error: 'Queue item not found' });

      const result = await captionService.generateCaption(
        request.params.id,
        body.caption_profile_id
      );
      return reply.send(result);
    }
  );

  // PATCH /api/v1/queue/:id — edit caption, hashtags, schedule
  server.patch<{ Params: { id: string } }>(
    '/queue/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const body = updateQueueItemSchema.parse(request.body);

      const item = await server.prisma.queueItem.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      });
      if (!item) return reply.code(404).send({ error: 'Queue item not found' });

      const updated = await server.prisma.queueItem.update({
        where: { id: request.params.id },
        data: {
          ...(body.caption_text !== undefined ? { captionText: body.caption_text } : {}),
          ...(body.hashtags !== undefined ? { hashtags: body.hashtags } : {}),
          ...(body.scheduled_at !== undefined ? { scheduledAt: new Date(body.scheduled_at) } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
        include: { postCandidate: true },
      });
      return reply.send(updated);
    }
  );

  // POST /api/v1/queue/:id/publish — enqueue a PostJob for publishing
  server.post<{ Params: { id: string } }>(
    '/queue/:id/publish',
    { preHandler: authenticate },
    async (request, reply) => {
      const item = await server.prisma.queueItem.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      });
      if (!item) return reply.code(404).send({ error: 'Queue item not found' });
      if (!item.captionText) {
        return reply.code(400).send({ error: 'Generate a caption before publishing' });
      }

      const igAccount = await server.prisma.instagramAccount.findFirst({
        where: { userId: request.user.id },
      });
      if (!igAccount) {
        return reply.code(400).send({ error: 'No Instagram account connected' });
      }

      const scheduledAt = item.scheduledAt ?? new Date();

      const job = await server.prisma.postJob.create({
        data: {
          queueItemId: item.id,
          igAccountId: igAccount.id,
          scheduledAt,
          status: 'pending',
        },
      });

      await server.prisma.queueItem.update({
        where: { id: item.id },
        data: { status: 'scheduled' },
      });

      // Enqueue to BullMQ publish worker
      const delay = Math.max(0, scheduledAt.getTime() - Date.now());
      await publishQueue.add('publish-job', { postJobId: job.id }, { delay });

      return reply.code(201).send(job);
    }
  );

  // DELETE /api/v1/queue/:id
  server.delete<{ Params: { id: string } }>(
    '/queue/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const item = await server.prisma.queueItem.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      });
      if (!item) return reply.code(404).send({ error: 'Queue item not found' });

      await server.prisma.queueItem.delete({ where: { id: request.params.id } });
      return reply.code(204).send();
    }
  );
}
