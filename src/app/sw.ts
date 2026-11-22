/// <reference lib="esnext" />
/// <reference lib="webworker" />
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
  type SerwistPlugin,
} from "serwist";
import { LOCALES, DEFAULT_LOCALE } from "@/i18n/config";
import { PRIVATE_PAGES_CACHE, PUBLIC_PAGES_CACHE } from "@/lib/pwa/cache-names";
import { classifyPath, localeOfPath, offlinePagePath } from "@/lib/pwa/cache-rules";

/**
 * The service worker (Part F4.4): it makes the website work on a bad or missing
 * connection.
 *
 * - Built files (JavaScript, CSS) are saved when the worker installs, so the
 *   calculators open again without internet after the first visit.
 * - Calculator and other public pages: network first (so they are fresh), the
 *   saved copy when the network is slow or gone.
 * - Dashboard pages: also network first, so they always show current numbers.
 *   The saved copy is only a fallback, and it is deleted at log out.
 * - Never saved: the admin panel, login, anything from other websites
 *   (Supabase, Google) and anything that is not a plain page or file.
 * - No connection and no saved copy: a friendly offline page in the person's
 *   language.
 *
 * Which pages fall into which group is decided in `lib/pwa/cache-rules.ts`.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

/** A redirect cannot be shown as the answer to a page request, so it is never saved. */
const skipRedirects: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) => (response.redirected ? null : response),
};

/**
 * Page requests: the browser loading a page, Next.js fetching the next page's data, or a page the
 * website asked the worker to save in advance (`OfflinePages`, which asks for `text/html`).
 */
const isPageRequest = (request: Request) =>
  request.mode === "navigate" ||
  request.headers.get("RSC") === "1" ||
  (request.headers.get("Accept") ?? "").includes("text/html");

/** Where the installed app starts (app/manifest.ts). Without a language: the server adds the person's own. */
const START_URL = "/dashboard";

/** The address of the most recently saved dashboard home page, in whichever language it was opened. */
async function lastSavedDashboardPath(): Promise<string | undefined> {
  const cache = await caches.open(PRIVATE_PAGES_CACHE);
  const homePage = new RegExp(`^/(${LOCALES.join("|")})/dashboard/?$`);
  // `keys()` lists the oldest first, so the newest copy is the last one.
  return [...(await cache.keys())]
    .reverse()
    .map((request) => new URL(request.url).pathname)
    .find((pathname) => homePage.test(pathname));
}

const runtimeCaching: RuntimeCaching[] = [
  // Other websites (Supabase, Google...), the admin panel, login, APIs: always the live network.
  {
    matcher: ({ sameOrigin, url }) => !sameOrigin || classifyPath(url.pathname) === "never",
    handler: new NetworkOnly(),
  },
  // Built files carry a fingerprint in their name and never change: keep them.
  {
    matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "next-static",
      plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * DAY, maxAgeFrom: "last-used" })],
    }),
  },
  // Pictures and fonts.
  {
    matcher: ({ request, url }) =>
      url.pathname.startsWith("/_next/image") || ["image", "font"].includes(request.destination),
    handler: new StaleWhileRevalidate({
      cacheName: "images-and-fonts",
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * DAY, maxAgeFrom: "last-used" })],
    }),
  },
  // Opening the app from the home screen starts at /dashboard (the manifest's start_url). With no
  // connection, open the dashboard this phone saw last instead of an error.
  {
    matcher: ({ request, url }) => request.mode === "navigate" && url.pathname === START_URL,
    handler: async ({ request }) => {
      try {
        return await fetch(request);
      } catch {
        const saved = await lastSavedDashboardPath();
        // A redirect, so the address bar and the page agree; the saved copy is then served as usual.
        if (saved) return Response.redirect(new URL(saved, request.url).href, 302);
        return (await serwist.matchPrecache(offlinePagePath(DEFAULT_LOCALE))) ?? Response.error();
      }
    },
  },
  // One person's pages.
  {
    matcher: ({ request, url }) => isPageRequest(request) && classifyPath(url.pathname) === "private",
    handler: new NetworkFirst({
      cacheName: PRIVATE_PAGES_CACHE,
      networkTimeoutSeconds: 4,
      plugins: [skipRedirects, new ExpirationPlugin({ maxEntries: 24, maxAgeSeconds: 7 * DAY })],
    }),
  },
  // Pages that look the same for everyone.
  {
    matcher: ({ request, url }) => isPageRequest(request) && classifyPath(url.pathname) === "public",
    handler: new NetworkFirst({
      cacheName: PUBLIC_PAGES_CACHE,
      networkTimeoutSeconds: 3,
      plugins: [skipRedirects, new ExpirationPlugin({ maxEntries: 48, maxAgeSeconds: 7 * DAY })],
    }),
  },
  // Everything else on this website: straight from the network.
  { matcher: ({ sameOrigin }) => sameOrigin, handler: new NetworkOnly() },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    // The offline page in the language of the page that failed; English when it cannot tell.
    entries: [
      ...LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) => ({
        url: offlinePagePath(locale),
        matcher: ({ request }: { request: Request }) =>
          request.destination === "document" && localeOfPath(new URL(request.url).pathname) === locale,
      })),
      {
        url: offlinePagePath(DEFAULT_LOCALE),
        matcher: ({ request }: { request: Request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
