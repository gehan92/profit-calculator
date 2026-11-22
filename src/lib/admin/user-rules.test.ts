import { describe, expect, it } from "vitest";
import { CONFIRM_WORD, matchesTyped, refuseUserAction } from "./user-rules";

describe("refuseUserAction", () => {
  it("lets an Admin act on an ordinary user or a Support user", () => {
    expect(refuseUserAction("admin-1", { id: "user-2", platformRole: "user" })).toBeNull();
    expect(refuseUserAction("admin-1", { id: "user-3", platformRole: "support" })).toBeNull();
  });

  it("never lets an Admin act on themselves", () => {
    expect(refuseUserAction("admin-1", { id: "admin-1", platformRole: "admin" })).toBe("self");
  });

  it("never lets an Admin act on another Admin", () => {
    expect(refuseUserAction("admin-1", { id: "admin-2", platformRole: "admin" })).toBe("admin");
  });
});

describe("matchesTyped", () => {
  it("accepts the email in any letter case, with spaces around it", () => {
    expect(matchesTyped("Kamala@Example.com", "kamala@example.com")).toBe(true);
    expect(matchesTyped("  kamala@example.com ", "kamala@example.com")).toBe(true);
    expect(matchesTyped("confirm", CONFIRM_WORD)).toBe(true);
  });

  it.each(["", "kamala", "kamala@example.co", "kamala@example.com.", "other@example.com"])(
    "refuses %j",
    (typed) => {
      expect(matchesTyped(typed, "kamala@example.com")).toBe(false);
    },
  );

  it("never matches when there is nothing to match (a user without an email)", () => {
    expect(matchesTyped("", "")).toBe(false);
    expect(matchesTyped("anything", "  ")).toBe(false);
  });
});
