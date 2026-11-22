"use client";

import { useEffect } from "react";

const SESSION_KEY = "pwa:warmed:";

interface NetworkInformationLike {
  saveData?: boolean;
}

/**
 * Asks the service worker to save a few pages for offline use, once per visit,
 * a moment after the page has loaded: the other calculators, or the dashboard's
 * Home and Add screens. Pages are otherwise saved only when they are opened,
 * so a calculator the person never opened would not work offline.
 *
 * It does nothing while offline, when the phone's data saver is on, or when
 * there is no service worker (development).
 */
export function OfflinePages({ urls, group }: { urls: readonly string[]; group: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    if (!navigator.onLine) return;
    if ((navigator as Navigator & { connection?: NetworkInformationLike }).connection?.saveData) return;

    const key = `${SESSION_KEY}${group}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
    } catch {
      // No session storage: save again on every page, which only costs a little data.
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (cancelled || !registration?.active) return;
      // `[address, options]`: a plain address would not say it is a page, and the worker saves only pages.
      const urlsToCache = urls.map((url) => [url, { headers: { Accept: "text/html" } }]);
      registration.active.postMessage({ type: "CACHE_URLS", payload: { urlsToCache } });
      try {
        window.sessionStorage.setItem(key, "1");
      } catch {
        // See above.
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [urls, group]);

  return null;
}
