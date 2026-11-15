import { browserStore, type BrowserStore } from "@/lib/browser-store";
import { clientEntrySchema, type ClientEntry, type EntryFields } from "@/lib/entries/entry";

/** Where guest entries live in this browser. Bump the version if the shape changes. */
const STORAGE_KEY = "guest:entries:v1";

/**
 * Most records one phone keeps without an account (about 2 years of daily
 * use). Also the most one "move to my account" request accepts.
 */
export const MAX_GUEST_ENTRIES = 2000;

/** Thrown by `add` when the phone already holds `MAX_GUEST_ENTRIES`. */
export class GuestStoreFullError extends Error {
  constructor() {
    super(`Guest mode keeps at most ${MAX_GUEST_ENTRIES} entries`);
    this.name = "GuestStoreFullError";
  }
}

/**
 * Guest "My Business (try)" records, saved in this browser only
 * (Part F2 rule 5, Part C1.1).
 *
 * Each entry gets a random `clientId` when it is made. After login the
 * entries are sent with `importGuestEntries`, which stores each `clientId`
 * once, so sending them again (a retry, a second tab) never doubles them.
 *
 * Broken or unknown data is skipped entry by entry, so one bad record can
 * never hide the others.
 */
export class GuestEntryStore {
  private lastRaw: string | null | undefined;
  private lastEntries: readonly ClientEntry[] = [];

  constructor(
    private readonly store: BrowserStore,
    private readonly key: string = STORAGE_KEY,
  ) {}

  subscribe = (listener: () => void): (() => void) => this.store.subscribe(listener);

  /**
   * All entries, oldest first. Returns the same array until something
   * changes, as React's `useSyncExternalStore` requires.
   */
  list = (): readonly ClientEntry[] => {
    const raw = this.store.read(this.key);
    if (raw !== this.lastRaw) {
      this.lastRaw = raw;
      this.lastEntries = GuestEntryStore.decode(raw);
    }
    return this.lastEntries;
  };

  /** Saves a new entry and returns it (with its `clientId`). */
  add(fields: EntryFields, now: Date = new Date(), clientId: string = crypto.randomUUID()): ClientEntry {
    const entries = this.list();
    if (entries.length >= MAX_GUEST_ENTRIES) throw new GuestStoreFullError();

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
    const remaining = this.list().filter((entry) => !gone.has(entry.clientId));
    this.save(remaining);
  }

  private save(entries: readonly ClientEntry[]): void {
    this.store.write(this.key, entries.length === 0 ? null : JSON.stringify(entries));
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

/** The guest entries of this browser. */
export const guestEntryStore = new GuestEntryStore(browserStore);
