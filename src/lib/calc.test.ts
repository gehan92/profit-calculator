import { describe, expect, it } from "vitest";
import { biggestCost, breakEven, MarginTooHighError, margin, profit, sellingPrice } from "./calc";

/**
 * Part D1 test examples ("must match exactly") and the Part F4.1 test list.
 * These must pass before any release.
 */

describe("profit", () => {
  it("D1: 25,000 − (15,000 + 1,500) = 8,500 (34.0%)", () => {
    const result = profit(2_500_000, [1_500_000, 150_000]);
    expect(result.profitCents).toBe(850_000);
    expect(result.costsCents).toBe(1_650_000);
    expect(result.pct?.toFixed(1)).toBe("34.0");
    expect(result.isLoss).toBe(false);
  });

  it("shows a loss when costs are higher than sales (Part A5 scenario 7)", () => {
    const result = profit(1_000_000, [1_320_000]);
    expect(result.profitCents).toBe(-320_000);
    expect(result.isLoss).toBe(true);
  });

  it("gives no % when sales are 0", () => {
    const result = profit(0, [50_000]);
    expect(result.profitCents).toBe(-50_000);
    expect(result.pct).toBeNull();
  });

  it("works with no cost rows", () => {
    expect(profit(100_000, []).profitCents).toBe(100_000);
  });

  it("is exact with cents: Rs 0.30 − (0.10 + 0.20) is exactly 0", () => {
    // With rupee decimals, 0.3 − (0.1 + 0.2) would give -5.55e-17.
    expect(profit(30, [10, 20]).profitCents).toBe(0);
  });
});

describe("biggestCost (profit tip)", () => {
  it("finds the cost with the biggest share of sales: stock is 60%", () => {
    const tip = biggestCost(2_500_000, [
      { key: "stock", cents: 1_500_000 },
      { key: "other", cents: 150_000 },
    ]);
    expect(tip).toEqual({ key: "stock", pctOfSales: 60 });
  });

  it("returns null without sales or without costs", () => {
    expect(biggestCost(0, [{ key: "stock", cents: 100 }])).toBeNull();
    expect(biggestCost(100, [])).toBeNull();
    expect(biggestCost(100, [{ key: "stock", cents: 0 }])).toBeNull();
  });
});

describe("margin", () => {
  it("D1: cost 85, price 110, qty 100 → 25 per item, margin 22.7%, markup 29.4%, total 2,500", () => {
    const result = margin(8_500, 11_000, 100);
    expect(result.perItemCents).toBe(2_500);
    expect(result.totalCents).toBe(250_000);
    expect(result.marginPct?.toFixed(1)).toBe("22.7");
    expect(result.markupPct?.toFixed(1)).toBe("29.4");
  });

  it("uses quantity 1 by default", () => {
    expect(margin(8_500, 10_000).totalCents).toBe(1_500);
  });

  it("A5 soap seller: cost 85, price 100 → Rs 15 (15%)", () => {
    const result = margin(8_500, 10_000);
    expect(result.perItemCents).toBe(1_500);
    expect(result.marginPct).toBe(15);
  });

  it("gives no margin % when the price is 0, and no markup % when the cost is 0", () => {
    expect(margin(8_500, 0).marginPct).toBeNull();
    expect(margin(0, 10_000).markupPct).toBeNull();
  });

  it("shows a loss per item when the price is below the cost", () => {
    expect(margin(10_000, 8_500, 10).totalCents).toBe(-15_000);
  });
});

describe("sellingPrice", () => {
  it("D1: cost 85, 20% markup → 102.00", () => {
    expect(sellingPrice(8_500, 20)).toBe(10_200);
  });

  it("D1: cost 85, 20% margin → 106.25", () => {
    expect(sellingPrice(8_500, 20, "margin")).toBe(10_625);
  });

  it("D1: round to 10 → 110", () => {
    expect(sellingPrice(8_500, 20, "markup", 1000)).toBe(11_000);
  });

  it("rounds up to the next 5", () => {
    expect(sellingPrice(8_500, 20, "markup", 500)).toBe(10_500);
  });

  it("does not change a price that is already round", () => {
    expect(sellingPrice(10_000, 0, "markup", 1000)).toBe(10_000);
  });

  it("D1: margin mode refuses 100% or more", () => {
    expect(() => sellingPrice(8_500, 100, "margin")).toThrow(MarginTooHighError);
    expect(() => sellingPrice(8_500, 150, "margin")).toThrow(MarginTooHighError);
  });

  it("markup mode allows 100% and more (double the cost)", () => {
    expect(sellingPrice(8_500, 100)).toBe(17_000);
  });
});

describe("breakEven", () => {
  it("D1: 60,000, 20%, 26 days → 300,000/month, 11,538/day", () => {
    const result = breakEven(6_000_000, 20, 26);
    expect(result?.monthlyCents).toBe(30_000_000);
    expect(Math.floor((result?.dailyCents ?? 0) / 100)).toBe(11_538);
  });

  it("uses 26 open days by default", () => {
    expect(breakEven(6_000_000, 20)?.dailyCents).toBe(1_153_846);
  });

  it("returns null when the margin is 0 or negative", () => {
    expect(breakEven(6_000_000, 0)).toBeNull();
    expect(breakEven(6_000_000, -5)).toBeNull();
  });
});
