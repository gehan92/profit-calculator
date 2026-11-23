/**
 * Supabase remembers a "device name" for every login (the User-Agent of the
 * request that created or refreshed it), and the Account page lists those
 * devices ("Chrome on Android"). Our server makes those requests on the
 * person's behalf, so without help the device would always be "node". These
 * helpers pass the person's own browser description along.
 */

/** Browsers send a few hundred characters; anything longer is cut, never trusted blindly. */
const MAX_USER_AGENT_LENGTH = 400;

/**
 * The header to add to a server-side Supabase client so the login is recorded
 * with the person's own device: `{ "User-Agent": "…" }`, or nothing when the
 * request carried none. Control characters (which could split a header) are dropped.
 */
export function forwardUserAgent(userAgent: string | null | undefined): Record<string, string> {
  const cleaned = (userAgent ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_USER_AGENT_LENGTH);
  return cleaned ? { "User-Agent": cleaned } : {};
}
