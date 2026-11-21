"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether this phone has a network connection, kept up to date.
 *
 * The server and the first browser render say "online" (nothing is shown
 * until the browser reports otherwise), so there is no hydration mismatch.
 * Note: "online" only means a connection exists; the internet itself may
 * still be unreachable. Sending failures are handled where they happen.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
