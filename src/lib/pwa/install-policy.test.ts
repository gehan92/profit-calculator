import { describe, expect, it } from "vitest";
import {
  countVisit,
  dismissOffer,
  EMPTY_INSTALL_STATE,
  isIosDevice,
  markInstalled,
  parseInstallState,
  shouldOfferInstall,
  type InstallState,
} from "./install-policy";

const NOW = new Date("2026-11-22T10:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe("shouldOfferInstall", () => {
  it("does not offer on the first visit, offers from the second", () => {
    expect(shouldOfferInstall(EMPTY_INSTALL_STATE, NOW)).toBe(false);
    const first = countVisit(EMPTY_INSTALL_STATE);
    expect(shouldOfferInstall(first, NOW)).toBe(false);
    expect(shouldOfferInstall(countVisit(first), NOW)).toBe(true);
  });

  it("never offers to someone who already added the app", () => {
    expect(shouldOfferInstall(markInstalled({ ...EMPTY_INSTALL_STATE, visits: 5 }), NOW)).toBe(false);
  });

  it("stays quiet for 30 days after Not now, then offers again", () => {
    const visited: InstallState = { ...EMPTY_INSTALL_STATE, visits: 3 };
    const dismissed = dismissOffer(visited, NOW);
    expect(shouldOfferInstall(dismissed, NOW)).toBe(false);
    expect(shouldOfferInstall({ ...visited, dismissedAt: daysAgo(29) }, NOW)).toBe(false);
    expect(shouldOfferInstall({ ...visited, dismissedAt: daysAgo(31) }, NOW)).toBe(true);
  });
});

describe("parseInstallState", () => {
  it("round-trips a saved state", () => {
    const state: InstallState = { visits: 4, dismissedAt: daysAgo(2), installed: false };
    expect(parseInstallState(JSON.stringify(state))).toEqual(state);
  });

  it.each([null, "", "not json", "42", "null", "[]", '{"visits":"many"}', '{"visits":-3}'])(
    "turns %j into a fresh state",
    (raw) => {
      expect(parseInstallState(raw).visits).toBe(0);
    },
  );

  it("ignores a broken date", () => {
    expect(parseInstallState('{"visits":2,"dismissedAt":"yesterday"}').dismissedAt).toBeNull();
  });
});

describe("isIosDevice", () => {
  it("knows iPhones and iPads", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1")).toBe(true);
  });

  it("knows an iPad that says it is a Mac, but not a real Mac", () => {
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
    expect(isIosDevice(mac, 5)).toBe(true);
    expect(isIosDevice(mac, 0)).toBe(false);
  });

  it("is false for Android and Windows", () => {
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 14; SM-A146B) Chrome/126 Mobile Safari/537.36")).toBe(false);
    expect(isIosDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36")).toBe(false);
  });
});
