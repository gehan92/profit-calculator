import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, businessTypeOrDefault, DEFAULT_BUSINESS_TYPE, isBusinessType } from "./business-types";

describe("business types", () => {
  it("lists the five kinds from the spec, in the order they are shown", () => {
    expect([...BUSINESS_TYPES]).toEqual(["shop", "home", "transport", "service", "other"]);
  });

  it("accepts only the listed codes", () => {
    for (const code of BUSINESS_TYPES) expect(isBusinessType(code)).toBe(true);
    for (const bad of ["Shop", "restaurant", "", null, undefined, 3]) expect(isBusinessType(bad)).toBe(false);
  });

  it("treats a shop with no choice as a plain shop", () => {
    expect(DEFAULT_BUSINESS_TYPE).toBe("shop");
    expect(businessTypeOrDefault(null)).toBe("shop");
    expect(businessTypeOrDefault("nonsense")).toBe("shop");
    expect(businessTypeOrDefault("transport")).toBe("transport");
  });
});
