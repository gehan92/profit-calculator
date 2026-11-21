/**
 * "Support access" (Part D2 Settings, Part B): an Owner can let the support
 * team look at their records for a limited time. The switch stores the end
 * time in `profiles.support_access_until`; after it passes, access is over
 * with no action needed (the database compares it to `now()`).
 */

/** How long one switch-on lasts (Part D2: "support access (7 days)"). */
export const SUPPORT_ACCESS_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The end time when support access is switched on at `now`. */
export function supportAccessEnd(now: Date = new Date()): Date {
  return new Date(now.getTime() + SUPPORT_ACCESS_DAYS * DAY_MS);
}

/** True while the stored end time is still in the future. */
export function isSupportAccessActive(until: string | null, now: Date = new Date()): boolean {
  if (!until) return false;
  const end = Date.parse(until);
  return Number.isFinite(end) && end > now.getTime();
}
