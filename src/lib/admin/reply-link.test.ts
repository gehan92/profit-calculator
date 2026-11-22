import { describe, expect, it } from "vitest";
import { replyLink } from "./reply-link";

describe("replyLink", () => {
  it("turns an email into a mailto link", () => {
    expect(replyLink("kamala@example.com")).toEqual({
      kind: "email",
      href: "mailto:kamala@example.com",
      label: "Reply by email",
    });
    expect(replyLink("  Kamala.P+shop@Example.co.lk ")?.kind).toBe("email");
  });

  it.each([
    ["+94 77 123 4567", "https://wa.me/94771234567"],
    ["0771234567", "https://wa.me/94771234567"],
    ["077-123-4567", "https://wa.me/94771234567"],
    ["94771234567", "https://wa.me/94771234567"],
  ])("turns the phone number %j into a WhatsApp link", (contact, href) => {
    expect(replyLink(contact)).toMatchObject({ kind: "whatsapp", href });
  });

  it.each([null, "", "   ", "call me", "https://evil.example", "javascript:alert(1)", "a@b", "x@y.z", "<b>@x.com", "12345"])(
    "gives no link for %j",
    (contact) => {
      expect(replyLink(contact)).toBeNull();
    },
  );

  it("cannot be used to smuggle extra mail headers or a script into the link", () => {
    expect(replyLink("a@b.com?cc=evil@x.com")).toBeNull(); // a second @ means it is not one plain address
    expect(replyLink("a@b.com\nBcc: evil@x.com")).toBeNull();
    // A single address with a query-looking tail is encoded, so it cannot add a header.
    expect(replyLink("a@b.com?subject=x")?.href).toBe("mailto:a@b.com%3Fsubject%3Dx");
  });
});
