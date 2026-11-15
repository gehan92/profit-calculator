import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import si from "@/messages/si.json";
import ta from "@/messages/ta.json";

/**
 * "Every screen fully in English, Sinhala and Tamil" (Part A4).
 * Fails when a translation is missing, extra or left empty.
 */
function flattenKeys(messages: object, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null ? flattenKeys(value, path) : [path];
  });
}

function emptyKeys(messages: object, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) return emptyKeys(value, path);
    return typeof value === "string" && value.trim() === "" ? [path] : [];
  });
}

const englishKeys = flattenKeys(en).sort();

describe.each([
  ["si", si],
  ["ta", ta],
])("%s translations", (_locale, messages) => {
  it("have exactly the same keys as English", () => {
    expect(flattenKeys(messages).sort()).toEqual(englishKeys);
  });

  it("have no empty texts", () => {
    expect(emptyKeys(messages)).toEqual([]);
  });
});
