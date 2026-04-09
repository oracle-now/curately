import { PrismaClient } from '@prisma/client';
import { RateLimitService } from './RateLimitService';

// Configurable via env — bump version here without a code change when Meta deprecates
const IG_API_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v19.0';
const IG_API_BASE = `https://graph.facebook.com/${IG_API_VERSION}`;

const MAX_CONTAINER_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 3000;

type ContainerStatus = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';

export class PublishingService {
  private rateLimitService: RateLimitService;

  constructor(private readonly db: PrismaClient) {
    this.rateLimitService = new RateLimitService(db);
  }

  /**
   * Publish a PostJob to Instagram.
   * Two-step flow: create media container → poll status → publish container.
   */
  async publishJob(postJobId: string): Promise<void> {
    const job = await this.db.postJob.findUniqueOrThrow({
      where: { id: postJobId },
      include: {
        queueItem: { include: { postCandidate: true } },
        instagramAccount: true,
      },
    });

    const { instagramAccount, queueItem } = job;
    const mediaUrls = queueItem.postCandidate.mediaUrls as string[];
    const caption = queueItem.captionText ?? '';
    const hashtags = (queueItem.hashtags as string[]) ?? [];
    const fullCaption = [
      caption,
      hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' '),
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    await this.db.postJob.update({
      where: { id: postJobId },
      data: {
        status: 'running',
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });

    try {
      // Step 1: Create media container
      if (!(await this.rateLimitService.canMakeCall(instagramAccount.id))) {
        throw new Error('Rate limit reached; will retry later');
      }
      const containerId = await this.createMediaContainer(
        instagramAccount.igUserId,
        instagramAccount.accessToken,
        mediaUrls[0],
        fullCaption
      );
      await this.rateLimitService.recordCall(instagramAccount.id);

      // Step 2: Poll container until FINISHED
      await this.pollContainerUntilReady(
        containerId,
        instagramAccount.accessToken,
        instagramAccount.id
      );

      // Step 3: Publish the container
      if (!(await this.rateLimitService.canMakeCall(instagramAccount.id))) {
        throw new Error('Rate limit reached before publish step; will retry later');
      }
      const igMediaId = await this.publishContainer(
        containerId,
        instagramAccount.igUserId,
        instagramAccount.accessToken
      );
      await this.rateLimitService.recordCall(instagramAccount.id);

      await this.db.postJob.update({
        where: { id: postJobId },
        data: { status: 'success', igMediaId },
      });
      await this.db.queueItem.update({
        where: { id: job.queueItemId },
        data: { status: 'posted' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await this.db.postJob.update({
        where: { id: postJobId },
        data: { status: 'failed' },
      });
      // Surface error on QueueItem so UI can show manual fallback
      await this.db.queueItem.update({
        where: { id: job.queueItemId },
        data: { status: 'failed', errorMessage: message },
      });
      throw err;
    }
  }

  /**
   * Step 1: Create a media container on Instagram.
   * access_token sent as Authorization header — never in request body.
   */
  private async createMediaContainer(
    igUserId: string,
    accessToken: string,
    imageUrl: string,
    caption: string
  ): Promise<string> {
    const url = `${IG_API_BASE}/${igUserId}/media`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ image_url: imageUrl, caption }),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string } };
    if (!data.id) {
      throw new Error(`Container creation failed: ${data.error?.message ?? 'unknown error'}`);
    }
    return data.id;
  }

  /**
   * Step 2: Poll container status until FINISHED or terminal error.
   * access_token sent as Authorization header.
   */
  private async pollContainerUntilReady(
    containerId: string,
    accessToken: string,
    igAccountId: string
  ): Promise<void> {
    for (let i = 0; i < MAX_CONTAINER_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const url = `${IG_API_BASE}/${containerId}?fields=status_code`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as { status_code?: ContainerStatus };
      await this.rateLimitService.recordCall(igAccountId);

      if (data.status_code === 'FINISHED') return;
      if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
        throw new Error(`Container entered terminal state: ${data.status_code}`);
      }
      // IN_PROGRESS — continue polling
    }
    throw new Error(
      `Container polling timed out after ${MAX_CONTAINER_POLL_ATTEMPTS} attempts`
    );
  }

  /**
   * Step 3: Publish the container to Instagram feed.
   * access_token sent as Authorization header.
   */
  private async publishContainer(
    containerId: string,
    igUserId: string,
    accessToken: string
  ): Promise<string> {
    const url = `${IG_API_BASE}/${igUserId}/media_publish`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ creation_id: containerId }),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string } };
    if (!data.id) {
      throw new Error(`Publish failed: ${data.error?.message ?? 'unknown error'}`);
    }
    return data.id;
  }
}
