import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

/**
 * Prehandler hook that validates JWT and decorates request.user.
 * Attach as preHandler on any route that requires authentication.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    // @fastify/jwt sets request.user after verify
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}
