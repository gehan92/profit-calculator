import { describe, expect, it } from "vitest";
import { CurrencyMismatchError, Money } from "./money";

describe("Money.parse", () => {
  it.each([
    ["25,000", 2_500_000],
    ["25000", 2_500_000],
    ["1 500", 150_000],
    ["1500.5", 150_050],
    ["1500.05", 150_005],
    [".75", 75],
    ["0", 0],
  ])("reads %s as %i cents", (input, cents) => {
    expect(Money.parse(input)?.cents).toBe(cents);
  });

  it.each(["", ".", "-5", "abc", "12.345", "1.2.3", "Rs 100"])(
    "returns null for invalid input %j (never NaN)",
    (input) => {
      expect(Money.parse(input)).toBeNull();
    },
  );
});

describe("Money arithmetic", () => {
  it("adds and subtracts in cents without floating-point errors", () => {
    const a = Money.parse("0.10")!;
    const b = Money.parse("0.20")!;
    expect(a.add(b).cents).toBe(30);
    expect(b.subtract(a).cents).toBe(10);
  });

  it("sums a list of costs (Part A5 scenario 1)", () => {
    const costs = [Money.fromCents(1_500_000), Money.fromCents(150_000)];
    expect(Money.sum(costs).cents).toBe(1_650_000);
  });

  it("is immutable", () => {
    const original = Money.fromCents(100);
    original.add(Money.fromCents(50));
    expect(original.cents).toBe(100);
  });

  it("refuses to mix currencies", () => {
    expect(() => Money.fromCents(100, "LKR").add(Money.fromCents(100, "USD"))).toThrow(
      CurrencyMismatchError,
    );
  });

  it("refuses fractional cents", () => {
    expect(() => Money.fromCents(10.5)).toThrow(RangeError);
  });
});

describe("Money.format (Part F5 testing checklist)", () => {
  /** Intl puts a non-breaking space after the symbol so "Rs" never wraps away from the number. */
  const nbsp = (text: string) => text.replaceAll(" ", " ");
  const amount = Money.fromCents(2_500_000);

  it("formats English as Rs 25,000.00", () => {
    expect(amount.format("en")).toBe(nbsp("Rs 25,000.00"));
  });

  it("formats Sinhala with the Sinhala rupee sign", () => {
    expect(amount.format("si")).toBe(nbsp("රු. 25,000.00"));
  });

  it("formats Tamil with Rs", () => {
    expect(amount.format("ta")).toBe(nbsp("Rs 25,000.00"));
  });

  it("hides .00 on big cards but keeps real cents", () => {
    expect(Money.fromCents(850_000).format("en", { trimZeroCents: true })).toBe(nbsp("Rs 8,500"));
    expect(Money.fromCents(850_050).format("en", { trimZeroCents: true })).toBe(
      nbsp("Rs 8,500.50"),
    );
  });

  it("shows a loss with a minus sign", () => {
    expect(Money.fromCents(-320_000).format("en", { trimZeroCents: true })).toBe(
      nbsp("-Rs 3,200"),
    );
  });
});
