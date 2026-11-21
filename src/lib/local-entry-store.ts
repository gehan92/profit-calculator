import type { BrowserStore } from "@/lib/browser-store";
import { clientEntrySchema, type ClientEntry, type EntryFields } from "@/lib/entries/entry";

export interface LocalEntryStoreOptions {
  /** Where the entries live in this browser. Bump the version in the key if the shape changes. */
  key: string;
  /** Most entries kept. `add` refuses more, so storage can never grow without limit. */
  maxEntries: number;
}

/** Thrown by `add` when the phone already holds the most entries it may keep. */
export class LocalStoreFullError extends Error {
  constructor(readonly maxEntries: number) {
    super(`This phone keeps at most ${maxEntries} entries`);
    this.name = "LocalStoreFullError";
  }
}

/**
 * Entries kept in this browser only. Used for two things:
 * - guest "My Business (try)" records before login (Part F2 rule 5), see guest-store.ts;
 * - the offline queue of a logged-in user (Part F4.4), see offline-queue.ts.
 *
 * Each entry gets a random `clientId` when it is made. It is stored in
 * `entries.client_id`, so sending an entry twice (a retry, a second tab)
 * never saves it twice.
 *
 * Broken or unknown data is skipped entry by entry, so one bad record can
 * never hide the others.
 */
export class LocalEntryStore {
  private lastRaw: string | null | undefined;
  private lastEntries: readonly ClientEntry[] = [];

  constructor(
    private readonly store: BrowserStore,
    private readonly options: LocalEntryStoreOptions,
  ) {}

  get maxEntries(): number {
    return this.options.maxEntries;
  }

  subscribe = (listener: () => void): (() => void) => this.store.subscribe(listener);

  /**
   * All entries, oldest first. Returns the same array until something
   * changes, as React's `useSyncExternalStore` requires.
   */
  list = (): readonly ClientEntry[] => {
    const raw = this.store.read(this.options.key);
    if (raw !== this.lastRaw) {
      this.lastRaw = raw;
      this.lastEntries = LocalEntryStore.decode(raw);
    }
    return this.lastEntries;
  };

  /** Saves a new entry and returns it (with its `clientId`). */
  add(
    fields: EntryFields,
    now: Date = new Date(),
    clientId: string = crypto.randomUUID(),
  ): ClientEntry {
    const entries = this.list();
    if (entries.length >= this.options.maxEntries) {
      throw new LocalStoreFullError(this.options.maxEntries);
    }

    const entry: ClientEntry = { ...fields, clientId, createdAt: now.toISOString() };
    this.save([...entries, entry]);
    return entry;
  }

  /** Deletes one entry and returns it, so it can be put back with `restore` (Undo). */
  remove(clientId: string): ClientEntry | null {
    const entries = this.list();
    const removed = entries.find((entry) => entry.clientId === clientId) ?? null;
    if (removed) this.save(entries.filter((entry) => entry !== removed));
    return removed;
  }

  /** Puts a deleted entry back in its old place (Undo). Does nothing if it is still there. */
  restore(entry: ClientEntry): void {
    const entries = this.list();
    if (entries.some((existing) => existing.clientId === entry.clientId)) return;
    this.save([...entries, entry].toSorted((a, b) => (a.createdAt < b.createdAt ? -1 : 1)));
  }

  /**
   * Forgets entries that are now safe in an account. Only the given ones:
   * entries added meanwhile (another tab) stay on the phone.
   */
  removeMany(clientIds: Iterable<string>): void {
    const gone = new Set(clientIds);
    if (gone.size === 0) return;
    const remaining = this.list().filter((entry) => !gone.has(entry.clientId));
    this.save(remaining);
  }

  private save(entries: readonly ClientEntry[]): void {
    this.store.write(this.options.key, entries.length === 0 ? null : JSON.stringify(entries));
  }

  private static decode(raw: string | null): readonly ClientEntry[] {
    if (raw === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      const result = clientEntrySchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  }
}
