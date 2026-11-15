/**
 * Calendar dates as "YYYY-MM-DD" strings, the same as the database `date`
 * type (`entries.entry_date`). They have no time and no timezone: an entry
 * belongs to the shop's day as the person sees it on their phone (Part F3).
 */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date such as "2026-11-15" (not "2026-02-30"). */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const [year, month, day] = match.slice(1).map(Number);
  const date = utcDate(year, month, day);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Today (or `now`) on this device's calendar, e.g. "2026-11-15". */
export function localIsoDate(now: Date = new Date()): IsoDate {
  return [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("-");
}

/** The UTC calendar date of `now`. Servers use it because they don't know the phone's timezone. */
export function utcIsoDate(now: Date = new Date()): IsoDate {
  return now.toISOString().slice(0, 10);
}

/** "2026-11-01" + -1 → "2026-10-31". */
export function addDays(date: IsoDate, days: number): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const moved = utcDate(year, month, day + days);
  return moved.toISOString().slice(0, 10);
}

/** "2026-11-15" → "2026-11" (the month an entry counts in). */
export function monthOf(date: IsoDate): string {
  return date.slice(0, 7);
}

/** A date at noon UTC, so formatting it in any timezone shows the same day. */
export function isoDateToDate(date: IsoDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function utcDate(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(2000, 0, 1));
  // setUTCFullYear keeps years below 100 as written (Date.UTC would add 1900).
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
