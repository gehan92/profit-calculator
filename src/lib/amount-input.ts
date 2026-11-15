/**
 * Helpers for number fields that people type into (Part D1 shared rules):
 * numbers 0 or more, up to 2 decimals, thousands separators while typing.
 *
 * Pure string functions, so they are easy to test and reuse in
 * MoneyInput, percent fields and quantity fields.
 */

export interface AmountInputOptions {
  /** How many digits are allowed after the dot. 0 = whole numbers only. */
  maxDecimals?: number;
  /** Add "," between thousands, e.g. 25000 → 25,000. */
  groupThousands?: boolean;
  /**
   * Longest whole part allowed. 12 digits (Rs 999,999,999,999) is far above any
   * small-business amount and keeps cents inside JavaScript's safe integer range.
   */
  maxWholeDigits?: number;
}

const DEFAULTS: Required<AmountInputOptions> = {
  maxDecimals: 2,
  groupThousands: true,
  maxWholeDigits: 12,
};

/**
 * Keeps only what a valid amount may contain.
 * "Rs 25,0a00.555" → "25000.55", "007" → "7", "." → "0.".
 */
export function cleanAmount(raw: string, options: AmountInputOptions = {}): string {
  const { maxDecimals, maxWholeDigits } = { ...DEFAULTS, ...options };

  const onlyDigitsAndDots = raw.replace(/[^\d.]/g, "");
  const firstDot = onlyDigitsAndDots.indexOf(".");
  const hasDot = firstDot !== -1 && maxDecimals > 0;

  const wholeDigits = hasDot
    ? onlyDigitsAndDots.slice(0, firstDot)
    : onlyDigitsAndDots.replace(/\./g, "");
  const decimalDigits = hasDot
    ? onlyDigitsAndDots.slice(firstDot + 1).replace(/\./g, "").slice(0, maxDecimals)
    : "";

  // Drop leading zeros ("007" → "7") but keep a single "0" ("0.5", "0").
  const whole = wholeDigits.replace(/^0+(?=\d)/, "").slice(0, maxWholeDigits);

  if (!hasDot) return whole;
  return `${whole || "0"}.${decimalDigits}`;
}

/** "25000.5" → "25,000.5". Expects a cleaned value. */
export function groupThousands(clean: string): string {
  const [whole, decimals] = clean.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals === undefined ? grouped : `${grouped}.${decimals}`;
}

/** What the field should show after the person types `raw`. */
export function formatAmountInput(raw: string, options: AmountInputOptions = {}): string {
  const settings = { ...DEFAULTS, ...options };
  const clean = cleanAmount(raw, settings);
  return settings.groupThousands ? groupThousands(clean) : clean;
}

/**
 * Where the cursor should go after formatting, so it does not jump
 * when commas are added or removed.
 *
 * Counts the digits and dots before the cursor in what was typed,
 * then puts the cursor after the same number of them in the new text.
 */
export function caretAfterFormat(raw: string, caret: number, formatted: string): number {
  const meaningfulBefore = raw.slice(0, caret).replace(/[^\d.]/g, "").length;
  if (meaningfulBefore === 0) return 0;

  let seen = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (/[\d.]/.test(formatted[index])) seen++;
    if (seen === meaningfulBefore) return index + 1;
  }
  return formatted.length;
}

/**
 * Reads a cleaned or formatted field as a number, e.g. "1,500.5" → 1500.5.
 * Empty input gives `null`, so the UI shows a hint instead of NaN.
 */
export function parseAmount(value: string): number | null {
  const clean = value.replace(/,/g, "");
  if (clean === "" || clean === ".") return null;
  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
}
