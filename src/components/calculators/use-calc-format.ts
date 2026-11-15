"use client";

import { useFormatter, useLocale } from "next-intl";
import { useMemo } from "react";
import { DEFAULT_CURRENCY, Money, type CurrencyCode } from "@/lib/money";

/**
 * Formatting used by every calculator, in the current language:
 * - `symbol`: the input prefix, e.g. "Rs"
 * - `money(cents)`: "Rs 8,500" (".00" hidden on result cards, Part E2)
 * - `percent(34)`: "34%", `percent(22.727)`: "22.7%"
 */
export function useCalcFormat(currency: CurrencyCode = DEFAULT_CURRENCY) {
  const locale = useLocale();
  const format = useFormatter();

  return useMemo(
    () => ({
      symbol: Money.symbol(locale, currency),
      // A result too big to count exactly (e.g. a huge quantity) shows "—" instead of crashing.
      money: (cents: number) =>
        Number.isSafeInteger(cents)
          ? Money.fromCents(cents, currency).format(locale, { trimZeroCents: true })
          : "—",
      percent: (pct: number) =>
        format.number(pct / 100, { style: "percent", maximumFractionDigits: 1 }),
    }),
    [locale, currency, format],
  );
}
