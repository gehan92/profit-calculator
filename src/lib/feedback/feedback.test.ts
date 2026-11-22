import { describe, expect, it } from "vitest";
import { cleanPageParam, FEEDBACK_MESSAGE_MAX, feedbackSchema } from "./feedback";

describe("cleanPageParam", () => {
  it.each(["/en/profit-calculator", "/si/dashboard/summary", "/ta", "/"])("keeps the path %s", (path) => {
    expect(cleanPageParam(path)).toBe(path);
  });

  it.each([
    // The field holds paths only: no query string, no other website.
    "/en/dashboard/entries?month=2026-11",
    "https://evil.example/x",
    "//evil.example",
    "javascript:alert(1)",
    "profit-calculator",
    "/<script>alert(1)</script>",
    "/a b",
    "",
    "   ",
    `/${"a".repeat(300)}`,
    42,
    null,
    undefined,
  ])("refuses %j", (value) => {
    expect(cleanPageParam(value)).toBeNull();
  });
});

describe("feedbackSchema", () => {
  it("accepts a message and trims it", () => {
    expect(feedbackSchema.parse({ message: "  Please add a Tamil guide  " })).toEqual({
      message: "Please add a Tamil guide",
      contact: null,
      page: null,
    });
  });

  it("keeps an optional contact and page", () => {
    expect(
      feedbackSchema.parse({ message: "Hi", contact: " 0771234567 ", page: "/en/margin-calculator" }),
    ).toEqual({ message: "Hi", contact: "0771234567", page: "/en/margin-calculator" });
  });

  it("treats an empty contact as no contact", () => {
    expect(feedbackSchema.parse({ message: "Hi", contact: "   " }).contact).toBeNull();
  });

  it("refuses an empty or very long message", () => {
    expect(feedbackSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(feedbackSchema.safeParse({ message: "a".repeat(FEEDBACK_MESSAGE_MAX) }).success).toBe(true);
    expect(feedbackSchema.safeParse({ message: "a".repeat(FEEDBACK_MESSAGE_MAX + 1) }).success).toBe(false);
  });

  it("refuses a very long contact", () => {
    expect(feedbackSchema.safeParse({ message: "Hi", contact: "x".repeat(101) }).success).toBe(false);
  });

  it("drops a page that is not a path on this website, but still accepts the message", () => {
    expect(feedbackSchema.parse({ message: "Hi", page: "https://evil.example" }).page).toBeNull();
  });
});
