import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DelayedActions } from "./delayed-actions";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("DelayedActions", () => {
  it("runs the action after the delay, not before", () => {
    const actions = new DelayedActions();
    const run = vi.fn();
    actions.schedule("a", 5000, run);

    vi.advanceTimersByTime(4999);
    expect(run).not.toHaveBeenCalled();
    expect(actions.has("a")).toBe(true);

    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(actions.has("a")).toBe(false);
  });

  it("does not run a cancelled action (Undo)", () => {
    const actions = new DelayedActions();
    const run = vi.fn();
    actions.schedule("a", 5000, run);

    expect(actions.cancel("a")).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(run).not.toHaveBeenCalled();
  });

  it("says when there is nothing to cancel (already ran)", () => {
    const actions = new DelayedActions();
    actions.schedule("a", 1000, () => {});
    vi.advanceTimersByTime(1000);

    expect(actions.cancel("a")).toBe(false);
    expect(actions.cancel("never-existed")).toBe(false);
  });

  it("keeps different keys apart", () => {
    const actions = new DelayedActions();
    const a = vi.fn();
    const b = vi.fn();
    actions.schedule("a", 1000, a);
    actions.schedule("b", 1000, b);

    actions.cancel("a");
    vi.advanceTimersByTime(1000);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("scheduling the same key again restarts it and runs only the new action", () => {
    const actions = new DelayedActions();
    const first = vi.fn();
    const second = vi.fn();
    actions.schedule("a", 5000, first);
    vi.advanceTimersByTime(3000);
    actions.schedule("a", 5000, second);

    vi.advanceTimersByTime(4999);
    expect(second).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
