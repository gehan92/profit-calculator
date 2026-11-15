import { describe, expect, it } from "vitest";
import { addDays, isIsoDate, isoDateToDate, localIsoDate, monthOf, utcIsoDate } from "./dates";

describe("isIsoDate", () => {
  it.each(["2026-11-15", "2024-02-29", "2000-01-01"])("accepts %s", (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-1-5", "15/11/2026", "", "2026-11-15T00:00"])(
    "refuses %s",
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});

describe("localIsoDate", () => {
  it("uses the device's calendar, with leading zeros", () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("utcIsoDate", () => {
  it("uses the UTC calendar", () => {
    expect(utcIsoDate(new Date(Date.UTC(2026, 10, 15, 23, 30)))).toBe("2026-11-15");
  });
});

describe("addDays", () => {
  it("moves across months and years", () => {
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("monthOf and isoDateToDate", () => {
  it("returns the month part", () => {
    expect(monthOf("2026-11-15")).toBe("2026-11");
  });

  it("keeps the same calendar day", () => {
    expect(isoDateToDate("2026-11-15").toISOString()).toBe("2026-11-15T12:00:00.000Z");
  });
});
