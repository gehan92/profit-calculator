"use client";

import { useDateLabels } from "@/components/use-date-labels";
import { useIsBrowser } from "@/components/use-is-browser";
import { localIsoDate } from "@/lib/dates";

/**
 * A moment (an ISO time from the database) written in the person's own
 * timezone: "November 23, 2026, 14:05". Only the phone knows its timezone, so
 * the text appears once the page is in the browser; until then the element
 * is empty, which keeps the server's and the phone's first HTML identical.
 */
export function LocalDateTime({ iso, withTime = true }: { iso: string; withTime?: boolean }) {
  const dates = useDateLabels();
  const browser = useIsBrowser();
  if (!browser) return <time dateTime={iso} />;

  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return <time dateTime={iso} />;

  const day = dates.dayMonthYear(localIsoDate(moment));
  const time = `${String(moment.getHours()).padStart(2, "0")}:${String(moment.getMinutes()).padStart(2, "0")}`;
  return <time dateTime={iso}>{withTime ? `${day}, ${time}` : day}</time>;
}
