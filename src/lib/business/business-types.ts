/**
 * The kinds of business a shop owner can pick in shop setup (Part C1.7:
 * "Shop, Home business, Driver/transport, Service, Other"). The codes are the
 * ones the database accepts (`businesses.business_type`, migration 0005) and
 * the ones the default categories are listed for (migration 0007).
 */
export const BUSINESS_TYPES = ["shop", "home", "transport", "service", "other"] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** A shop that has not chosen yet is treated as a plain shop (same rule as the database). */
export const DEFAULT_BUSINESS_TYPE: BusinessType = "shop";

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value);
}

/** The stored value or, for shops made before the choice existed, the default. */
export function businessTypeOrDefault(value: string | null | undefined): BusinessType {
  return isBusinessType(value) ? value : DEFAULT_BUSINESS_TYPE;
}
