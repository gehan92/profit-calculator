"use client";

import { useSyncExternalStore } from "react";
import type { ClientEntry } from "@/lib/entries/entry";
import { guestEntryStore } from "@/lib/guest-store";

/**
 * The guest entries saved in this browser, kept up to date (also when
 * another tab changes them).
 *
 * `null` on the server and in the first browser render, because only the
 * browser can read them; show a placeholder until they arrive.
 */
export function useGuestEntries(): readonly ClientEntry[] | null {
  return useSyncExternalStore(guestEntryStore.subscribe, guestEntryStore.list, () => null);
}
