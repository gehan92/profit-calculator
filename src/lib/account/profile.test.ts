import { describe, expect, it } from "vitest";
import {
  formatDateAs,
  isDateFormat,
  isReminderTime,
  notificationsSchema,
  PROFILE_NAME_MAX_LENGTH,
  profileNameSchema,
  regionSchema,
} from "./profile";

describe("profileNameSchema", () => {
  it("trims the name", () => {
    expect(profileNameSchema.parse("  Kamala Perera  ")).toBe("Kamala Perera");
  });

  it("turns an empty or blank name into null (no name)", () => {
    expect(profileNameSchema.parse("")).toBeNull();
    expect(profileNameSchema.parse("   ")).toBeNull();
  });

  it("allows exactly 80 letters and refuses 81", () => {
    expect(profileNameSchema.parse("a".repeat(PROFILE_NAME_MAX_LENGTH))).toHaveLength(PROFILE_NAME_MAX_LENGTH);
    expect(profileNameSchema.safeParse("a".repeat(PROFILE_NAME_MAX_LENGTH + 1)).success).toBe(false);
  });

  it("counts letters after trimming, so spaces around a long name do not matter", () => {
    expect(profileNameSchema.safeParse(` ${"a".repeat(PROFILE_NAME_MAX_LENGTH)} `).success).toBe(true);
  });

  it("refuses something that is not text", () => {
    expect(profileNameSchema.safeParse(42).success).toBe(false);
    expect(profileNameSchema.safeParse(null).success).toBe(false);
  });
});

describe("date format", () => {
  it("knows the three formats", () => {
    expect(isDateFormat("ymd")).toBe(true);
    expect(isDateFormat("dmy")).toBe(true);
    expect(isDateFormat("mdy")).toBe(true);
    expect(isDateFormat("banana")).toBe(false);
    expect(isDateFormat(undefined)).toBe(false);
  });

  it("writes a date each way", () => {
    expect(formatDateAs("2026-11-23", "ymd")).toBe("2026-11-23");
    expect(formatDateAs("2026-11-23", "dmy")).toBe("23/11/2026");
    expect(formatDateAs("2026-11-23", "mdy")).toBe("11/23/2026");
  });

  it("keeps the leading zeros", () => {
    expect(formatDateAs("2026-01-05", "dmy")).toBe("05/01/2026");
    expect(formatDateAs("2026-01-05", "mdy")).toBe("01/05/2026");
  });

  it("returns something that is not a real date unchanged", () => {
    expect(formatDateAs("2026-02-30", "dmy")).toBe("2026-02-30");
    expect(formatDateAs("", "dmy")).toBe("");
    expect(formatDateAs("yesterday", "mdy")).toBe("yesterday");
  });
});

describe("regionSchema", () => {
  const valid = { locale: "si", dateFormat: "dmy", defaultCurrency: "LKR" };

  it("accepts a language, a date format and a currency", () => {
    expect(regionSchema.parse(valid)).toEqual(valid);
  });

  it("accepts 'ask me each time' (no default currency)", () => {
    expect(regionSchema.parse({ ...valid, defaultCurrency: null }).defaultCurrency).toBeNull();
  });

  it("refuses a language we do not offer yet", () => {
    expect(regionSchema.safeParse({ ...valid, locale: "hi" }).success).toBe(false);
  });

  it("refuses an unknown date format or currency", () => {
    expect(regionSchema.safeParse({ ...valid, dateFormat: "banana" }).success).toBe(false);
    expect(regionSchema.safeParse({ ...valid, defaultCurrency: "XXX" }).success).toBe(false);
  });
});

describe("notifications", () => {
  it.each(["00:00", "07:30", "20:00", "23:59"])("%s is a time of day", (time) => {
    expect(isReminderTime(time)).toBe(true);
  });

  it.each(["", "7:30", "24:00", "07:60", "07:30:00", "ab:cd", "0730"])("%j is not", (time) => {
    expect(isReminderTime(time)).toBe(false);
  });

  it("accepts a full set of choices", () => {
    const choices = { daily: true, dailyTime: "07:30", weekly: false, payments: true };
    expect(notificationsSchema.parse(choices)).toEqual(choices);
  });

  it("refuses a bad time or a missing choice", () => {
    expect(notificationsSchema.safeParse({ daily: true, dailyTime: "25:00", weekly: false, payments: true }).success).toBe(false);
    expect(notificationsSchema.safeParse({ daily: true, dailyTime: "07:30", weekly: false }).success).toBe(false);
  });
});
