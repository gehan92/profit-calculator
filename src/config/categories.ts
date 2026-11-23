import type { BusinessType } from "@/lib/business/business-types";

/**
 * The default income and expense categories (Part D9), defined once.
 *
 * Every shop gets its own copy of these in the database (`categories`, by
 * business type, migration 0007) and can then add, rename, hide and reorder.
 * This list mirrors the database defaults for two jobs the database cannot do:
 * the guest "My Business (try)" (no account, no database) and a first check of
 * a category key before it is sent. `config/categories.test.ts` fails if it
 * ever drifts from the SQL.
 *
 * Never rename a key; labels come from `messages/*.json` → "categories".
 */

export type CategoryType = "income" | "expense" | "product";
export type EntryCategoryType = Exclude<CategoryType, "product">;

/** Whether a cost goes into "Real profit" only (Part D2 "Real profit"). */
export type CountsAs = "normal" | "hidden_cost";

export interface CategoryTemplate {
  key: string;
  type: CategoryType;
  /** An icon name from `components/category-icon.tsx`. */
  icon: string;
  /** A colour name from `components/category-icon.tsx`. */
  color: string;
  countsAs: CountsAs;
  /** Position in the picker. */
  sort: number;
  /** Which business types get it; `null` = all of them. */
  businessTypes: readonly BusinessType[] | null;
}

/** The default list, exactly as in migration 0007. */
export const CATEGORY_TEMPLATES: readonly CategoryTemplate[] = [
  { key: "sales", type: "income", icon: "shopping-cart", color: "green", countsAs: "normal", sort: 1, businessTypes: null },
  { key: "service_income", type: "income", icon: "tool", color: "green", countsAs: "normal", sort: 2, businessTypes: ["service", "transport"] },
  { key: "other_income", type: "income", icon: "plus", color: "green", countsAs: "normal", sort: 9, businessTypes: null },
  { key: "stock", type: "expense", icon: "package", color: "orange", countsAs: "normal", sort: 1, businessTypes: ["shop", "home"] },
  { key: "ingredients", type: "expense", icon: "chef-hat", color: "orange", countsAs: "normal", sort: 2, businessTypes: ["home"] },
  { key: "fuel", type: "expense", icon: "gas-station", color: "orange", countsAs: "normal", sort: 2, businessTypes: ["transport"] },
  { key: "rent", type: "expense", icon: "home", color: "blue", countsAs: "normal", sort: 3, businessTypes: null },
  { key: "salary", type: "expense", icon: "users", color: "blue", countsAs: "normal", sort: 4, businessTypes: null },
  { key: "electricity", type: "expense", icon: "bolt", color: "yellow", countsAs: "normal", sort: 5, businessTypes: null },
  { key: "water", type: "expense", icon: "droplet", color: "blue", countsAs: "normal", sort: 6, businessTypes: null },
  { key: "phone_internet", type: "expense", icon: "wifi", color: "purple", countsAs: "normal", sort: 7, businessTypes: null },
  { key: "repairs", type: "expense", icon: "tool", color: "gray", countsAs: "normal", sort: 8, businessTypes: null },
  { key: "transport", type: "expense", icon: "truck", color: "gray", countsAs: "hidden_cost", sort: 9, businessTypes: null },
  { key: "family_use", type: "expense", icon: "heart", color: "red", countsAs: "hidden_cost", sort: 10, businessTypes: null },
  { key: "owner_salary", type: "expense", icon: "user", color: "red", countsAs: "hidden_cost", sort: 11, businessTypes: null },
  { key: "wastage", type: "expense", icon: "trash", color: "red", countsAs: "hidden_cost", sort: 12, businessTypes: null },
  { key: "other", type: "expense", icon: "dots", color: "gray", countsAs: "normal", sort: 99, businessTypes: null },
  { key: "general", type: "product", icon: "box", color: "gray", countsAs: "normal", sort: 1, businessTypes: null },
] as const;

/** The default list for one business type (what a new shop of that type starts with). */
export function templatesFor(businessType: BusinessType | null, type?: CategoryType): CategoryTemplate[] {
  const kind = businessType ?? "shop";
  return CATEGORY_TEMPLATES.filter(
    (template) =>
      (type === undefined || template.type === type) &&
      (template.businessTypes === null || template.businessTypes.includes(kind)),
  ).toSorted((a, b) => a.sort - b.sort);
}

/** Every default key of one kind of entry (a first check of a key before it is sent). */
export function isDefaultKey(type: EntryCategoryType, key: string): boolean {
  return CATEGORY_TEMPLATES.some((template) => template.type === type && template.key === key);
}

/** Cost rows the profit calculator offers (Part D1), in display order. */
export const PROFIT_CALCULATOR_COSTS = ["stock", "rent", "salary", "electricity", "transport", "other"] as const;

export type ProfitCalculatorCost = (typeof PROFIT_CALCULATOR_COSTS)[number];
