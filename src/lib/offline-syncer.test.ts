import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserStore } from "./browser-store";
import type { EntryFields } from "./entries/entry";
import { LocalEntryStore } from "./local-entry-store";
import { OfflineSyncer, type SyncResult } from "./offline-syncer";

const sale: EntryFields = {
  type: "income",
  category: "sales",
  amountCents: 100_000,
  entryDate: "2026-11-21",
  note: null,
};

let queue: LocalEntryStore;

beforeEach(() => {
  queue = new LocalEntryStore(new BrowserStore(), { key: "test:queue", maxEntries: 50 });
});

function ids() {
  return queue.list().map((entry) => entry.clientId);
}

describe("OfflineSyncer.run", () => {
  it("does nothing when the queue is empty", async () => {
    const send = vi.fn();
    expect(await new OfflineSyncer(queue, send).run()).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the queue and forgets what the server saved", async () => {
    const a = queue.add(sale);
    const b = queue.add(sale);
    const send = vi.fn(async (): Promise<SyncResult> => ({
      ok: true, saved: [a.clientId, b.clientId], refused: [], failed: [],
    }));
    const syncer = new OfflineSyncer(queue, send);

    expect(await syncer.run()).toEqual({ saved: 2, refused: 0, failed: 0 });
    expect(send).toHaveBeenCalledWith([a, b]);
    expect(ids()).toEqual([]);
    expect(syncer.getState()).toBe("idle");
  });

  it("forgets refused entries too, so one bad entry cannot block the queue forever", async () => {
    const good = queue.add(sale);
    const bad = queue.add(sale);
    const syncer = new OfflineSyncer(queue, async () => ({
      ok: true, saved: [good.clientId], refused: [bad.clientId], failed: [],
    }));

    expect(await syncer.run()).toEqual({ saved: 1, refused: 1, failed: 0 });
    expect(ids()).toEqual([]);
  });

  it("keeps entries the server could not handle yet, and says it failed", async () => {
    const done = queue.add(sale);
    const later = queue.add(sale);
    const syncer = new OfflineSyncer(queue, async () => ({
      ok: true, saved: [done.clientId], refused: [], failed: [later.clientId],
    }));

    expect(await syncer.run()).toEqual({ saved: 1, refused: 0, failed: 1 });
    expect(ids()).toEqual([later.clientId]);
    expect(syncer.getState()).toBe("failed");
  });

  it("keeps everything when the server cannot be reached (no network)", async () => {
    queue.add(sale);
    const syncer = new OfflineSyncer(queue, () => Promise.reject(new Error("Failed to fetch")));

    expect(await syncer.run()).toEqual({ saved: 0, refused: 0, failed: 1, error: "network" });
    expect(ids()).toHaveLength(1);
    expect(syncer.getState()).toBe("failed");
  });

  it("keeps everything when the whole request is refused (e.g. logged out)", async () => {
    queue.add(sale);
    const syncer = new OfflineSyncer(queue, async () => ({ ok: false, error: "notLoggedIn" }));

    expect(await syncer.run()).toMatchObject({ error: "notLoggedIn" });
    expect(ids()).toHaveLength(1);
  });

  it("sends one request at a time", async () => {
    queue.add(sale);
    let finish: (value: SyncResult) => void = () => {};
    const send = vi.fn(() => new Promise<SyncResult>((resolve) => (finish = resolve)));
    const syncer = new OfflineSyncer(queue, send);

    const first = syncer.run();
    expect(await syncer.run()).toBeNull(); // second call while the first is waiting
    expect(syncer.getState()).toBe("sending");

    finish({ ok: true, saved: ids(), refused: [], failed: [] });
    await first;
    expect(send).toHaveBeenCalledTimes(1);
    expect(syncer.getState()).toBe("idle");
  });

  it("sends at most one batch per run, and the rest on the next run", async () => {
    for (let i = 0; i < 5; i++) queue.add(sale);
    const send = vi.fn(async (entries: { clientId: string }[]): Promise<SyncResult> => ({
      ok: true, saved: entries.map((entry) => entry.clientId), refused: [], failed: [],
    }));
    const syncer = new OfflineSyncer(queue, send, 2);

    await syncer.run();
    expect(send.mock.calls[0][0]).toHaveLength(2);
    expect(ids()).toHaveLength(3);
    await syncer.run();
    await syncer.run();
    expect(ids()).toHaveLength(0);
  });

  it("keeps entries added while a send was going", async () => {
    const first = queue.add(sale);
    let addedLater = "";
    const syncer = new OfflineSyncer(queue, async () => {
      addedLater = queue.add(sale).clientId; // another tab, mid-send
      return { ok: true, saved: [first.clientId], refused: [], failed: [] };
    });

    await syncer.run();
    expect(ids()).toEqual([addedLater]);
  });

  it("tells watchers when its state changes", async () => {
    const a = queue.add(sale);
    const states: string[] = [];
    const syncer = new OfflineSyncer(queue, async () => ({ ok: true, saved: [a.clientId], refused: [], failed: [] }));
    syncer.subscribe(() => states.push(syncer.getState()));

    await syncer.run();
    expect(states).toEqual(["sending", "idle"]);
  });
});
