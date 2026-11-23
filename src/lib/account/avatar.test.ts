import { describe, expect, it } from "vitest";
import { isAvatarPath, newAvatarPath } from "./avatar";

const ANN = "c7190c8c-f779-4bd2-a273-31f0a0483f56";
const BEN = "0b6d1a52-3c63-4f7a-8d52-1f7d1ad1f6aa";
const FILE = "2269dffd-b507-4a4f-9448-87484d48ba3c";

describe("isAvatarPath", () => {
  it("accepts the person's own folder with a random .webp name", () => {
    expect(isAvatarPath(`${ANN}/${FILE}.webp`, ANN)).toBe(true);
  });

  it("refuses another person's folder", () => {
    expect(isAvatarPath(`${BEN}/${FILE}.webp`, ANN)).toBe(false);
  });

  it("refuses anything that is not one file directly in the folder", () => {
    expect(isAvatarPath(`${ANN}/photo.webp`, ANN)).toBe(false);
    expect(isAvatarPath(`${ANN}/${FILE}.png`, ANN)).toBe(false);
    expect(isAvatarPath(`${ANN}/sub/${FILE}.webp`, ANN)).toBe(false);
    expect(isAvatarPath(`../${ANN}/${FILE}.webp`, ANN)).toBe(false);
    expect(isAvatarPath(`${ANN}/${FILE}.webp/../x`, ANN)).toBe(false);
    expect(isAvatarPath("", ANN)).toBe(false);
  });
});

describe("newAvatarPath", () => {
  it("is inside the person's own folder and valid", () => {
    expect(isAvatarPath(newAvatarPath(ANN), ANN)).toBe(true);
  });

  it("is different every time (an old address never serves the new picture)", () => {
    expect(newAvatarPath(ANN)).not.toBe(newAvatarPath(ANN));
  });

  it("uses the random part it is given", () => {
    expect(newAvatarPath(ANN, FILE)).toBe(`${ANN}/${FILE}.webp`);
  });
});
