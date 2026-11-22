import { IMPORT_BATCH_SIZE, type ClientEntry } from "@/lib/entries/entry";
import type { LocalEntryStore } from "@/lib/local-entry-store";

/**
 * What the server answers when the offline queue is sent (see the
 * `syncOfflineEntries` Server Action). Every entry is reported by `clientId`.
 */
export type SyncResult =
  | {
      ok: true;
      /** Stored now, or already stored by an earlier try. */
      saved: string[];
      /** Will never be accepted (not allowed, bad data): give up on these. */
      refused: string[];
      /** A temporary problem: keep these and try again later. */
      failed: string[];
    }
  | { ok: false; error: "invalid" | "notLoggedIn" | "notAllowed" | "tooMany" | "saveFailed" };

export type SyncState = "idle" | "sending" | "failed";

/** What one `run()` did, for the screen to tell the person. */
export interface SyncReport {
  saved: number;
  refused: number;
  failed: number;
  /** Set when the whole send failed: the server's reason, or "network" when it could not be reached. */
  error?: "network" | Extract<SyncResult, { ok: false }>["error"];
}

/**
 * Sends the offline queue to the server (Part F4.4: "saved to a local queue
 * with client_id; sent when back online").
 *
 * - One send at a time: a second `run()` while one is going returns `null`.
 * - An entry leaves the queue only after the server confirms it (`saved`), or
 *   says it will never accept it (`refused`), so a lost answer or a crash
 *   never loses an entry. The server stores each `client_id` once, so sending
 *   again never creates a duplicate.
 * - Sends at most `batchSize` entries per request; the caller runs again while
 *   entries remain.
 *
 * It holds its state outside React, so components just watch it with
 * `useSyncExternalStore`.
 */
export class OfflineSyncer {
  private state: SyncState = "idle";
  private running = false;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly queue: LocalEntryStore,
    private readonly send: (entries: ClientEntry[]) => Promise<SyncResult>,
    private readonly batchSize: number = IMPORT_BATCH_SIZE,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): SyncState => this.state;

  /** Sends the next batch. Returns `null` when nothing was sent (empty queue, or already sending). */
  async run(): Promise<SyncReport | null> {
    if (this.running) return null;
    const batch = this.queue.list().slice(0, this.batchSize);
    if (batch.length === 0) return null;

    this.running = true;
    this.setState("sending");
    try {
      const result = await this.send([...batch]).catch(() => null);

      if (result === null) {
        this.setState("failed");
        return { saved: 0, refused: 0, failed: batch.length, error: "network" };
      }
      if (!result.ok) {
        this.setState("failed");
        return { saved: 0, refused: 0, failed: batch.length, error: result.error };
      }

      this.queue.removeMany([...result.saved, ...result.refused]);
      this.setState(result.failed.length > 0 ? "failed" : "idle");
      return {
        saved: result.saved.length,
        refused: result.refused.length,
        failed: result.failed.length,
      };
    } finally {
      this.running = false;
    }
  }

  private setState(state: SyncState): void {
    if (this.state === state) return;
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}
