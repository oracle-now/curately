import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { PublishingService } from '../services/PublishingService';
import { redisConnection } from '../lib/queues';

const prisma = new PrismaClient();
const publishingService = new PublishingService(prisma);

/**
 * Publish worker: executes a scheduled PostJob.
 * Job payload: { postJobId: string }
 * Retries up to 3 times with exponential backoff on failure.
 */
const worker = new Worker(
  'publish',
  async (job) => {
    const { postJobId } = job.data as { postJobId: string };
    if (!postJobId) throw new Error('Publish job missing postJobId');
    await publishingService.publishJob(postJobId);
  },
  {
    connection: redisConnection,
    concurrency: 2, // conservative — respect IG rate limits
  }
);

worker.on('completed', (job) => {
  console.log(`[publish] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[publish] Job ${job?.id} failed:`, err.message);
});

export default worker;
