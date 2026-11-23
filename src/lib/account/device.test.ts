import { describe, expect, it } from "vitest";
import { describeDevice } from "./device";

const AGENTS = {
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  safariIpad:
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  operaWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0",
};

describe("describeDevice", () => {
  it.each([
    ["chromeAndroid", "Chrome", "Android"],
    ["samsung", "Samsung Internet", "Android"],
    ["edgeWindows", "Edge", "Windows"],
    ["chromeWindows", "Chrome", "Windows"],
    ["firefoxLinux", "Firefox", "Linux"],
    ["safariIphone", "Safari", "iPhone"],
    ["chromeIphone", "Chrome", "iPhone"],
    ["safariMac", "Safari", "Mac"],
    ["safariIpad", "Safari", "iPad"],
    ["operaWindows", "Opera", "Windows"],
  ] as const)("%s → %s on %s", (name, browser, os) => {
    expect(describeDevice(AGENTS[name])).toEqual({ browser, os });
  });

  it("says nothing it does not know", () => {
    expect(describeDevice("curl/8.4.0")).toEqual({ browser: null, os: null });
    expect(describeDevice("")).toEqual({ browser: null, os: null });
    expect(describeDevice(null)).toEqual({ browser: null, os: null });
    expect(describeDevice(undefined)).toEqual({ browser: null, os: null });
  });

  it("can know only one of the two", () => {
    expect(describeDevice("Firefox/127.0")).toEqual({ browser: "Firefox", os: null });
    expect(describeDevice("(Windows NT 10.0)")).toEqual({ browser: null, os: "Windows" });
  });
});
