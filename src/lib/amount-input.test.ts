import { describe, expect, it } from "vitest";
import { caretAfterFormat, cleanAmount, formatAmountInput, parseAmount } from "./amount-input";

describe("formatAmountInput", () => {
  it.each([
    ["25000", "25,000"],
    ["1500000", "1,500,000"],
    ["25,000", "25,000"],
    ["1500.5", "1,500.5"],
    ["1500.", "1,500."],
    [".5", "0.5"],
    ["007", "7"],
    ["0", "0"],
    ["", ""],
    ["12.345", "12.34"],
    ["1.2.3", "1.23"],
    ["Rs 2a5", "25"],
    ["-50", "50"],
  ])("%j → %j", (typed, shown) => {
    expect(formatAmountInput(typed)).toBe(shown);
  });

  it("allows whole numbers only when maxDecimals is 0 (quantity)", () => {
    expect(formatAmountInput("12.5", { maxDecimals: 0 })).toBe("125");
  });

  it("stops at 12 whole digits by default, so cents stay safe integers", () => {
    expect(formatAmountInput("12345678901234")).toBe("123,456,789,012");
    expect(formatAmountInput("123", { maxWholeDigits: 2 })).toBe("12");
  });

  it("can skip thousands separators (percent fields)", () => {
    expect(formatAmountInput("1500", { groupThousands: false })).toBe("1500");
  });
});

describe("cleanAmount", () => {
  it("removes separators and letters", () => {
    expect(cleanAmount("Rs 25,000.50")).toBe("25000.50");
  });
});

describe("caretAfterFormat", () => {
  it("keeps the cursor at the end while typing", () => {
    // typed "2500" + "0" → "25000" shows as "25,000"
    expect(caretAfterFormat("25000", 5, "25,000")).toBe(6);
  });

  it("keeps the cursor after the same digit when a comma appears before it", () => {
    // "1,500" with the cursor after "1", type "2" → raw "12,500" (caret 2) → shows "12,500"
    expect(caretAfterFormat("12,500", 2, "12,500")).toBe(2);
    // "999" → type "9" at the start → raw "9999" caret 1 → "9,999", cursor after first 9
    expect(caretAfterFormat("9999", 1, "9,999")).toBe(1);
  });

  it("moves correctly when a comma disappears", () => {
    // "1,000" → delete "1" → raw ",000" caret 0 → "0"
    expect(caretAfterFormat(",000", 0, "0")).toBe(0);
  });
});

describe("parseAmount", () => {
  it.each([
    ["1,500.5", 1500.5],
    ["20", 20],
    ["0", 0],
  ])("%j → %d", (value, number) => {
    expect(parseAmount(value)).toBe(number);
  });

  it("gives null for empty input (never NaN)", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(".")).toBeNull();
  });
});
