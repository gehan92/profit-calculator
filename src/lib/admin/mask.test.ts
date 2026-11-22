import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone, userLabel } from "./mask";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("kamala@gmail.com")).toBe("k***@gmail.com");
    expect(maskEmail("a@b.lk")).toBe("a***@b.lk");
  });

  it("returns null when there is no email", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail(undefined)).toBeNull();
    expect(maskEmail("")).toBeNull();
  });

  it("never returns the part before the @ except its first letter", () => {
    expect(maskEmail("secret.name@shop.lk")).not.toContain("ecret");
  });
});

describe("maskPhone", () => {
  it("shows the start and the last two digits", () => {
    expect(maskPhone("+94771234567")).toBe("+947 *** **67");
  });

  it("gives the same result with or without the +, and ignores spaces", () => {
    expect(maskPhone("94771234567")).toBe("+947 *** **67");
    expect(maskPhone("+94 77 123 4567")).toBe("+947 *** **67");
  });

  it("hides a very short number completely", () => {
    expect(maskPhone("12345")).toBe("*** **");
    expect(maskPhone("123456")).toBe("*** **");
  });

  it("returns null when there is no phone", () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone("")).toBeNull();
  });
});

describe("userLabel", () => {
  it("uses the masked email, or a short id when there is none", () => {
    expect(userLabel({ id: "7f3a91c2-1111-2222-3333-444444444444", emailMasked: "k***@gmail.com" })).toBe("k***@gmail.com");
    expect(userLabel({ id: "7f3a91c2-1111-2222-3333-444444444444", emailMasked: null })).toBe("User 7f3a91c2");
  });
});
