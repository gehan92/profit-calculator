import { browserStore } from "@/lib/browser-store";
import { LocalEntryStore } from "@/lib/local-entry-store";

/**
 * Most records one phone keeps without an account (about 2 years of daily
 * use). The server also accepts them in batches (see IMPORT_BATCH_SIZE).
 */
export const MAX_GUEST_ENTRIES = 2000;

/**
 * Guest "My Business (try)" records, saved in this browser only
 * (Part F2 rule 5, Part C1.1). After login the dashboard offers to move them
 * into the account with `importGuestEntries`.
 */
export const guestEntryStore = new LocalEntryStore(browserStore, {
  key: "guest:entries:v1",
  maxEntries: MAX_GUEST_ENTRIES,
});
