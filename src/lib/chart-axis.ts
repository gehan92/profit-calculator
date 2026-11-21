/**
 * Short numbers for a chart axis, e.g. 12_500 → "12.5K". One style per axis
 * (dataviz rule): in full while every tick is under 10,000, compact as soon
 * as the axis reaches it. Digits and letters are fixed, not taken from the
 * browser, so the server and the phone print the same (see money.ts).
 */
const COMPACT_STEPS = [
  { from: 1_000_000_000, suffix: "B" },
  { from: 1_000_000, suffix: "M" },
  { from: 1_000, suffix: "K" },
] as const;

const FULL_LIMIT = 10_000;

const wholeNumber = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 });

/** Builds the tick formatter for an axis whose biggest tick (ignoring the sign) is `largestTick`. */
export function axisTickFormatter(largestTick: number): (value: number) => string {
  const compact = Math.abs(largestTick) >= FULL_LIMIT;

  return (value: number) => {
    const sign = value < 0 ? "−" : "";
    const size = Math.abs(value);
    if (!compact) return `${sign}${wholeNumber.format(size)}`;

    const step = COMPACT_STEPS.find((candidate) => size >= candidate.from);
    if (!step) return `${sign}${wholeNumber.format(size)}`;
    // One decimal at most, and no ".0": 12_500 → "12.5K", 2_000_000 → "2M".
    const scaled = Math.round((size / step.from) * 10) / 10;
    return `${sign}${scaled}${step.suffix}`;
  };
}
