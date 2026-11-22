import { describe, expect, it } from "vitest";
import { toInternationalNumber, whatsappLink } from "./whatsapp";

describe("toInternationalNumber", () => {
  it.each([
    ["+94 77 123 4567", "94771234567"],
    ["077-123-4567", "94771234567"],
    ["0771234567", "94771234567"],
    ["94771234567", "94771234567"],
    ["  +447911123456 ", "447911123456"],
  ])("turns %s into %s", (typed, expected) => {
    expect(toInternationalNumber(typed)).toBe(expected);
  });

  it.each(["", "abc", "12345", "+94 (77) 1234567", "07712345678901234567", "https://wa.me/94771234567"])(
    "refuses %j",
    (typed) => {
      expect(toInternationalNumber(typed)).toBeNull();
    },
  );
});

describe("whatsappLink", () => {
  it("opens a chat", () => {
    expect(whatsappLink("0771234567")).toBe("https://wa.me/94771234567");
  });

  it("can start the chat with a message, safely encoded", () => {
    expect(whatsappLink("0771234567", "Hello & thanks")).toBe(
      "https://wa.me/94771234567?text=Hello%20%26%20thanks",
    );
  });

  it("gives no link for something that is not a phone number", () => {
    expect(whatsappLink("not a number", "Hi")).toBeNull();
  });
});
