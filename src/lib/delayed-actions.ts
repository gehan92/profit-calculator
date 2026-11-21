/**
 * Things that should happen a few seconds from now unless cancelled, such as
 * "delete this record in 5 seconds unless Undo is pressed" (Part D2).
 *
 * It lives outside React on purpose: leaving a screen must not cancel the
 * delete or run it in the middle of the page change (a Server Action started
 * during navigation fails). The timer simply keeps going, wherever the person
 * is in the app. Closing the browser tab drops pending items, which for a
 * delete is the safe outcome: the record stays.
 */
export class DelayedActions {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Runs `run` after `delayMs`, unless `cancel(key)` is called first. Scheduling the same key again restarts it. */
  schedule(key: string, delayMs: number, run: () => void): void {
    this.cancel(key);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        run();
      }, delayMs),
    );
  }

  /** Stops a waiting action. Returns `false` if there was none (it already ran, or never existed). */
  cancel(key: string): boolean {
    const timer = this.timers.get(key);
    if (timer === undefined) return false;
    clearTimeout(timer);
    this.timers.delete(key);
    return true;
  }

  has(key: string): boolean {
    return this.timers.has(key);
  }
}
