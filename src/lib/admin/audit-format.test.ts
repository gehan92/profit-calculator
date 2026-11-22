import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "./audit-log";
import { AUDIT_ACTION_LABELS, auditActionLabel, auditSummary, auditTarget, auditWho, isAuditAction } from "./audit-format";

describe("audit wording", () => {
  it("has a plain label for every action", () => {
    for (const action of AUDIT_ACTIONS) expect(AUDIT_ACTION_LABELS[action]).toMatch(/\w/);
    expect(auditActionLabel("user.block")).toBe("Blocked a user");
    expect(auditActionLabel("something.new")).toBe("something.new");
    expect(isAuditAction("user.delete")).toBe(true);
    expect(isAuditAction("nope")).toBe(false);
  });

  it("names who did it from the email saved with the row, so it survives a deleted account", () => {
    expect(auditWho({ actorId: "11111111-2222", details: { actor_email: "gehan@example.com" } })).toBe("gehan@example.com");
    expect(auditWho({ actorId: "11111111-2222-3333", details: {} })).toBe("11111111…");
    expect(auditWho({ actorId: null, details: {} })).toBe("deleted account");
  });

  it("names who it was about", () => {
    expect(auditTarget({ targetUserId: "abc", details: { email: "kamala@example.com" } })).toBe("kamala@example.com");
    expect(auditTarget({ targetUserId: "abc", details: { email: null, name: "Kamala" } })).toBe("Kamala");
    expect(auditTarget({ targetUserId: "12345678-aaaa", details: {} })).toBe("12345678…");
    expect(auditTarget({ targetUserId: null, details: {} })).toBeNull();
  });

  it("summarises a settings change and a feedback status", () => {
    expect(auditSummary({ action: "settings.update", details: { key: "maintenance", from: { on: false }, to: { on: true } } })).toBe(
      'maintenance: {"on":false} → {"on":true}',
    );
    expect(auditSummary({ action: "feedback.status", details: { status: "done" } })).toBe("status → done");
    expect(auditSummary({ action: "user.block", details: {} })).toBe("");
  });

  it("keeps a long value short", () => {
    const summary = auditSummary({ action: "settings.update", details: { key: "x", from: "a".repeat(500), to: 1 } });
    expect(summary.length).toBeLessThan(160);
    expect(summary).toContain("…");
  });
});
