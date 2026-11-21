import { describe, expect, it } from "vitest";
import { isSupportAccessActive, SUPPORT_ACCESS_DAYS, supportAccessEnd } from "./support-access";

describe("support access", () => {
  const now = new Date("2026-11-21T10:00:00.000Z");

  it("lasts 7 days", () => {
    expect(SUPPORT_ACCESS_DAYS).toBe(7);
    expect(supportAccessEnd(now).toISOString()).toBe("2026-11-28T10:00:00.000Z");
  });

  it("is on until the end time and off after it", () => {
    expect(isSupportAccessActive("2026-11-28T10:00:00.000Z", now)).toBe(true);
    expect(isSupportAccessActive("2026-11-21T10:00:00.001Z", now)).toBe(true);
    expect(isSupportAccessActive("2026-11-21T10:00:00.000Z", now)).toBe(false);
    expect(isSupportAccessActive("2026-11-01T00:00:00.000Z", now)).toBe(false);
  });

  it("is off when never switched on or when the stored value is not a date", () => {
    expect(isSupportAccessActive(null, now)).toBe(false);
    expect(isSupportAccessActive("", now)).toBe(false);
    expect(isSupportAccessActive("not a date", now)).toBe(false);
  });
});
