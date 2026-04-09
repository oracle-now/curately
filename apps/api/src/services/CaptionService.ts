import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import type { CaptionStyleConfig } from '@curately/shared';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class CaptionService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Generate an AI caption for a QueueItem using the given CaptionProfile.
   * Stores the result back on the QueueItem.
   */
  async generateCaption(
    queueItemId: string,
    captionProfileId?: string
  ): Promise<{ captionText: string; hashtags: string[] }> {
    const queueItem = await this.db.queueItem.findUniqueOrThrow({
      where: { id: queueItemId },
      include: { postCandidate: true, captionProfile: true },
    });

    let styleConfig: CaptionStyleConfig;

    if (captionProfileId) {
      const profile = await this.db.captionProfile.findUniqueOrThrow({
        where: { id: captionProfileId },
      });
      styleConfig = profile.styleConfig as CaptionStyleConfig;
    } else if (queueItem.captionProfile) {
      styleConfig = queueItem.captionProfile.styleConfig as CaptionStyleConfig;
    } else {
      styleConfig = {
        tone: 'casual and engaging',
        length: 'medium',
        use_emoji: true,
        hashtag_count: 10,
        hashtag_strategy: 'mix of niche and broad hashtags relevant to the post',
      };
    }

    const originalCaption = queueItem.postCandidate.originalCaption ?? '';
    const prompt = this.buildPrompt(originalCaption, styleConfig);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content) as { caption?: string; hashtags?: string[] };

    const captionText = parsed.caption ?? '';
    const hashtags = parsed.hashtags ?? [];

    await this.db.queueItem.update({
      where: { id: queueItemId },
      data: {
        captionText,
        hashtags,
        status: 'caption_ready',
        captionProfileId: captionProfileId ?? queueItem.captionProfileId,
      },
    });

    return { captionText, hashtags };
  }

  private buildPrompt(originalCaption: string, style: CaptionStyleConfig): string {
    return `You are a social media copywriter. Generate an Instagram caption based on the following.

Original post context: "${originalCaption}"

Style requirements:
- Tone: ${style.tone}
- Length: ${style.length} (short ~50 words, medium ~100 words, long ~150 words)
- Use emoji: ${style.use_emoji ? 'yes' : 'no'}
- Number of hashtags: ${style.hashtag_count}
- Hashtag strategy: ${style.hashtag_strategy}
${style.custom_instructions ? `- Additional instructions: ${style.custom_instructions}` : ''}

Respond ONLY with valid JSON in this exact shape:
{
  "caption": "the full caption text here (without hashtags)",
  "hashtags": ["hashtag1", "hashtag2", ...]
}`;
  }
}
