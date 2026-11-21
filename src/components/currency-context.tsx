"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";

const CurrencyContext = createContext<CurrencyCode>(DEFAULT_CURRENCY);

/**
 * Tells every amount below it which currency the shop uses (Part D2 Settings,
 * Part F3 `businesses.currency`). Dashboard pages wrap their content in it;
 * the free calculators and guest mode have no shop, so they show LKR.
 */
export function CurrencyProvider({
  currency,
  children,
}: {
  currency: CurrencyCode;
  children: ReactNode;
}) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

/** The shop's currency, or LKR outside a shop. */
export function useBusinessCurrency(): CurrencyCode {
  return useContext(CurrencyContext);
}
