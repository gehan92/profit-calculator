import { describe, expect, it, vi } from "vitest";

// support-contact.ts also holds a reader that needs the database; these tests use only the pure functions.
vi.mock("./platform-settings", () => ({ getPlatformSettings: vi.fn() }));

import { pickSupportNumber, supportWhatsAppLink } from "./support-contact";

describe("pickSupportNumber", () => {
  it("prefers the number the Admin typed in Settings", () => {
    expect(pickSupportNumber("0771234567", "94112223334")).toBe("0771234567");
  });

  it("falls back to the environment variable", () => {
    expect(pickSupportNumber("", "94112223334")).toBe("94112223334");
    expect(pickSupportNumber("  ", " 94112223334 ")).toBe("94112223334");
  });

  it("is empty when nothing is set", () => {
    expect(pickSupportNumber("", "")).toBe("");
  });
});

describe("supportWhatsAppLink", () => {
  it("builds the chat link with a first message", () => {
    expect(supportWhatsAppLink("0771234567", "", "Hi")).toBe("https://wa.me/94771234567?text=Hi");
  });

  it("gives no link (so the button is hidden) when there is no number or it is invalid", () => {
    expect(supportWhatsAppLink("", "")).toBeNull();
    expect(supportWhatsAppLink("not a number", "")).toBeNull();
  });
});
