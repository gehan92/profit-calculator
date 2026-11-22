/**
 * Date and time text for the admin panel. It is English only and used by
 * Sri Lanka's admin, so times are shown in Sri Lanka time (the server and the
 * browser then print the same text, whatever the visitor's timezone).
 */
const TIME_ZONE = "Asia/Colombo";

const dateOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const weekdayDayMonth = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "21 Nov 2026". `—` when there is no date. */
export function formatAdminDate(iso: string | null): string {
  return iso ? dateOnly.format(new Date(iso)) : "—";
}

/** "21 Nov 2026, 14:05" in Sri Lanka time. `—` when there is no time. */
export function formatAdminDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

/** "21 Nov" for a calendar day written "2026-11-21" (the day itself, no timezone shift). */
export function formatDayMonth(day: string): string {
  return dayMonth.format(new Date(`${day}T12:00:00Z`));
}

/** "Sat 21 Nov" for a calendar day written "2026-11-21". */
export function formatWeekdayDayMonth(day: string): string {
  return weekdayDayMonth.format(new Date(`${day}T12:00:00Z`));
}

/** "1,240" for a count. */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}
