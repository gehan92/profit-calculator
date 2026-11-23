import { describe, expect, it } from "vitest";
import { formatQuantity, isQuantityInput, parseQuantity, quantityStep, stepQuantity } from "./quantity";

describe("parseQuantity", () => {
  it("reads whole numbers and up to 3 decimals, with a comma as the decimal point", () => {
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity("1.5")).toBe(1.5);
    expect(parseQuantity("0,25")).toBe(0.25);
    expect(parseQuantity(" 2.125 ")).toBe(2.125);
  });

  it("refuses 0, empty, letters, a fourth decimal and anything above the limit", () => {
    for (const bad of ["", "0", "0.000", "abc", "1.2345", "-1", "1e3", "1.2.3", "1000000"]) expect(parseQuantity(bad)).toBeNull();
  });
});

describe("isQuantityInput (what may be typed)", () => {
  it("allows an empty box, a lone point and partial numbers while typing", () => {
    for (const ok of ["", "1", "12", "1.", "1.5", ".5", "0,5"]) expect(isQuantityInput(ok)).toBe(true);
  });

  it("rejects letters, a minus sign and too many decimals", () => {
    for (const bad of ["a", "-1", "1.2345", "1,2,3", "12345678"]) expect(isQuantityInput(bad)).toBe(false);
  });
});

describe("formatQuantity", () => {
  it("never shows trailing zeros", () => {
    expect(formatQuantity(3)).toBe("3");
    expect(formatQuantity(1.5)).toBe("1.5");
    expect(formatQuantity(2.1250001)).toBe("2.125");
  });
});

describe("the − and + buttons", () => {
  it("count whole items by 1, weights and volumes in smaller or bigger steps", () => {
    expect(quantityStep("piece")).toBe(1);
    expect(quantityStep("kg")).toBe(0.5);
    expect(quantityStep("g")).toBe(100);
  });

  it("step from the current quantity, and start from one step when the box is empty", () => {
    expect(stepQuantity(3, "piece", 1)).toBe(4);
    expect(stepQuantity(null, "piece", 1)).toBe(1);
    expect(stepQuantity(1.5, "kg", 1)).toBe(2);
    expect(stepQuantity(0.1 + 0.2, "kg", -1)).toBe(0.5);
  });

  it("never go below one step", () => {
    expect(stepQuantity(1, "piece", -1)).toBe(1);
    expect(stepQuantity(0.5, "kg", -1)).toBe(0.5);
    expect(stepQuantity(null, "g", -1)).toBe(100);
  });
});
