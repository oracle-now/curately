import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { IngestionService } from '../services/IngestionService';
import { redisConnection } from '../lib/queues';

const prisma = new PrismaClient();
const ingestionService = new IngestionService(prisma);

/**
 * Ingestion worker: polls RSS feeds for a given user.
 * Job payload: { userId: string } | { sourceId: string }
 */
const worker = new Worker(
  'ingestion',
  async (job) => {
    const { userId, sourceId } = job.data as {
      userId?: string;
      sourceId?: string;
    };

    if (sourceId) {
      await ingestionService.ingestSource(sourceId);
    } else if (userId) {
      await ingestionService.ingestAllSourcesForUser(userId);
    } else {
      throw new Error('Ingestion job missing userId or sourceId');
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`[ingestion] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[ingestion] Job ${job?.id} failed:`, err.message);
});

export default worker;
