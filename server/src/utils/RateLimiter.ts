/**
 * Basic fixed-window rate limiting (P25: "basic message rate-limiting
 * server-side"). Simpler than a sliding-window log, which is plenty for
 * "basic spam protection" - a player can send up to `limit` messages per
 * `windowMs`, then must wait for the window to roll over.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; windowStartedAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Returns true and records the attempt if allowed; returns false (and does NOT record) if over the limit. */
  tryConsume(key: string, now: number): boolean {
    const window = this.windows.get(key);

    if (!window || now - window.windowStartedAt >= this.windowMs) {
      this.windows.set(key, { count: 1, windowStartedAt: now });

      return true;
    }

    if (window.count >= this.limit) {
      return false;
    }

    window.count += 1;

    return true;
  }

  reset(key: string): void {
    this.windows.delete(key);
  }
}
