import { browserStore } from "@/lib/browser-store";
import { LocalEntryStore } from "@/lib/local-entry-store";

/** Far more than anyone adds while offline; keeps the phone's storage safe. */
export const MAX_QUEUED_ENTRIES = 500;

/**
 * Entries a logged-in user added while offline (Part F4.4): "saved to a local
 * queue with client_id; sent when back online". The offline sync component
 * sends them with `syncOfflineEntries` and removes each one only after the
 * server confirms it.
 */
export const offlineEntryQueue = new LocalEntryStore(browserStore, {
  key: "offline:entries:v1",
  maxEntries: MAX_QUEUED_ENTRIES,
});
