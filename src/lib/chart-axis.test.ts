import { describe, expect, it } from "vitest";
import { axisTickFormatter } from "./chart-axis";

describe("axisTickFormatter", () => {
  it("writes numbers in full while the axis stays under 10,000", () => {
    const format = axisTickFormatter(5_000);
    expect(format(0)).toBe("0");
    expect(format(2_500)).toBe("2,500");
    expect(format(-1_500)).toBe("−1,500");
  });

  it("switches the whole axis to the compact style once it reaches 10,000", () => {
    const format = axisTickFormatter(25_000);
    expect(format(0)).toBe("0");
    expect(format(500)).toBe("500");
    expect(format(2_500)).toBe("2.5K");
    expect(format(25_000)).toBe("25K");
    expect(format(-12_500)).toBe("−12.5K");
  });

  it("reaches millions and billions without a trailing .0", () => {
    const format = axisTickFormatter(3_000_000);
    expect(format(1_000_000)).toBe("1M");
    expect(format(2_400_000)).toBe("2.4M");
    expect(format(1_500_000_000)).toBe("1.5B");
  });

  it("looks at the largest tick without its sign", () => {
    expect(axisTickFormatter(-40_000)(-40_000)).toBe("−40K");
  });
});
