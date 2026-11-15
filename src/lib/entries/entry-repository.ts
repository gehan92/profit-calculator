import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/supabase/types";
import type { ClientEntry } from "./entry";

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

/**
 * Reads and writes income and expense entries (Part F3 `entries`).
 *
 * Like BusinessRepository it uses the logged-in user's Supabase client, so
 * Row Level Security decides what is allowed (Owner: everything in their
 * shop; nobody: other shops). Day 8 adds add/update/delete here.
 */
export class EntryRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

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

    const rows = entries.map((entry) => EntryRepository.toRow(businessId, entry, now));
    const { data, error } = await this.db
      .from("entries")
      .upsert(rows, { onConflict: "business_id,client_id", ignoreDuplicates: true })
      // Only rows really inserted come back; skipped duplicates do not.
      .select("client_id");

    if (error) throw new EntryQueryError("import entries", error);
    return { added: data.length, alreadySaved: entries.length - data.length };
  }

  private static toRow(businessId: string, entry: ClientEntry, now: Date): TablesInsert<"entries"> {
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
