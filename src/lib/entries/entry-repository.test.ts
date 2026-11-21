import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/types";
import type { ClientEntry, EntryFields } from "./entry";
import { EntryQueryError, EntryRepository, judgeInsertError } from "./entry-repository";

const fields: EntryFields = {
  type: "income",
  category: "sales",
  amountCents: 2_500_000,
  entryDate: "2026-11-21",
  note: null,
};

type Answer = { data?: unknown; error?: { code: string; message: string } | null };

/**
 * A fake Supabase client. Every call in a query chain returns the same object,
 * which can be awaited and then answers with `answer(callNumber)`. It remembers
 * the calls so tests can check what was sent.
 */
function fakeDb(answer: (call: number) => Answer = () => ({ data: [], error: null })) {
  const calls: { method: string; args: unknown[] }[] = [];
  let tables = 0;

  function chain(call: number) {
    const proxy: Record<string, unknown> = {
      then: (resolve: (value: Answer) => unknown) =>
        Promise.resolve({ data: null, error: null, ...answer(call) }).then(resolve),
    };
    for (const method of [
      "insert", "update", "delete", "select", "eq", "gte", "lt", "order", "limit", "upsert",
    ]) {
      proxy[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return proxy;
      };
    }
    return proxy;
  }

  const db = {
    from: vi.fn(() => chain(++tables)),
  } as unknown as SupabaseClient<Database>;
  return { db, calls };
}

describe("judgeInsertError", () => {
  it("treats a repeated client id as already saved", () => {
    expect(judgeInsertError("23505")).toBe("saved");
  });

  it.each(["42501", "23514", "23503", "22P02", "22003"])("gives up on %s (never accepted)", (code) => {
    expect(judgeInsertError(code)).toBe("refused");
  });

  it.each([undefined, "08006", "57014", "PGRST301", "53300"])("retries later on %s", (code) => {
    expect(judgeInsertError(code)).toBe("retry");
  });
});

describe("EntryRepository.add", () => {
  it("sends the entry as snake_case columns with its client id", async () => {
    const { db, calls } = fakeDb();
    await new EntryRepository(db).add("shop-1", fields, "client-1");

    expect(calls[0]).toEqual({
      method: "insert",
      args: [
        {
          business_id: "shop-1",
          type: "income",
          category: "sales",
          amount_cents: 2_500_000,
          entry_date: "2026-11-21",
          note: null,
          client_id: "client-1",
        },
      ],
    });
  });

  it("keeps the time an offline entry was written", async () => {
    const { db, calls } = fakeDb();
    await new EntryRepository(db).add("shop-1", fields, "client-1", new Date("2026-11-21T04:30:00Z"));
    expect(calls[0].args[0]).toMatchObject({ created_at: "2026-11-21T04:30:00.000Z" });
  });

  it("counts a repeated client id as already saved (double tap, lost answer)", async () => {
    const { db } = fakeDb(() => ({ error: { code: "23505", message: "duplicate key value" } }));
    await expect(new EntryRepository(db).add("shop-1", fields, "client-1")).resolves.toBeUndefined();
  });

  it("reports every other database error, with its code", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "row-level security" } }));
    const failure = await new EntryRepository(db)
      .add("shop-1", fields, "client-1")
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(EntryQueryError);
    expect((failure as EntryQueryError).isPermissionDenied).toBe(true);
  });
});

