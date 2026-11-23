/**
 * Turns the long browser description a device sends ("Mozilla/5.0 (Linux;
 * Android 14) … Chrome/126 …") into two plain words a person recognises:
 * "Chrome" and "Android". Used for the list of signed-in devices (Account →
 * Login & security). Anything unknown is `null`, never a guess.
 */
export interface DeviceDescription {
  browser: string | null;
  os: string | null;
}

// Order matters: Edge, Opera and Samsung Internet also say "Chrome"; Chrome also says "Safari".
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\bEdg(e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

// iPhone and iPad user agents also say "like Mac OS X", and Android says "Linux".
const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bWindows\b/, "Windows"],
  [/\bMac OS X\b|\bMacintosh\b/, "Mac"],
  [/\bCrOS\b/, "Chromebook"],
  [/\bLinux\b/, "Linux"],
];

export function describeDevice(userAgent: string | null | undefined): DeviceDescription {
  const agent = userAgent ?? "";
  return {
    browser: BROWSERS.find(([pattern]) => pattern.test(agent))?.[1] ?? null,
    os: SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1] ?? null,
  };
}
