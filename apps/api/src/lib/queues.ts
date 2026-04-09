import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
});

export const ingestionQueue = new Queue('ingestion', { connection });
export const publishQueue = new Queue('publish', { connection });
export const captionQueue = new Queue('caption', { connection });

export { connection as redisConnection };
