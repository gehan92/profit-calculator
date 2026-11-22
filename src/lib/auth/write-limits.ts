import { RateLimiter } from "@/lib/rate-limiter";

/**
 * "Spam limits" for creating and changing records (Part F5): how often one
 * logged-in person may call the entry Server Actions.
 *
 * - `entryChange`: add, edit or delete one record. One a second is far faster
 *   than anyone types on a phone, so a normal shop never meets this limit.
 * - `bulkSend`: the offline queue and the guest import send up to 500 records
 *   in one request, so only a few requests a minute are needed.
 *
 * The count lives in the memory of one server (see `RateLimiter`); it stops a
 * script that hammers the actions. Real abuse is for the Vercel Firewall.
 */
export const WRITE_LIMITS = {
  entryChange: { limit: 60, windowMs: 60_000 },
  bulkSend: { limit: 10, windowMs: 60_000 },
} as const;

export type WriteLimit = keyof typeof WRITE_LIMITS;

const limiters: Record<WriteLimit, RateLimiter> = {
  entryChange: new RateLimiter(WRITE_LIMITS.entryChange.limit, WRITE_LIMITS.entryChange.windowMs),
  bulkSend: new RateLimiter(WRITE_LIMITS.bulkSend.limit, WRITE_LIMITS.bulkSend.windowMs),
};

/** Uses one turn of `limit` for this person. `false` means "too many, try again in a minute". */
export function takeWriteTurn(limit: WriteLimit, userId: string): boolean {
  return limiters[limit].take(userId).allowed;
}
