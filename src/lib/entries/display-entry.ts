import type { ClientEntry, EntryFields, StoredEntry } from "./entry";

/**
 * One row on a list: either saved in the account, or still waiting on this
 * phone to be sent (added offline, Part F4.4).
 */
export interface DisplayEntry extends EntryFields {
  /** A stable React key: the database id, or the client id while waiting. */
  key: string;
  /** The database id; `null` while the entry only exists on this phone. */
  id: string | null;
  createdAt: string;
  /** True while the entry waits on this phone to be sent. */
  pending: boolean;
}

/**
 * Saved entries plus the ones waiting to be sent, so a record added offline
 * shows up (and counts in today's profit) at once.
 *
 * An entry that is both saved and still in the queue (the moment between the
 * server confirming it and the phone forgetting it) is shown once, as saved.
 */
export function mergeQueuedEntries(
  stored: readonly StoredEntry[],
  queued: readonly ClientEntry[],
): DisplayEntry[] {
  const savedClientIds = new Set(stored.flatMap((entry) => (entry.clientId ? [entry.clientId] : [])));

  const saved = stored.map(
    (entry): DisplayEntry => ({
      type: entry.type,
      category: entry.category,
      amountCents: entry.amountCents,
      entryDate: entry.entryDate,
      note: entry.note,
      productId: entry.productId,
      quantity: entry.quantity,
      key: entry.id,
      id: entry.id,
      createdAt: entry.createdAt,
      pending: false,
    }),
  );

  const waiting = queued
    .filter((entry) => !savedClientIds.has(entry.clientId))
    .map(
      (entry): DisplayEntry => ({
        type: entry.type,
        category: entry.category,
        amountCents: entry.amountCents,
        entryDate: entry.entryDate,
        note: entry.note,
        productId: entry.productId,
        quantity: entry.quantity,
        key: entry.clientId,
        id: null,
        createdAt: entry.createdAt,
        pending: true,
      }),
    );

  return [...saved, ...waiting];
}
