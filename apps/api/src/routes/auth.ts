import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(server: FastifyInstance) {
  // POST /api/v1/auth/register
  server.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await server.prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    const passwordHash = crypto
      .createHash('sha256')
      .update(body.password)
      .digest('hex');

    const user = await server.prisma.user.create({
      data: { email: body.email, passwordHash },
    });

    const token = server.jwt.sign({ id: user.id, email: user.email });
    return reply.code(201).send({ token, user: { id: user.id, email: user.email } });
  });

  // POST /api/v1/auth/login
  server.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await server.prisma.user.findUnique({
      where: { email: body.email },
    });

    const passwordHash = crypto
      .createHash('sha256')
      .update(body.password)
      .digest('hex');

    if (!user || user.passwordHash !== passwordHash) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const token = server.jwt.sign({ id: user.id, email: user.email });
    return reply.send({ token, user: { id: user.id, email: user.email } });
  });
}