describe("EntryRepository.addQueued", () => {
  const entry = (clientId: string, createdAt = "2026-11-21T08:00:00.000Z"): ClientEntry => ({
    ...fields,
    clientId,
    createdAt,
  });

  it("sorts every entry into saved, refused or retry-later by its own result", async () => {
    // Call order follows the entries: 1 ok, 2 duplicate, 3 not allowed, 4 network trouble.
    const answers: Answer[] = [
      { error: null },
      { error: { code: "23505", message: "duplicate" } },
      { error: { code: "42501", message: "rls" } },
      { error: { code: "08006", message: "connection" } },
    ];
    const { db } = fakeDb((call) => answers[call - 1]);

    const outcome = await new EntryRepository(db).addQueued("shop-1", [
      entry("a"), entry("b"), entry("c"), entry("d"),
    ]);

    expect(outcome.saved.sort()).toEqual(["a", "b"]);
    expect(outcome.refused).toEqual(["c"]);
    expect(outcome.failed).toEqual(["d"]);
  });

  it("caps a wrong phone clock at the server's time", async () => {
    const { db, calls } = fakeDb();
    await new EntryRepository(db).addQueued(
      "shop-1",
      [entry("a", "2030-01-01T00:00:00.000Z")],
      new Date("2026-11-21T10:00:00Z"),
    );
    expect(calls[0].args[0]).toMatchObject({ created_at: "2026-11-21T10:00:00.000Z" });
  });

  it("does nothing for an empty queue", async () => {
    const { db } = fakeDb();
    expect(await new EntryRepository(db).addQueued("shop-1", [])).toEqual({ saved: [], refused: [], failed: [] });
  });
});

describe("EntryRepository.listMonth", () => {
  it("asks for one month, newest first, with the filters", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    await new EntryRepository(db).listMonth("shop-1", { month: "2026-11", type: "expense", category: "stock" });

    expect(calls).toContainEqual({ method: "gte", args: ["entry_date", "2026-11-01"] });
    expect(calls).toContainEqual({ method: "lt", args: ["entry_date", "2026-12-01"] });
    expect(calls).toContainEqual({ method: "eq", args: ["type", "expense"] });
    expect(calls).toContainEqual({ method: "eq", args: ["category", "stock"] });
    expect(calls).toContainEqual({ method: "order", args: ["entry_date", { ascending: false }] });
  });

  it("adds no type or category condition when they are not chosen", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    await new EntryRepository(db).listMonth("shop-1", { month: "2026-11", type: null, category: null });

    expect(calls.filter((call) => call.method === "eq").map((call) => call.args[0])).toEqual(["business_id"]);
  });

  it("says when the month has more entries than one page holds", async () => {
    const row = {
      id: "x", type: "income", category: "sales", amount_cents: 100, entry_date: "2026-11-01",
      note: null, created_at: "2026-11-01T00:00:00Z", client_id: null,
    };
    const { db } = fakeDb(() => ({ data: Array.from({ length: 1000 }, () => row) }));
    const result = await new EntryRepository(db).listMonth("shop-1", { month: "2026-11", type: null, category: null });

    expect(result.truncated).toBe(true);
    expect(result.entries[0]).toMatchObject({ id: "x", amountCents: 100, clientId: null });
  });
});

describe("EntryRepository.update and delete", () => {
  it("update reports whether a row was really changed (RLS hides rows instead of failing)", async () => {
    const changed = fakeDb(() => ({ data: [{ id: "e1" }] }));
    expect(await new EntryRepository(changed.db).update("e1", fields)).toBe(true);

    const hidden = fakeDb(() => ({ data: [] }));
    expect(await new EntryRepository(hidden.db).update("e1", fields)).toBe(false);
  });

  it("delete reports whether a row was really deleted", async () => {
    expect(await new EntryRepository(fakeDb(() => ({ data: [{ id: "e1" }] })).db).delete("e1")).toBe(true);
    expect(await new EntryRepository(fakeDb(() => ({ data: [] })).db).delete("e1")).toBe(false);
  });

  it("update sends only the editable columns", async () => {
    const { db, calls } = fakeDb(() => ({ data: [{ id: "e1" }] }));
    await new EntryRepository(db).update("e1", { ...fields, note: "fixed" });

    expect(calls[0]).toEqual({
      method: "update",
      args: [{ type: "income", category: "sales", amount_cents: 2_500_000, entry_date: "2026-11-21", note: "fixed" }],
    });
  });
});
