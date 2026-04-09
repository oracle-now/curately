import { PrismaClient } from '@prisma/client'

// ---------------------------------------------------------------------------
// Singleton Prisma client shared across the entire monorepo.
// Import from '@curately/db' in any app or worker — never instantiate
// PrismaClient directly in app code.
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  })
}

// In production, create once per process.
// In development, reuse the instance across hot-reloads to avoid
// exhausting the connection pool.
export const prisma: PrismaClient =
  globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

export default prisma
