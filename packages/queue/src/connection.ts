import IORedis from 'ioredis'

// ---------------------------------------------------------------------------
// Shared Redis connection for BullMQ across the entire monorepo.
// Import `redisConnection` in any queue producer or worker -- never create
// ad-hoc IORedis instances in app code.
//
// BullMQ requires `maxRetriesPerRequest: null` on the connection used by
// workers and QueueSchedulers. The flag is set here so callers don't need
// to remember it.
// ---------------------------------------------------------------------------

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
})

export default redisConnection
