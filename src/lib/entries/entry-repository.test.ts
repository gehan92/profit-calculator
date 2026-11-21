import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/types";
import type { EntryFields } from "./entry";
import { EntryQueryError, EntryRepository } from "./entry-repository";

const fields: EntryFields = {
  type: "income",
  category: "sales",
  amountCents: 2_500_000,
  entryDate: "2026-11-21",
  note: null,
};

/** A Supabase client that answers every `insert` with `error`, and remembers what was sent. */
function clientAnswering(error: { code: string; message: string } | null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const db = { from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient<Database>;
  return { db, insert };
}

describe("EntryRepository.add", () => {
  it("sends the entry as snake_case columns with its client id", async () => {
    const { db, insert } = clientAnswering(null);
    await new EntryRepository(db).add("shop-1", fields, "client-1");

    expect(insert).toHaveBeenCalledWith({
      business_id: "shop-1",
      type: "income",
      category: "sales",
      amount_cents: 2_500_000,
      entry_date: "2026-11-21",
      note: null,
      client_id: "client-1",
    });
  });

  it("counts a repeated client id as already saved (double tap, lost answer)", async () => {
    const { db } = clientAnswering({ code: "23505", message: "duplicate key value" });
    await expect(new EntryRepository(db).add("shop-1", fields, "client-1")).resolves.toBeUndefined();
  });

  it("reports every other database error", async () => {
    const { db } = clientAnswering({ code: "42501", message: "row-level security" });
    await expect(new EntryRepository(db).add("shop-1", fields, "client-1")).rejects.toBeInstanceOf(
      EntryQueryError,
    );
  });
});
