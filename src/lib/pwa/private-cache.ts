import { PRIVATE_CACHE_NAMES } from "./cache-names";

/**
 * Forgets the dashboard pages the service worker saved for offline use. It runs
 * when someone logs out, deletes their account or sees the login page, so the
 * next person on a shared phone can never open the last person's shop from the
 * offline copy. Safe to call anywhere in the browser; never throws.
 */
export async function clearPrivateCaches(): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    await Promise.all(PRIVATE_CACHE_NAMES.map((name) => caches.delete(name)));
  } catch {
    // Nothing was saved, or the browser does not allow it: nothing to clear.
  }
}
