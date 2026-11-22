import { describe, expect, it } from "vitest";
import { formatAdminDate, formatAdminDateTime, formatCount, formatDayMonth, formatWeekdayDayMonth } from "./format";

describe("admin date formats", () => {
  it("writes a date and a time in Sri Lanka time (UTC+5:30)", () => {
    // 20:00 UTC on 21 Nov is 01:30 on 22 Nov in Sri Lanka.
    expect(formatAdminDateTime("2026-11-21T20:00:00.000Z")).toBe("22 Nov 2026, 01:30");
    expect(formatAdminDate("2026-11-21T20:00:00.000Z")).toBe("22 Nov 2026");
    expect(formatAdminDateTime("2026-11-21T03:05:00Z")).toBe("21 Nov 2026, 08:35");
  });

  it("shows a dash when there is nothing to show", () => {
    expect(formatAdminDate(null)).toBe("—");
    expect(formatAdminDateTime(null)).toBe("—");
  });

  it("writes a calendar day without shifting it", () => {
    expect(formatDayMonth("2026-11-21")).toBe("21 Nov");
    expect(formatDayMonth("2026-01-01")).toBe("1 Jan");
    expect(formatWeekdayDayMonth("2026-11-21")).toBe("Sat 21 Nov");
  });

  it("groups thousands", () => {
    expect(formatCount(1240)).toBe("1,240");
    expect(formatCount(0)).toBe("0");
  });
});
