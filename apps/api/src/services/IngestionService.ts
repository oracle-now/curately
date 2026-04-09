import Parser from 'rss-parser';
import { PrismaClient } from '@prisma/client';

const parser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail', 'enclosure'],
  },
});

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export class IngestionService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Ingest all active sources for a given user.
   * Called by the ingestion worker on a schedule.
   */
  async ingestAllSourcesForUser(userId: string): Promise<void> {
    const sources = await this.db.source.findMany({
      where: { userId, active: true },
    });

    await Promise.allSettled(sources.map((s) => this.ingestSource(s.id)));
  }

  /**
   * Ingest a single source: fetch RSS feed, normalize items, upsert PostCandidates.
   */
  async ingestSource(sourceId: string): Promise<void> {
    const source = await this.db.source.findUniqueOrThrow({
      where: { id: sourceId },
    });

    let feed;
    try {
      feed = await parser.parseURL(source.rssUrl);
    } catch (err) {
      console.error(`[IngestionService] Failed to fetch feed for source ${sourceId}:`, err);
      // Mark as stale if last sync was too long ago
      const now = new Date();
      const lastSync = source.lastSyncedAt ? source.lastSyncedAt.getTime() : 0;
      if (now.getTime() - lastSync > STALE_THRESHOLD_MS) {
        await this.db.source.update({
          where: { id: sourceId },
          data: { isStale: true },
        });
      }
      return;
    }

    const now = new Date();

    for (const item of feed.items) {
      const externalId = item.guid ?? item.link ?? item.id;
      if (!externalId) continue;

      const mediaUrls = this.extractMediaUrls(item);
      const originalCaption = item.contentSnippet ?? item.title ?? null;
      const takenAt = item.pubDate ? new Date(item.pubDate) : null;

      await this.db.postCandidate.upsert({
        where: {
          userId_sourceId_externalId: {
            userId: source.userId,
            sourceId: source.id,
            externalId,
          },
        },
        update: {}, // don't overwrite existing data
        create: {
          userId: source.userId,
          sourceId: source.id,
          externalId,
          mediaUrls,
          originalCaption,
          takenAt,
        },
      });
    }

    await this.db.source.update({
      where: { id: sourceId },
      data: {
        lastSyncedAt: now,
        isStale: false,
      },
    });
  }

  /**
   * Extract media URLs from an RSS item.
   * Handles enclosure, media:content, media:thumbnail.
   */
  private extractMediaUrls(item: Parser.Item & Record<string, unknown>): string[] {
    const urls: string[] = [];

    if (item.enclosure?.url) urls.push(item.enclosure.url);

    const mediaContent = item['media:content'];
    if (mediaContent) {
      if (Array.isArray(mediaContent)) {
        mediaContent.forEach((m: { $?: { url?: string } }) => {
          if (m?.$?.url) urls.push(m.$.url);
        });
      } else if ((mediaContent as { $?: { url?: string } })?.$?.url) {
        urls.push((mediaContent as { $: { url: string } }).$.url);
      }
    }

    const mediaThumbnail = item['media:thumbnail'];
    if ((mediaThumbnail as { $?: { url?: string } })?.$?.url) {
      urls.push((mediaThumbnail as { $: { url: string } }).$.url);
    }

    return [...new Set(urls)]; // dedupe
  }
}
