/**
 * All calculator maths (Part D1, code from Part F4.1).
 *
 * Rules for this file:
 * - Money is always whole cents (integers), never rupees with decimals.
 * - Percent is a plain number: 34 means 34%.
 * - Pure functions only: no React, no formatting, no browser APIs.
 *   That keeps every formula easy to unit test (see calc.test.ts).
 */

// ------------------------------------------------------------------ profit

export interface ProfitResult {
  profitCents: number;
  /** Sum of all costs. */
  costsCents: number;
  /** Profit ÷ Sales × 100. `null` when sales are 0 (no % without sales). */
  pct: number | null;
  isLoss: boolean;
}

/** Profit = Sales − Σ costs. Profit % = Profit ÷ Sales × 100 (only if Sales > 0). */
export function profit(salesCents: number, costsCents: readonly number[]): ProfitResult {
  const costs = costsCents.reduce((total, cost) => total + cost, 0);
  const profitCents = salesCents - costs;
  const pct = salesCents > 0 ? (profitCents / salesCents) * 100 : null;
  return { profitCents, costsCents: costs, pct, isLoss: profitCents < 0 };
}

/**
 * The cost that takes the biggest part of sales, for the profit page tip
 * ("Stock is 60% of your sales", Part D1 extra outputs).
 * Returns `null` when there are no sales or no costs.
 */
export function biggestCost<Key extends string>(
  salesCents: number,
  costs: readonly { key: Key; cents: number }[],
): { key: Key; pctOfSales: number } | null {
  if (salesCents <= 0) return null;

  const largest = costs.reduce<{ key: Key; cents: number } | null>(
    (best, cost) => (cost.cents > (best?.cents ?? 0) ? cost : best),
    null,
  );

  return largest ? { key: largest.key, pctOfSales: (largest.cents / salesCents) * 100 } : null;
}

// ------------------------------------------------------------------ margin

export interface MarginResult {
  /** Price − Cost for one item. */
  perItemCents: number;
  /** Per item × quantity. */
  totalCents: number;
  /** (Price − Cost) ÷ Price × 100. `null` when the price is 0. */
  marginPct: number | null;
  /** (Price − Cost) ÷ Cost × 100. `null` when the cost is 0. */
  markupPct: number | null;
}

export function margin(costCents: number, priceCents: number, qty = 1): MarginResult {
  const perItem = priceCents - costCents;
  return {
    perItemCents: perItem,
    totalCents: perItem * qty,
    marginPct: priceCents > 0 ? (perItem / priceCents) * 100 : null,
    markupPct: costCents > 0 ? (perItem / costCents) * 100 : null,
  };
}

// ----------------------------------------------------------- selling price

/**
 * markup: the % is added on top of the cost.
 * margin: the % is the share of the final price that is profit.
 */
export type PriceMode = "markup" | "margin";

/** Round the price up to the next Rs 5 (500 cents) or Rs 10 (1000 cents); 0 = no rounding. */
export type RoundTo = 0 | 500 | 1000;

/** Thrown when margin mode gets 100% or more (the price would be infinite). */
export class MarginTooHighError extends Error {
  constructor() {
    super("margin_too_high");
    this.name = "MarginTooHighError";
  }
}

/**
 * Markup: Price = Cost × (1 + p ÷ 100).
 * Margin: Price = Cost ÷ (1 − p ÷ 100), only for p < 100.
 */
export function sellingPrice(
  costCents: number,
  pct: number,
  mode: PriceMode = "markup",
  roundTo: RoundTo = 0,
): number {
  if (mode === "margin" && pct >= 100) throw new MarginTooHighError();

  let price = mode === "markup" ? costCents * (1 + pct / 100) : costCents / (1 - pct / 100);
  price = Math.round(price);
  if (roundTo) price = Math.ceil(price / roundTo) * roundTo;
  return price;
}

// -------------------------------------------------------------- break-even

/** A month has 26 open days by default (Part D1). */
export const DEFAULT_OPEN_DAYS = 26;

export interface BreakEvenResult {
  /** Sales needed each month to cover the fixed costs. */
  monthlyCents: number;
  /** Monthly ÷ open days. */
  dailyCents: number;
}

/**
 * Monthly = Fixed ÷ (Margin% ÷ 100). Daily = Monthly ÷ Days.
 * Returns `null` when the margin is 0 or less: with no margin you never break even.
 */
export function breakEven(
  fixedCents: number,
  marginPct: number,
  openDays = DEFAULT_OPEN_DAYS,
): BreakEvenResult | null {
  if (marginPct <= 0) return null;
  const monthly = Math.round(fixedCents / (marginPct / 100));
  return { monthlyCents: monthly, dailyCents: Math.round(monthly / openDays) };
}
