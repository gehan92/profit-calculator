import type en from "@/messages/en.json";

/** The default category names that have a translation (`messages/*.json` → "categories"). */
export type CategoryMessageKey = keyof (typeof en)["categories"];

/** The part of next-intl's `t` that is needed to name a default category. */
interface CategoryTranslator {
  (key: CategoryMessageKey): string;
  has(key: CategoryMessageKey): boolean;
}

/**
 * The translated name of a default category key ("stock" → "Stock"). A key
 * with no translation yet (a default added to the database later) shows as
 * itself, never as a raw message path.
 */
export function categoryNameOf(t: CategoryTranslator, key: string): string {
  const messageKey = key as CategoryMessageKey;
  return t.has(messageKey) ? t(messageKey) : key;
}
