"use client";

import { useTranslations } from "next-intl";
import { dateParts, type IsoDate } from "@/lib/dates";

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type WeekdayNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Dates written in words, in the person's language: "Saturday, November 21",
 * "Sat, Nov 21", "November 2026".
 *
 * The month and weekday names and the word order come from messages/*.json
 * ("dates"), not from the browser's `Intl`. Some browsers (for example desktop
 * Chrome) have no Sinhala date data and would print English names while the
 * server printed Sinhala, which breaks the page. Names from our own messages
 * read the same on the server and on every phone.
 */
export function useDateLabels() {
  const t = useTranslations("dates");

  const monthName = (month: number) => t(`months.${month as MonthNumber}`);
  const monthShortName = (month: number) => t(`monthsShort.${month as MonthNumber}`);

  return {
    /** "2026-11" → "November 2026". */
    monthYear(month: string): string {
      const [year, number] = month.split("-").map(Number);
      return t("pattern.monthYear", { month: monthName(number), year });
    },

    /** "2026-10" → "Oct". */
    monthShort(month: string): string {
      return monthShortName(Number(month.slice(5, 7)));
    },

    /** "2026-11-21" → "Saturday, November 21". */
    longDay(date: IsoDate): string {
      const { month, day, weekday } = dateParts(date);
      return t("pattern.longDay", {
        weekday: t(`weekdays.${weekday as WeekdayNumber}`),
        month: monthName(month),
        day,
      });
    },

    /** "2026-11-21" → "Sat, Nov 21", or "Sat, Nov 21, 2026" with `withYear`. */
    shortDay(date: IsoDate, withYear = false): string {
      const { year, month, day, weekday } = dateParts(date);
      return t(withYear ? "pattern.shortDayYear" : "pattern.shortDay", {
        weekday: t(`weekdaysShort.${weekday as WeekdayNumber}`),
        month: monthShortName(month),
        day,
        year,
      });
    },

    /** "2026-11-21" → "November 21, 2026". */
    dayMonthYear(date: IsoDate): string {
      const { year, month, day } = dateParts(date);
      return t("pattern.dayMonthYear", { month: monthName(month), day, year });
    },
  };
}
