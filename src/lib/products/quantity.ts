import { MAX_QUANTITY } from "@/lib/entries/entry";
import type { ProductUnit } from "./product";

/**
 * Quantities typed in Add entry ("3", "1.5", "0.25"): whole numbers or up to 3
 * decimals, as the database stores them. A comma counts as the decimal point.
 */
const QUANTITY_INPUT = /^(\d{0,7})(?:\.(\d{0,3}))?$/;

/** What is allowed while typing (an empty box and a lone "." are fine until the person is done). */
export function isQuantityInput(text: string): boolean {
  return QUANTITY_INPUT.test(text.replace(",", "."));
}

/** The number typed, or `null` when it is not more than 0 or not allowed. */
export function parseQuantity(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (clean === "" || !QUANTITY_INPUT.test(clean)) return null;

  const value = Number(clean);
  return Number.isFinite(value) && value > 0 && value <= MAX_QUANTITY ? value : null;
}

/** A quantity as it should read in the box: "3", "1.5", never "3.000". */
export function formatQuantity(quantity: number): string {
  return String(Math.round(quantity * 1000) / 1000);
}

/** How much the − and + buttons change a quantity: whole items by 1, weights and volumes by smaller steps. */
export function quantityStep(unit: ProductUnit): number {
  switch (unit) {
    case "kg":
    case "litre":
    case "metre":
      return 0.5;
    case "g":
    case "ml":
      return 100;
    default:
      return 1;
  }
}

/** The quantity after one tap of − or +, never below one step and never above the limit. */
export function stepQuantity(current: number | null, unit: ProductUnit, direction: 1 | -1): number {
  const step = quantityStep(unit);
  const base = current ?? 0;
  const next = Math.round((base + direction * step) * 1000) / 1000;
  return Math.min(MAX_QUANTITY, Math.max(step, next));
}
