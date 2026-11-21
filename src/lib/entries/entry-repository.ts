import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "@/config/categories";
import type { IsoDate } from "@/lib/dates";
import type { Database, Tables, TablesInsert } from "@/lib/supabase/types";
import type { ClientEntry, EntryFields } from "./entry";

/** Thrown when Supabase refuses or fails an entries query. */
export class EntryQueryError extends Error {
  constructor(action: string, cause: { message: string }) {
    super(`Could not ${action}: ${cause.message}`);
    this.name = "EntryQueryError";
  }
}

export interface ImportOutcome {
  /** Entries stored now. */
  added: number;
  /** Entries that were already stored by an earlier try (same `clientId`). */
  alreadySaved: number;
}

/** An entry as stored in the database, in the shape screens use. */
export interface StoredEntry extends EntryFields {
  id: string;
  createdAt: string;
}

/** Postgres error code for "this value already exists" (SQLSTATE 23505). */
const UNIQUE_VIOLATION = "23505";

const LIST_COLUMNS = "id, type, category, amount_cents, entry_date, note, created_at" as const;
type ListRow = Pick<Tables<"entries">, "id" | "type" | "category" | "amount_cents" | "entry_date" | "note" | "created_at">;

/**
 * Reads and writes income and expense entries (Part F3 `entries`).
 *
 * Like BusinessRepository it uses the logged-in user's Supabase client, so
 * Row Level Security decides what is allowed (Owner: everything in their
 * shop; Staff: add, and read their own entries from today; nobody: other
 * shops). Day 9 adds update and delete.
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
      .order("created_at", { ascending: false });

    if (error) throw new EntryQueryError("load entries", error);
    return data.map(EntryRepository.fromRow);
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
   */
  async add(businessId: string, fields: EntryFields, clientId: string): Promise<void> {
    const { error } = await this.db.from("entries").insert({
      business_id: businessId,
      type: fields.type,
      category: fields.category,
      amount_cents: fields.amountCents,
      entry_date: fields.entryDate,
      note: fields.note,
      client_id: clientId,
    });

    if (error && error.code !== UNIQUE_VIOLATION) throw new EntryQueryError("add the entry", error);
  }

  /**
   * Stores entries made in the browser (guest mode, later the offline queue).
   *
   * "Upsert on (business_id, client_id)" from Part F4.2: an entry whose
   * `clientId` is already in this shop is skipped, so retrying after a lost
   * connection never creates duplicates.
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
