/**
 * A small key/value store on top of `localStorage` that never breaks the page.
 *
 * `localStorage` can be missing or throw (private mode, blocked site data,
 * storage full). Every value is therefore also kept in memory for this visit,
 * so the calculators keep working even when nothing can be saved.
 *
 * Components subscribe to changes, which is what React's
 * `useSyncExternalStore` needs (see use-remembered-state.ts). Changes made
 * in another tab of the same site are picked up too.
 */
export class BrowserStore {
  private readonly memory = new Map<string, string | null>();
  private readonly listeners = new Set<() => void>();

  read(key: string): string | null {
    if (this.memory.has(key)) return this.memory.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /** Saves a value; `null` removes it. */
  write(key: string, value: string | null): void {
    this.memory.set(key, value);
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      // Not saved on this device, but still kept in memory for this visit.
    }
    this.notify();
  }

  subscribe = (listener: () => void): (() => void) => {
    if (this.listeners.size === 0 && typeof window !== "undefined") {
      window.addEventListener("storage", this.onOtherTabChange);
    }
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("storage", this.onOtherTabChange);
      }
    };
  };

  /** Another tab saved something: forget our copy and read it fresh. */
  private readonly onOtherTabChange = (event: StorageEvent) => {
    if (event.key === null) this.memory.clear();
    else this.memory.delete(event.key);
    this.notify();
  };

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

/** One shared store for the whole app. */
export const browserStore = new BrowserStore();
