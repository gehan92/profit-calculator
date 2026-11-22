import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limiter";

function limiterWithClock(limit: number, windowMs: number, maxKeys?: number) {
  let time = 1_000_000;
  const limiter = new RateLimiter(limit, windowMs, maxKeys, () => time);
  return { limiter, advance: (ms: number) => (time += ms) };
}

describe("RateLimiter", () => {
  it("lets a key through until the limit is used up", () => {
    const { limiter } = limiterWithClock(3, 60_000);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(false);
  });

  it("counts each key on its own", () => {
    const { limiter } = limiterWithClock(1, 60_000);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("b").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(false);
  });

  it("says how long until a try is free again", () => {
    const { limiter, advance } = limiterWithClock(1, 60_000);
    limiter.take("a");
    advance(20_000);
    expect(limiter.take("a")).toEqual({ allowed: false, retryAfterMs: 40_000 });
  });

  it("allows a key again once its window has passed", () => {
    const { limiter, advance } = limiterWithClock(2, 60_000);
    limiter.take("a");
    limiter.take("a");
    expect(limiter.take("a").allowed).toBe(false);
    advance(60_001);
    expect(limiter.take("a").allowed).toBe(true);
  });

  it("does not count refused tries, so waiting is never punished", () => {
    const { limiter, advance } = limiterWithClock(1, 60_000);
    limiter.take("a");
    for (let i = 0; i < 10; i += 1) limiter.take("a");
    advance(60_001);
    expect(limiter.take("a").allowed).toBe(true);
  });

  it("never remembers more keys than the maximum", () => {
    const { limiter } = limiterWithClock(1, 60_000, 3);
    for (const key of ["a", "b", "c", "d", "e"]) limiter.take(key);
    // The oldest keys were forgotten, so they get a fresh start; the newest are still limited.
    expect(limiter.take("e").allowed).toBe(false);
    expect(limiter.take("a").allowed).toBe(true);
  });
});
