import { PrismaClient } from '@prisma/client';
import { RateLimitService } from './RateLimitService';

const IG_API_BASE = 'https://graph.facebook.com/v19.0';
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
   * Two-step: create container → poll status → publish container.
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
    const fullCaption = `${caption}\n\n${hashtags.map((h) => `#${h.replace('#', '')}`).join(' ')}`.trim();

    await this.db.postJob.update({
      where: { id: postJobId },
      data: { status: 'running', lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
    });

    try {
      // Step 1: Create media container
      const canCall = await this.rateLimitService.canMakeCall(instagramAccount.id);
      if (!canCall) throw new Error('Rate limit reached; will retry later');

      const containerId = await this.createMediaContainer(
        instagramAccount.igUserId,
        instagramAccount.accessToken,
        mediaUrls[0],
        fullCaption
      );
      await this.rateLimitService.recordCall(instagramAccount.id);

      // Step 2: Poll container status
      await this.pollContainerUntilReady(
        containerId,
        instagramAccount.igUserId,
        instagramAccount.accessToken,
        instagramAccount.id
      );

      // Step 3: Publish container
      const canPublish = await this.rateLimitService.canMakeCall(instagramAccount.id);
      if (!canPublish) throw new Error('Rate limit reached before publish step');

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
      await this.db.queueItem.update({
        where: { id: job.queueItemId },
        data: { status: 'failed', errorMessage: message },
      });
      throw err;
    }
  }

  private async createMediaContainer(
    igUserId: string,
    accessToken: string,
    imageUrl: string,
    caption: string
  ): Promise<string> {
    const url = `${IG_API_BASE}/${igUserId}/media`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string } };
    if (!data.id) throw new Error(`Container creation failed: ${data.error?.message}`);
    return data.id;
  }

  private async pollContainerUntilReady(
    containerId: string,
    igUserId: string,
    accessToken: string,
    igAccountId: string
  ): Promise<void> {
    for (let i = 0; i < MAX_CONTAINER_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const url = `${IG_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`;
      const res = await fetch(url);
      const data = (await res.json()) as { status_code?: ContainerStatus };
      await this.rateLimitService.recordCall(igAccountId);

      if (data.status_code === 'FINISHED') return;
      if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
        throw new Error(`Container status: ${data.status_code}`);
      }
    }
    throw new Error('Container polling timed out');
  }

  private async publishContainer(
    containerId: string,
    igUserId: string,
    accessToken: string
  ): Promise<string> {
    const url = `${IG_API_BASE}/${igUserId}/media_publish`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string } };
    if (!data.id) throw new Error(`Publish failed: ${data.error?.message}`);
    return data.id;
  }
}
