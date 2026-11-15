import { beforeEach, describe, expect, it } from "vitest";
import { BrowserStore } from "./browser-store";
import type { EntryFields } from "./entries/entry";
import { GuestEntryStore, GuestStoreFullError, MAX_GUEST_ENTRIES } from "./guest-store";

// Vitest runs in Node: there is no localStorage, so BrowserStore keeps values in memory.
const KEY = "test:guest";

const sale: EntryFields = {
  type: "income",
  category: "sales",
  amountCents: 2_500_000,
  entryDate: "2026-11-15",
  note: null,
};
const stock: EntryFields = { ...sale, type: "expense", category: "stock", amountCents: 1_500_000 };

let browser: BrowserStore;
let store: GuestEntryStore;

beforeEach(() => {
  browser = new BrowserStore();
  store = new GuestEntryStore(browser, KEY);
});

describe("GuestEntryStore", () => {
  it("starts empty", () => {
    expect(store.list()).toEqual([]);
  });

  it("adds entries with a unique clientId each", () => {
    const first = store.add(sale);
    const second = store.add(stock);

    expect(first.clientId).not.toBe(second.clientId);
    expect(first.clientId).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.list().map((entry) => entry.category)).toEqual(["sales", "stock"]);
  });

  it("returns the same array until something changes (useSyncExternalStore)", () => {
    store.add(sale);
    expect(store.list()).toBe(store.list());

    const before = store.list();
    store.add(stock);
    expect(store.list()).not.toBe(before);
  });

  it("tells subscribers about changes", () => {
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.add(sale);
    unsubscribe();
    store.add(stock);
    expect(calls).toBe(1);
  });

  it("removes an entry and puts it back in its old place (Undo)", () => {
    const first = store.add(sale, new Date("2026-11-15T08:00:00Z"));
    store.add(stock, new Date("2026-11-15T09:00:00Z"));

    const removed = store.remove(first.clientId);
    expect(removed).toEqual(first);
    expect(store.list()).toHaveLength(1);

    store.restore(first);
    store.restore(first); // a second Undo tap changes nothing
    expect(store.list().map((entry) => entry.clientId)[0]).toBe(first.clientId);
    expect(store.list()).toHaveLength(2);
  });

  it("removes only the moved entries, keeping ones added meanwhile", () => {
    const moved = store.add(sale);
    const addedLater = store.add(stock);

    store.removeMany([moved.clientId]);
    expect(store.list()).toEqual([addedLater]);

    store.removeMany([addedLater.clientId]);
    expect(store.list()).toEqual([]);
    expect(browser.read(KEY)).toBeNull();
  });

  it("skips broken records but keeps good ones", () => {
    const good = store.add(sale);
    browser.write(
      KEY,
      JSON.stringify([good, { ...good, clientId: "not-a-uuid" }, { hello: "world" }, null]),
    );
    expect(store.list()).toEqual([good]);
  });

  it("ignores data that is not a list", () => {
    browser.write(KEY, "{oops");
    expect(store.list()).toEqual([]);
    browser.write(KEY, JSON.stringify({ entries: [] }));
    expect(store.list()).toEqual([]);
  });

  it(`refuses more than ${MAX_GUEST_ENTRIES} entries`, () => {
    const full = Array.from({ length: MAX_GUEST_ENTRIES }, (_, i) => ({
      ...sale,
      clientId: crypto.randomUUID(),
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    }));
    browser.write(KEY, JSON.stringify(full));
    expect(() => store.add(sale)).toThrow(GuestStoreFullError);
  });
});
