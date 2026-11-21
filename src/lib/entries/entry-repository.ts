import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "@/config/categories";
import type { IsoDate } from "@/lib/dates";
import type { Database, Tables, TablesInsert } from "@/lib/supabase/types";
import type { ClientEntry, EntryFields, StoredEntry } from "./entry";
import { monthRange, type EntryFilters } from "./entry-filters";
import type { SummaryEntry } from "./monthly-summary";

/** Thrown when Supabase refuses or fails an entries query. `code` is the Postgres error code, if any. */
export class EntryQueryError extends Error {
  readonly code: string | undefined;

  constructor(action: string, cause: { message: string; code?: string }) {
    super(`Could not ${action}: ${cause.message}`);
    this.name = "EntryQueryError";
    this.code = cause.code;
  }

  /** True when the database refused because the person may not do this (Row Level Security). */
  get isPermissionDenied(): boolean {
    return this.code === INSUFFICIENT_PRIVILEGE;
  }
}

export interface ImportOutcome {
  /** Entries stored now. */
  added: number;
  /** Entries that were already stored by an earlier try (same `clientId`). */
  alreadySaved: number;
}

/** What happened to each entry of an offline-queue batch, by `clientId`. */
export interface SyncOutcome {
  /** Stored now, or already stored by an earlier try: the phone may forget these. */
  saved: string[];
  /** The database will never accept these (e.g. not allowed): the phone should give up on them. */
  refused: string[];
  /** A temporary problem (e.g. the database was unreachable): keep these and try again later. */
  failed: string[];
}

/** SQLSTATE codes (Postgres error classes) used below. */
const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";

/** How an insert error should be treated when sending queued entries. */
export type InsertVerdict = "saved" | "refused" | "retry";

/**
 * Decides what to do with an entry whose insert failed:
 * - duplicate `client_id` → it is already stored: done;
 * - "not allowed", a broken rule or bad data (classes 42501, 23, 22) → it will
 *   never be accepted: give up, so one bad entry cannot block the queue forever;
 * - anything else (network, timeout, server trouble) → try again later.
 */
export function judgeInsertError(code: string | undefined): InsertVerdict {
  if (code === UNIQUE_VIOLATION) return "saved";
  if (code === INSUFFICIENT_PRIVILEGE || code?.startsWith("23") || code?.startsWith("22")) {
    return "refused";
  }
  return "retry";
}

/** Entries one list page loads at most (Supabase also stops at 1,000 rows per request). */
export const ENTRIES_PAGE_LIMIT = 1000;

/** The most pages the summary reads for one month (50 × 1,000 = 50,000 entries). */
export const SUMMARY_MAX_PAGES = 50;

/** The most pages one export reads (200 × 1,000 = 200,000 entries). */
export const EXPORT_MAX_PAGES = 200;

const SUMMARY_COLUMNS = "type, category, amount_cents, entry_date" as const;

const LIST_COLUMNS =
  "id, type, category, amount_cents, entry_date, note, created_at, client_id" as const;
type ListRow = Pick<
  Tables<"entries">,
  "id" | "type" | "category" | "amount_cents" | "entry_date" | "note" | "created_at" | "client_id"
>;

/**
 * Reads and writes income and expense entries (Part F3 `entries`).
 *
 * Like BusinessRepository it uses the logged-in user's Supabase client, so
 * Row Level Security decides what is allowed (Owner: everything in their
 * shop; Staff: add, and read/edit their own entries from today; Viewer: read;
 * nobody: other shops).
 */
