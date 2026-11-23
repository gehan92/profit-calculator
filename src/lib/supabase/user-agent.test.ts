import { describe, expect, it } from "vitest";
import { forwardUserAgent } from "./user-agent";

describe("forwardUserAgent", () => {
  it("passes the browser's description on as the User-Agent header", () => {
    expect(forwardUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/126.0")).toEqual({
      "User-Agent": "Mozilla/5.0 (Linux; Android 14) Chrome/126.0",
    });
  });

  it("sends nothing when the request had none", () => {
    expect(forwardUserAgent(null)).toEqual({});
    expect(forwardUserAgent(undefined)).toEqual({});
    expect(forwardUserAgent("")).toEqual({});
    expect(forwardUserAgent("   ")).toEqual({});
  });

  it("drops control characters, so a crafted value can never split a header", () => {
    expect(forwardUserAgent("Chrome\r\nX-Evil: 1")).toEqual({ "User-Agent": "ChromeX-Evil: 1" });
    expect(forwardUserAgent("\u0000\u0007")).toEqual({});
  });

  it("cuts an absurdly long value", () => {
    const header = forwardUserAgent("a".repeat(5000))["User-Agent"];
    expect(header).toHaveLength(400);
  });
});
