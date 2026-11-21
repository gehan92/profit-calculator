import { INTL_LOCALE, type AppLocale } from "@/i18n/config";
import { groupThousands } from "@/lib/amount-input";

/** ISO 4217 currency code, stored per business (default LKR). */
export type CurrencyCode = string;

export const DEFAULT_CURRENCY: CurrencyCode = "LKR";

export interface MoneyFormatOptions {
  /** Hide ".00" when the amount is whole, e.g. on big result cards (Part E2). */
  trimZeroCents?: boolean;
}

/** Thrown when two amounts in different currencies are combined. */
export class CurrencyMismatchError extends Error {
  constructor(left: CurrencyCode, right: CurrencyCode) {
    super(`Cannot combine ${left} with ${right}`);
    this.name = "CurrencyMismatchError";
  }
}

/**
 * An amount of money, stored as whole cents to avoid floating-point errors.
 *
 * Money is immutable: `add` and `subtract` return a new instance.
 * This matches the database, where every amount is a `bigint` of cents.
 *
 * @example
 *   const sales = Money.parse("25,000");          // 2_500_000 cents
 *   sales.format("en");                            // "Rs 25,000.00"
 */
export class Money {
  /** Up to 2 decimals, optional thousands separators: "25,000", "1500.5", ".75". */
  private static readonly INPUT_PATTERN = /^(\d*)(?:\.(\d{0,2}))?$/;

  private static readonly formatters = new Map<string, Intl.NumberFormat>();

  private constructor(
    readonly cents: number,
    readonly currency: CurrencyCode,
  ) {}

  // ---------------------------------------------------------------- creation

  static fromCents(cents: number, currency: CurrencyCode = DEFAULT_CURRENCY): Money {
    if (!Number.isSafeInteger(cents)) {
      throw new RangeError(`Money needs a whole number of cents, got ${cents}`);
    }
    return new Money(cents, currency);
  }

  static zero(currency: CurrencyCode = DEFAULT_CURRENCY): Money {
    return new Money(0, currency);
  }

  /**
   * Reads what a person typed into a money field.
   * Returns `null` for empty or invalid input (negative, letters, 3+ decimals),
   * so the UI can show a hint instead of NaN (Part D1 shared rules).
   */
  static parse(input: string, currency: CurrencyCode = DEFAULT_CURRENCY): Money | null {
    const cleaned = input.replace(/[,\s]/g, "");
    const match = Money.INPUT_PATTERN.exec(cleaned);
    if (!cleaned || cleaned === "." || !match) return null;

    const [, wholePart, fractionPart = ""] = match;
    const cents = Number(wholePart || "0") * 100 + Number(fractionPart.padEnd(2, "0"));

    return Number.isSafeInteger(cents) ? new Money(cents, currency) : null;
  }

  static sum(amounts: readonly Money[], currency: CurrencyCode = DEFAULT_CURRENCY): Money {
    return amounts.reduce((total, amount) => total.add(amount), Money.zero(currency));
  }

  // -------------------------------------------------------------- arithmetic

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.cents - other.cents, this.currency);
  }

  multiply(factor: number): Money {
    return Money.fromCents(Math.round(this.cents * factor), this.currency);
  }

  /** The amount without its sign, e.g. to show "Loss Rs 3,200" instead of "-Rs 3,200". */
  abs(): Money {
    return Money.fromCents(Math.abs(this.cents), this.currency);
  }

  // ------------------------------------------------------------------ checks

  get isZero(): boolean {
    return this.cents === 0;
  }

  get isNegative(): boolean {
    return this.cents < 0;
  }

  get isPositive(): boolean {
    return this.cents > 0;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  // -------------------------------------------------------------- formatting

  /** Amount in the main unit, e.g. 2_500_000 cents → 25000. For charts, not for maths. */
  toNumber(): number {
    return this.cents / 100;
  }

  /**
   * The amount as a person types it into a money field, e.g. 2_500_000 → "25,000"
   * and 150_050 → "1,500.50". For filling an edit form. Positive amounts only.
   */
  toInputString(): string {
    const whole = Math.floor(Math.abs(this.cents) / 100);
    const fraction = Math.abs(this.cents) % 100;
    const grouped = groupThousands(String(whole));
    return fraction === 0 ? grouped : `${grouped}.${String(fraction).padStart(2, "0")}`;
  }

  /** Display string in the user's language, e.g. "Rs 25,000.00", "රු. 25,000.00". */
  format(locale: AppLocale, options: MoneyFormatOptions = {}): string {
    const hideCents = options.trimZeroCents === true && this.cents % 100 === 0;
    const fixedSymbol = FIXED_SYMBOLS[this.currency]?.[locale];

    if (!fixedSymbol) {
      return Money.formatter(INTL_LOCALE[locale], this.currency, hideCents).format(this.toNumber());
    }

    const sign = this.isNegative ? "-" : "";
    const digits = Money.formatter(FIXED_NUMBER_LOCALE, null, hideCents).format(
      Math.abs(this.toNumber()),
    );
    // Non-breaking space, so "Rs" never wraps away from the number.
    return `${sign}${fixedSymbol} ${digits}`;
  }

  toString(): string {
    return `${this.toNumber().toFixed(2)} ${this.currency}`;
  }

  /** The currency sign shown before amounts, e.g. "Rs" (en), "රු." (si). Used as the input prefix. */
  static symbol(locale: AppLocale, currency: CurrencyCode = DEFAULT_CURRENCY): string {
    const fixedSymbol = FIXED_SYMBOLS[currency]?.[locale];
    if (fixedSymbol) return fixedSymbol;

    const parts = Money.formatter(INTL_LOCALE[locale], currency, true).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  }

  // ----------------------------------------------------------------- private

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  /**
   * Intl formatters are slow to create, so one is cached per locale/currency/style.
   * `currency: null` gives a plain number ("25,000.00") without a sign.
   */
  private static formatter(
    intlLocale: string,
    currency: CurrencyCode | null,
    hideCents: boolean,
  ): Intl.NumberFormat {
    const key = `${intlLocale}|${currency}|${hideCents}`;
    let formatter = Money.formatters.get(key);

    if (!formatter) {
      formatter = new Intl.NumberFormat(intlLocale, {
        ...(currency && {
          style: "currency",
          currency,
          // "Rs" instead of "LKR" in English, as in the document's examples.
          currencyDisplay: "narrowSymbol",
        }),
        minimumFractionDigits: hideCents ? 0 : 2,
        maximumFractionDigits: hideCents ? 0 : 2,
      });
      Money.formatters.set(key, formatter);
    }

    return formatter;
  }
}

/**
 * Currency signs we set ourselves instead of asking Intl.
 *
 * Browsers ship different language data: for Sinhala, Chrome prints "Rs" but
 * Node prints "රු.". The server and the phone must print exactly the same
 * text, otherwise React reports a hydration error and the page flickers.
 * Currencies not listed here (added when going global) still use Intl.
 */
const FIXED_SYMBOLS: Partial<Record<CurrencyCode, Record<AppLocale, string>>> = {
  LKR: { en: "Rs", si: "රු.", ta: "Rs" },
};

/** Sri Lanka writes amounts as 25,000.00 in English, Sinhala and Tamil alike. */
const FIXED_NUMBER_LOCALE = "en-LK";
