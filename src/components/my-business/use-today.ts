"use client";

import { useSyncExternalStore } from "react";
import { localIsoDate, type IsoDate } from "@/lib/dates";

/** Checks again every minute and whenever the phone comes back to the page. */
function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/**
 * Today's date on this phone, e.g. "2026-11-15", updated after midnight.
 *
 * `null` on the server and in the first browser render: the server can't
 * know the phone's date, so screens show a placeholder until it is known.
 */
export function useToday(): IsoDate | null {
  return useSyncExternalStore(subscribe, () => localIsoDate(), () => null);
}
