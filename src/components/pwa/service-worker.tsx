"use client";

import { useEffect } from "react";

/** Where the built service worker is served (app/serwist/[path]/route.ts). */
export const SERVICE_WORKER_URL = "/serwist/sw.js";

/**
 * Starts the service worker (Part F4.4), so the calculators open without
 * internet and the website can be added to the home screen. It is off during
 * development: a worker that saves pages would hide the changes being made.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    // `type: "module"`: the worker is built as an ES module. Failing to start is harmless:
    // the website simply works as before, only without the offline pages.
    navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: "/", type: "module" })
      .catch(() => undefined);
  }, []);

  return null;
}
