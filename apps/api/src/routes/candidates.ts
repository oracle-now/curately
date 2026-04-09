import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/authenticate';

export async function candidatesRoutes(server: FastifyInstance) {
  // GET /api/v1/candidates
  // Returns paginated post candidates (inspiration feed) for the current user
  server.get<{
    Querystring: { source_id?: string; limit?: string; cursor?: string };
  }>('/candidates', { preHandler: authenticate }, async (request, reply) => {
    const { source_id, limit = '20', cursor } = request.query;
    const take = Math.min(Number(limit), 50); // cap at 50

    const candidates = await server.prisma.postCandidate.findMany({
      where: {
        userId: request.user.id,
        ...(source_id ? { sourceId: source_id } : {}),
        // Exclude candidates already queued
        queueItems: { none: {} },
      },
      orderBy: { takenAt: 'desc' },
      take: take + 1, // fetch one extra to determine if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { source: { select: { type: true, value: true, isStale: true } } },
    });

    const hasMore = candidates.length > take;
    const items = hasMore ? candidates.slice(0, take) : candidates;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return reply.send({ items, nextCursor });
  });
}
