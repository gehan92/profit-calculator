"use client";

import { useSyncExternalStore } from "react";
import type { ClientEntry } from "@/lib/entries/entry";
import { offlineEntryQueue } from "@/lib/offline-queue";

const NOTHING: readonly ClientEntry[] = [];

/**
 * The entries added offline that are still waiting to be sent, kept up to
 * date (also when another tab changes the queue). Empty on the server and in
 * the first browser render.
 */
export function useQueuedEntries(): readonly ClientEntry[] {
  return useSyncExternalStore(offlineEntryQueue.subscribe, offlineEntryQueue.list, () => NOTHING);
}
