/**
 * The four free calculators (Part D1), defined once.
 * The home page, navigation, footer and sitemap all read from this list,
 * so adding a calculator later (VAT, discount, EMI...) is one new entry.
 */
export type CalculatorId = "profit" | "margin" | "price" | "breakEven";

export interface CalculatorDefinition {
  id: CalculatorId;
  /** URL path without the language prefix. Kept stable for SEO. */
  href: `/${string}`;
}

export const CALCULATORS: readonly CalculatorDefinition[] = [
  { id: "profit", href: "/profit-calculator" },
  { id: "margin", href: "/margin-calculator" },
  { id: "price", href: "/selling-price-calculator" },
  { id: "breakEven", href: "/break-even-calculator" },
];

export function getCalculator(id: CalculatorId): CalculatorDefinition {
  const calculator = CALCULATORS.find((item) => item.id === id);
  if (!calculator) throw new Error(`Unknown calculator: ${id}`);
  return calculator;
}
