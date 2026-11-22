import { describe, expect, it } from "vitest";
import { cleanMfaCode, isSecurityPath, isValidMfaCode, mfaRequired, nextMfaStep } from "./mfa";

describe("isSecurityPath", () => {
  it("matches only the security page", () => {
    expect(isSecurityPath("/admin/security")).toBe(true);
    expect(isSecurityPath("/admin/security/")).toBe(true);
    expect(isSecurityPath("/admin")).toBe(false);
    expect(isSecurityPath("/admin/users")).toBe(false);
    expect(isSecurityPath("/admin/security/extra")).toBe(false);
    expect(isSecurityPath("/admin/securityx")).toBe(false);
  });
});

describe("mfaRequired", () => {
  it("applies to everyone who can open the admin panel, nobody else", () => {
    expect(mfaRequired("admin")).toBe(true);
    expect(mfaRequired("support")).toBe(true);
    expect(mfaRequired("user")).toBe(false);
  });
});

describe("nextMfaStep", () => {
  it("asks an admin with no authenticator app to set one up", () => {
    expect(nextMfaStep({ role: "admin", level: "aal1", hasFactor: false })).toBe("enroll");
  });

  it("asks an admin who has an app but only the first step done for the code", () => {
    expect(nextMfaStep({ role: "admin", level: "aal1", hasFactor: true })).toBe("challenge");
  });

  it("lets an admin in once the code was entered", () => {
    expect(nextMfaStep({ role: "admin", level: "aal2", hasFactor: true })).toBe("done");
  });

  it("treats an unknown level as the first step only (never lets someone in by mistake)", () => {
    expect(nextMfaStep({ role: "admin", level: null, hasFactor: true })).toBe("challenge");
    expect(nextMfaStep({ role: "admin", level: null, hasFactor: false })).toBe("enroll");
  });

  it("applies to Support too", () => {
    expect(nextMfaStep({ role: "support", level: "aal1", hasFactor: true })).toBe("challenge");
  });

  it("asks nothing from an ordinary user", () => {
    expect(nextMfaStep({ role: "user", level: "aal1", hasFactor: false })).toBe("done");
  });
});

describe("the code people type", () => {
  it("ignores spaces, as authenticator apps show '123 456'", () => {
    expect(cleanMfaCode(" 123 456 ")).toBe("123456");
  });

  it("accepts exactly 6 digits", () => {
    expect(isValidMfaCode("123456")).toBe(true);
    expect(isValidMfaCode("12345")).toBe(false);
    expect(isValidMfaCode("1234567")).toBe(false);
    expect(isValidMfaCode("12345a")).toBe(false);
    expect(isValidMfaCode("")).toBe(false);
  });
});
