/**
 * Income and expense categories (Part D2), defined once.
 *
 * These keys are stored in the database (`entries.category`).
 * Never rename a key; labels come from `messages/*.json` → "categories".
 */
export const EXPENSE_CATEGORIES = [
  "stock",
  "rent",
  "salary",
  "electricity",
  "water",
  "transport",
  "family_use",
  "owner_salary",
  "wastage",
  "other",
] as const;

export const INCOME_CATEGORIES = ["sales", "other_income"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type Category = ExpenseCategory | IncomeCategory;

/** Cost rows the profit calculator offers (Part D1), in display order. */
export const PROFIT_CALCULATOR_COSTS = [
  "stock",
  "rent",
  "salary",
  "electricity",
  "transport",
  "other",
] as const satisfies readonly ExpenseCategory[];

export type ProfitCalculatorCost = (typeof PROFIT_CALCULATOR_COSTS)[number];

/**
 * Costs owners forget (Part A2, Part D2 "Real profit"): goods the family
 * takes, the owner's own pay, spoiled stock and transport.
 *
 * They are kept OUT of "Expenses" and "Profit" (the cash profit) and only
 * subtracted in the "Real profit" card. That way no amount is counted twice:
 * cash profit 110,000 − hidden costs 38,000 = real profit 72,000.
 * Display order of the Real profit card.
 */
export const HIDDEN_COST_CATEGORIES = [
  "family_use",
  "owner_salary",
  "wastage",
  "transport",
] as const satisfies readonly ExpenseCategory[];

export type HiddenCostCategory = (typeof HIDDEN_COST_CATEGORIES)[number];

export function isHiddenCost(category: Category): category is HiddenCostCategory {
  return (HIDDEN_COST_CATEGORIES as readonly string[]).includes(category);
}
