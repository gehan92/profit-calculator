import { describe, expect, it } from "vitest";
import { ADMIN_PAGE_SIZE, pageCount, pageRange, parsePage } from "./paging";

describe("parsePage", () => {
  it("reads a page number from the address", () => {
    expect(parsePage("1")).toBe(1);
    expect(parsePage("7")).toBe(7);
    expect(parsePage(["3", "9"])).toBe(3);
  });

  it.each([undefined, "", "0", "-2", "1.5", "abc", "NaN", "Infinity"])("falls back to page 1 for %j", (value) => {
    expect(parsePage(value)).toBe(1);
  });

  it("caps an absurd page number", () => {
    expect(parsePage("99999999999")).toBe(10_000);
  });
});

describe("pageRange and pageCount", () => {
  it("gives the rows of a page, both ends included", () => {
    expect(ADMIN_PAGE_SIZE).toBe(25);
    expect(pageRange(1)).toEqual({ from: 0, to: 24 });
    expect(pageRange(3)).toEqual({ from: 50, to: 74 });
    expect(pageRange(2, 10)).toEqual({ from: 10, to: 19 });
  });

  it("counts pages, with at least one", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(25)).toBe(1);
    expect(pageCount(26)).toBe(2);
    expect(pageCount(100)).toBe(4);
  });
});
