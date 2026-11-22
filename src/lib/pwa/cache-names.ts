/**
 * Names of the browser caches the service worker uses (Part F4.4), shared by
 * the worker and by the page code that clears them. Plain constants only, so
 * the worker can import this file without pulling in anything else.
 */

/** Dashboard pages: they show one person's shop, so they must be cleared at log out. */
export const PRIVATE_PAGES_CACHE = "private-pages";

/** Calculators, the home page and other pages that look the same for everyone. */
export const PUBLIC_PAGES_CACHE = "public-pages";

/** Everything cached because it holds a person's pages. Cleared at log out. */
export const PRIVATE_CACHE_NAMES: readonly string[] = [PRIVATE_PAGES_CACHE];
