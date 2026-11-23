import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import type { IsoDate } from "@/lib/dates";
import { isIsoDate } from "@/lib/dates";
import { SUPPORTED_CURRENCIES } from "@/lib/money";

/**
 * What a person can set about THEMSELVES on the Account page (spec D6), and
 * the rules for it. Shared by the screens and the Server Actions, so both
 * refuse the same things.
 */

/** A person's name: at most 80 letters. Empty means "no name". */
export const PROFILE_NAME_MAX_LENGTH = 80;

export const profileNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().max(PROFILE_NAME_MAX_LENGTH))
  .transform((value) => (value === "" ? null : value));

// ------------------------------------------------------------------ date format

/** How dates are written in files: 2026-11-23, 23/11/2026 or 11/23/2026. */
export const DATE_FORMATS = ["ymd", "dmy", "mdy"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
export const DEFAULT_DATE_FORMAT: DateFormat = "ymd";

export function isDateFormat(value: unknown): value is DateFormat {
  return typeof value === "string" && (DATE_FORMATS as readonly string[]).includes(value);
}

/** "2026-11-23" written the chosen way. Anything that is not a real date is returned unchanged. */
export function formatDateAs(date: IsoDate, format: DateFormat): string {
  if (!isIsoDate(date)) return date;
  const [year, month, day] = date.split("-");
  if (format === "dmy") return `${day}/${month}/${year}`;
  if (format === "mdy") return `${month}/${day}/${year}`;
  return date;
}

// ----------------------------------------------------------------------- region

/** Language, date format and the currency pre-selected when making a shop (`null` = ask each time). */
export const regionSchema = z.object({
  locale: z.enum(LOCALES),
  dateFormat: z.enum(DATE_FORMATS),
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES).nullable(),
});
export type RegionSettings = z.infer<typeof regionSchema>;

// ---------------------------------------------------------------- notifications

const REMINDER_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "07:30" is a time of day; "7:30", "24:00" and "07:60" are not. */
export function isReminderTime(value: string): boolean {
  return REMINDER_TIME.test(value);
}

/** Daily reminder (and its time), weekly summary and payment emails. */
export const notificationsSchema = z.object({
  daily: z.boolean(),
  dailyTime: z.string().refine(isReminderTime),
  weekly: z.boolean(),
  payments: z.boolean(),
});
export type NotificationSettings = z.infer<typeof notificationsSchema>;

export const DEFAULT_REMINDER_TIME = "20:00";
