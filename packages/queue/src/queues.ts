import { Queue } from 'bullmq'
import { redisConnection } from './connection'

// ---------------------------------------------------------------------------
// Named queues — single source of truth for every BullMQ queue in Curately.
// Add a new const here whenever you introduce a new worker domain.
// Never hard-code queue name strings outside this file.
// ---------------------------------------------------------------------------

export const QUEUE_NAMES = {
  INGEST:   'ingest',
  CAPTION:  'caption',
  SCHEDULE: 'schedule',
  PUBLISH:  'publish',
} as const

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES]

// ---------------------------------------------------------------------------
// Queue instances (producers use these to add jobs)
// ---------------------------------------------------------------------------

export const ingestQueue = new Queue(QUEUE_NAMES.INGEST, {
  connection: redisConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

export const captionQueue = new Queue(QUEUE_NAMES.CAPTION, {
  connection: redisConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

export const scheduleQueue = new Queue(QUEUE_NAMES.SCHEDULE, {
  connection: redisConnection,
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
})

export const publishQueue = new Queue(QUEUE_NAMES.PUBLISH, {
  connection: redisConnection,
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
})

// ---------------------------------------------------------------------------
// Idempotent job ID helpers — use these when enqueueing to prevent duplicates.
// BullMQ will skip adding a job if a job with the same ID is already queued.
// ---------------------------------------------------------------------------

export const jobIds = {
  ingest:   (sourceId: string)      => `ingest:${sourceId}`,
  caption:  (postCandidateId: string) => `caption:${postCandidateId}`,
  schedule: (queueItemId: string)   => `schedule:${queueItemId}`,
  publish:  (queueItemId: string)   => `publish:${queueItemId}`,
}