export class EntryRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** Entries dated `from` or later, newest first. RLS limits Staff to their own from today. */
  async listSince(businessId: string, from: IsoDate): Promise<StoredEntry[]> {
    const { data, error } = await this.db
      .from("entries")
      .select(LIST_COLUMNS)
      .eq("business_id", businessId)
      .gte("entry_date", from)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(ENTRIES_PAGE_LIMIT);

    if (error) throw new EntryQueryError("load entries", error);
    return data.map(EntryRepository.fromRow);
  }

  /**
   * One month of entries for the Entries list (Part D2), newest first, with
   * the type and category filters applied in the database.
   * `truncated` is true when the month has more than one page can hold.
   */
  async listMonth(
    businessId: string,
    filters: EntryFilters,
  ): Promise<{ entries: StoredEntry[]; truncated: boolean }> {
    const { from, before } = monthRange(filters.month);
    let query = this.db
      .from("entries")
      .select(LIST_COLUMNS)
      .eq("business_id", businessId)
      .gte("entry_date", from)
      .lt("entry_date", before);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.category) query = query.eq("category", filters.category);

    const { data, error } = await query
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(ENTRIES_PAGE_LIMIT);

    if (error) throw new EntryQueryError("load entries", error);
    return { entries: data.map(EntryRepository.fromRow), truncated: data.length >= ENTRIES_PAGE_LIMIT };
  }

  /**
   * EVERY entry of one month, for the monthly summary (Part D2): totals must
   * match the sum of all entries, so unlike `listMonth` this does not stop at
   * the first 1,000. It reads page after page in a fixed order (date, then id,
   * which never repeats) until a page comes back short.
   * `truncated` is true only if the month is bigger than `SUMMARY_MAX_PAGES` pages.
   */
  async listMonthForSummary(
    businessId: string,
    month: string,
  ): Promise<{ entries: SummaryEntry[]; truncated: boolean }> {
    const { from, before } = monthRange(month);
    const entries: SummaryEntry[] = [];

    for (let page = 0; page < SUMMARY_MAX_PAGES; page++) {
      const start = page * ENTRIES_PAGE_LIMIT;
      const { data, error } = await this.db
        .from("entries")
        .select(SUMMARY_COLUMNS)
        .eq("business_id", businessId)
        .gte("entry_date", from)
        .lt("entry_date", before)
        .order("entry_date", { ascending: true })
        .order("id", { ascending: true })
        .range(start, start + ENTRIES_PAGE_LIMIT - 1);

      if (error) throw new EntryQueryError("load the summary", error);
      entries.push(
        ...data.map((row) => ({
          type: row.type,
          category: row.category as Category,
          amountCents: row.amount_cents,
          entryDate: row.entry_date,
        })),
      );
      if (data.length < ENTRIES_PAGE_LIMIT) return { entries, truncated: false };
    }
    return { entries, truncated: true };
  }

  /**
   * Every entry for the CSV export, oldest first (Part D2 Settings "export CSV").
   * Pages like `listMonthForSummary`, with no month limit.
   */
  async listAll(businessId: string): Promise<{ entries: StoredEntry[]; truncated: boolean }> {
    const entries: StoredEntry[] = [];

    for (let page = 0; page < EXPORT_MAX_PAGES; page++) {
      const start = page * ENTRIES_PAGE_LIMIT;
      const { data, error } = await this.db
        .from("entries")
        .select(LIST_COLUMNS)
        .eq("business_id", businessId)
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(start, start + ENTRIES_PAGE_LIMIT - 1);

      if (error) throw new EntryQueryError("export entries", error);
      entries.push(...data.map(EntryRepository.fromRow));
      if (data.length < ENTRIES_PAGE_LIMIT) return { entries, truncated: false };
    }
    return { entries, truncated: true };
  }

  /**
   * Adds one entry (Part D2 "Add entry"). `clientId` is made in the browser
   * for each save, so a double tap or a retry after a lost answer stores it
   * once: the second copy is refused by the database's unique rule on
   * (business_id, client_id) and counts as "already saved".
   *
   * This is a plain insert on purpose, and nothing is read back. RLS lets
   * Staff add an entry for an earlier day but not read it, and both
   * `.select()` and `ON CONFLICT` (upsert) make Postgres check the read rule
   * too, which would make a Staff member's save for "yesterday" fail
   * (see the note in 0001_init.sql and the test in supabase/tests/rls.test.ts).
   *
   * `createdAt` keeps the time an offline entry was really written.
   */
  async add(
    businessId: string,
    fields: EntryFields,
    clientId: string,
    createdAt?: Date,
  ): Promise<void> {
    const { error } = await this.db.from("entries").insert({
      business_id: businessId,
      type: fields.type,
      category: fields.category,
      amount_cents: fields.amountCents,
      entry_date: fields.entryDate,
      note: fields.note,
      client_id: clientId,
      ...(createdAt && { created_at: createdAt.toISOString() }),
    });

    if (error && error.code !== UNIQUE_VIOLATION) throw new EntryQueryError("add the entry", error);
  }

  /**
   * Sends the offline queue (Part F4.4). Every entry is inserted on its own,
   * so one entry the database refuses never blocks the others, and a retry of
   * the whole batch stores nothing twice (same `client_id`).
   * Entries keep the time they were written, capped at `now` (a wrong phone clock).
   */
  async addQueued(
    businessId: string,
    entries: readonly ClientEntry[],
    now: Date = new Date(),
  ): Promise<SyncOutcome> {
    const outcome: SyncOutcome = { saved: [], refused: [], failed: [] };

    await Promise.all(
      entries.map(async (entry) => {
        const createdAt = new Date(Math.min(Date.parse(entry.createdAt), now.getTime()));
        try {
          await this.add(businessId, entry, entry.clientId, createdAt);
          outcome.saved.push(entry.clientId);
        } catch (error) {
          const code = error instanceof EntryQueryError ? error.code : undefined;
          const verdict = judgeInsertError(code);
          outcome[verdict === "refused" ? "refused" : "failed"].push(entry.clientId);
        }
      }),
    );
    return outcome;
  }

  /**
   * Changes an entry (Part D2 edit sheet). Returns `false` when there is
   * nothing to change: it does not exist, or RLS hides it from this person.
   * (Staff may change only their own entries from today, and may not move one
   * to another day; the database refuses that with a permission error.)
   */
  async update(id: string, fields: EntryFields): Promise<boolean> {
    const { data, error } = await this.db
      .from("entries")
      .update({
        type: fields.type,
        category: fields.category,
        amount_cents: fields.amountCents,
        entry_date: fields.entryDate,
        note: fields.note,
      })
      .eq("id", id)
      .select("id");

    if (error) throw new EntryQueryError("change the entry", error);
    return data.length > 0;
  }

  /** Deletes an entry. Returns `false` when there was nothing to delete or RLS hides it (only Owners may delete). */
  async delete(id: string): Promise<boolean> {
    const { data, error } = await this.db.from("entries").delete().eq("id", id).select("id");

    if (error) throw new EntryQueryError("delete the entry", error);
    return data.length > 0;
  }

  /**
   * Stores entries made in the browser before login (guest mode).
   *
   * "Upsert on (business_id, client_id)" from Part F4.2: an entry whose
   * `clientId` is already in this shop is skipped, so retrying after a lost
   * connection never creates duplicates. Owner only: it asks Postgres to read
   * the rows, which Staff may not do for past days.
   */
  async importClientEntries(
    businessId: string,
    entries: readonly ClientEntry[],
    now: Date = new Date(),
  ): Promise<ImportOutcome> {
    if (entries.length === 0) return { added: 0, alreadySaved: 0 };

    const rows = entries.map((entry) => EntryRepository.toImportRow(businessId, entry, now));
    const { data, error } = await this.db
      .from("entries")
      .upsert(rows, { onConflict: "business_id,client_id", ignoreDuplicates: true })
      // Only rows really inserted come back; skipped duplicates do not.
      .select("client_id");

    if (error) throw new EntryQueryError("import entries", error);
    return { added: data.length, alreadySaved: entries.length - data.length };
  }

  private static fromRow(row: ListRow): StoredEntry {
    return {
      id: row.id,
      type: row.type,
      // Stored keys always come from config/categories.ts (checked on every write).
      category: row.category as Category,
      amountCents: row.amount_cents,
      entryDate: row.entry_date,
      note: row.note,
      createdAt: row.created_at,
      clientId: row.client_id,
    };
  }

  private static toImportRow(
    businessId: string,
    entry: ClientEntry,
    now: Date,
  ): TablesInsert<"entries"> {
    // Keep when it was really written, so a day's entries stay in order;
    // a phone clock set in the future is capped at the server's time.
    const createdAt = new Date(Math.min(Date.parse(entry.createdAt), now.getTime()));

    return {
      business_id: businessId,
      type: entry.type,
      category: entry.category,
      amount_cents: entry.amountCents,
      entry_date: entry.entryDate,
      note: entry.note,
      client_id: entry.clientId,
      created_at: createdAt.toISOString(),
    };
  }
}
