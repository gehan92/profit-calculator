/**
 * A small "no more than N times in a time window" counter per key (Part F5
 * "Spam limits"), for example per visitor address or per user.
 *
 * It lives in the memory of one server process, so it stops a person or a
 * script that hammers a form, but it is not shared between servers. For real
 * abuse the plan is Vercel Firewall rules or Upstash, later (Part F5): this
 * class is the one place to swap.
 */
export class RateLimiter {
  /** When each key was allowed through, oldest first. */
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    /** Most keys remembered at once, so the memory can never grow without end. */
    private readonly maxKeys = 5000,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Counts one more try for `key`. `allowed: false` means the limit is used
   * up; `retryAfterMs` says how long until one try is free again.
   */
  take(key: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((time) => now - time < this.windowMs);

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterMs: Math.max(0, recent[0] + this.windowMs - now) };
    }

    recent.push(now);
    // Re-insert so the most recently used keys are last (Map keeps insertion order).
    this.hits.delete(key);
    this.hits.set(key, recent);
    this.forgetOldKeys(now);
    return { allowed: true };
  }

  private forgetOldKeys(now: number): void {
    if (this.hits.size <= this.maxKeys) return;
    for (const [key, times] of this.hits) {
      if (times.every((time) => now - time >= this.windowMs)) this.hits.delete(key);
    }
    // Still too many (a flood of new keys): drop the least recently used.
    for (const key of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break;
      this.hits.delete(key);
    }
  }
}
