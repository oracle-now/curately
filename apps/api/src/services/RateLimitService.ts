import { PrismaClient } from '@prisma/client';

const HOURLY_LIMIT = 200;
const SAFETY_BUFFER = 0.9; // block at 90% of limit
const SAFE_LIMIT = Math.floor(HOURLY_LIMIT * SAFETY_BUFFER); // 180

export class RateLimitService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Check if an IG account can make an API call.
   * Returns true if safe to proceed, false if rate limited.
   */
  async canMakeCall(igAccountId: string): Promise<boolean> {
    const window = await this.getCurrentWindow(igAccountId);
    return window.callCount < SAFE_LIMIT;
  }

  /**
   * Increment call count for an IG account.
   * Call this after every successful or failed Meta API request.
   */
  async recordCall(igAccountId: string): Promise<void> {
    const window = await this.getCurrentWindow(igAccountId);
    await this.db.apiRateLimit.update({
      where: { id: window.id },
      data: { callCount: { increment: 1 } },
    });
  }

  /**
   * Get remaining calls in the current window.
   */
  async getRemainingCalls(igAccountId: string): Promise<number> {
    const window = await this.getCurrentWindow(igAccountId);
    return Math.max(0, SAFE_LIMIT - window.callCount);
  }

  /**
   * Get or create the current hourly window for an account.
   */
  private async getCurrentWindow(igAccountId: string) {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setMinutes(0, 0, 0); // start of current hour

    const existing = await this.db.apiRateLimit.findFirst({
      where: {
        igAccountId,
        windowStart: { gte: windowStart },
      },
    });

    if (existing) return existing;

    return this.db.apiRateLimit.create({
      data: {
        igAccountId,
        callCount: 0,
        windowStart,
      },
    });
  }
}
