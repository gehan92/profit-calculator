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
