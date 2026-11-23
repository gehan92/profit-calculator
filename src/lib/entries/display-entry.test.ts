import { describe, expect, it } from "vitest";
import { mergeQueuedEntries } from "./display-entry";
import type { ClientEntry, StoredEntry } from "./entry";

const stored = (id: string, clientId: string | null): StoredEntry => ({
  id,
  clientId,
  type: "income",
  category: "sales",
  amountCents: 100_000,
  entryDate: "2026-11-15",
  note: null,
  productId: null,
  quantity: null,
  createdAt: "2026-11-15T09:00:00.000Z",
});

const queued = (clientId: string): ClientEntry => ({
  clientId,
  type: "expense",
  category: "stock",
  amountCents: 50_000,
  entryDate: "2026-11-15",
  note: "offline",
  productId: null,
  quantity: null,
  createdAt: "2026-11-15T10:00:00.000Z",
});

describe("mergeQueuedEntries", () => {
  it("shows saved entries as saved and queued ones as waiting", () => {
    const rows = mergeQueuedEntries([stored("a", null)], [queued("11111111-1111-4111-8111-111111111111")]);

    expect(rows.map((row) => [row.key, row.id, row.pending])).toEqual([
      ["a", "a", false],
      ["11111111-1111-4111-8111-111111111111", null, true],
    ]);
    expect(rows[1]).toMatchObject({ type: "expense", amountCents: 50_000, note: "offline" });
  });

  it("shows an entry once when it is both saved and still queued", () => {
    const clientId = "22222222-2222-4222-8222-222222222222";
    const rows = mergeQueuedEntries([stored("a", clientId)], [queued(clientId)]);

    expect(rows).toHaveLength(1);
    expect(rows[0].pending).toBe(false);
  });

  it("works with nothing queued, or nothing saved", () => {
    expect(mergeQueuedEntries([stored("a", null)], [])).toHaveLength(1);
    expect(mergeQueuedEntries([], [queued("33333333-3333-4333-8333-333333333333")])).toHaveLength(1);
    expect(mergeQueuedEntries([], [])).toEqual([]);
  });

  it("keeps the product and quantity of saved and waiting entries, so lists can show them", () => {
    const withProduct = { ...stored("p", null), productId: "5d0d1c2e-6b3f-4f1c-8a21-7a9e3b1c4d55", quantity: 3 };
    const waiting = { ...queued("22222222-2222-4222-8222-222222222222"), productId: "5d0d1c2e-6b3f-4f1c-8a21-7a9e3b1c4d55", quantity: 1.5 };
    const rows = mergeQueuedEntries([withProduct], [waiting]);
    expect(rows.map((row) => [row.productId, row.quantity])).toEqual([
      ["5d0d1c2e-6b3f-4f1c-8a21-7a9e3b1c4d55", 3],
      ["5d0d1c2e-6b3f-4f1c-8a21-7a9e3b1c4d55", 1.5],
    ]);
  });
});
