import {
  CATEGORY_TEMPLATES,
  isDefaultKey,
  templatesFor,
  type CategoryType,
  type CountsAs,
  type EntryCategoryType,
} from "@/config/categories";

/**
 * A shop's categories (Part D9) as plain data: one row of the `categories`
 * table, or one of the default templates for a guest (who has no account and
 * so no ids).
 */
export interface CategoryRow {
  /** The database id; `null` for the guest's default list. */
  id: string | null;
  /** A default category's key ('stock'); `null` for the owner's own categories. */
  key: string | null;
  /** The owner's own name or a rename; `null` = use the translated default name. */
  name: string | null;
  type: CategoryType;
  icon: string;
  color: string;
  countsAs: CountsAs;
  sort: number;
  /** Hidden from the picker; old entries keep pointing to it. */
  archived: boolean;
}

/** A category ready to show: the row plus what entries store (`ref`) and its name (`label`). */
export interface CategoryView extends CategoryRow {
  /** What an entry stores for this category: the id, or the key when there is no id. */
  ref: string;
  /** The name to show, in the person's language. */
  label: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z][a-z0-9_]{0,39}$/;

/** True for a database category id. */
export function isCategoryId(value: string): boolean {
  return UUID.test(value);
}

/** True for something an entry may store as its category: an id, or a key shaped like a default key. */
export function hasCategoryRefShape(value: string): boolean {
  return isCategoryId(value) || KEY.test(value);
}

/** The default list as rows with no ids: what guests use. */
export function defaultCategoryRows(): CategoryRow[] {
  return templatesFor(null).map((template) => ({
    id: null,
    key: template.key,
    name: null,
    type: template.type,
    icon: template.icon,
    color: template.color,
    countsAs: template.countsAs,
    sort: template.sort,
    archived: false,
  }));
}

/**
 * Looks up a shop's categories for the screens: the picker in Add entry, the
 * name on every list row, and whether an expense is a hidden cost.
 *
 * An entry stores a `ref`: the category's id (logged-in people) or, for guest
 * records and entries queued before the page knew the list, a default key.
 * `find` accepts both. Hidden categories are kept in the catalog (old
 * entries still need their name) but left out of `options`.
 */
export class CategoryCatalog {
  private readonly views: readonly CategoryView[];

  /**
   * @param rows The categories to know.
   * @param labelOfKey The translated name of a default key (e.g. `t("stock")`).
   */
  constructor(
    rows: readonly CategoryRow[],
    private readonly labelOfKey: (key: string) => string,
  ) {
    this.views = rows
      .map((row): CategoryView => ({ ...row, ref: row.id ?? row.key ?? "", label: this.labelFor(row) }))
      .filter((view) => view.ref !== "")
      .toSorted((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  }

  /** What the picker offers for this kind of entry: not hidden, in the owner's order. */
  options(type: EntryCategoryType): CategoryView[] {
    return this.views.filter((view) => view.type === type && !view.archived);
  }

  /** Every category of this kind, hidden ones included (Settings → Categories). */
  all(type: CategoryType): CategoryView[] {
    return this.views.filter((view) => view.type === type);
  }

  /** The category an entry points to, or `undefined` when this catalog does not know it. */
  find(ref: string | null | undefined, type: EntryCategoryType): CategoryView | undefined {
    if (!ref) return undefined;
    const ofType = this.views.filter((view) => view.type === type);
    // An id names one category; a key names the shop's category with that default key.
    return isCategoryId(ref) ? ofType.find((view) => view.id === ref) : ofType.find((view) => view.key === ref);
  }

  /**
   * Like `find`, but never fails, so one odd entry cannot break a list: a
   * default key the shop does not have yet (an entry still waiting to be
   * sent) is shown with its default name, anything else as "Other".
   */
  resolve(ref: string | null | undefined, type: EntryCategoryType): CategoryView {
    const found = this.find(ref, type);
    if (found) return found;

    const template = CATEGORY_TEMPLATES.find((candidate) => candidate.type === type && candidate.key === ref);
    const fallback = template ?? CATEGORY_TEMPLATES.find((candidate) => candidate.type === type && candidate.key === (type === "income" ? "other_income" : "other"));
    if (!fallback) throw new Error(`No default category for ${type}`);
    return {
      id: null,
      key: fallback.key,
      name: null,
      type,
      icon: fallback.icon,
      color: fallback.color,
      countsAs: fallback.countsAs,
      sort: fallback.sort,
      archived: false,
      ref: ref ?? fallback.key,
      label: this.labelOfKey(fallback.key),
    };
  }

  label(ref: string | null | undefined, type: EntryCategoryType): string {
    return this.resolve(ref, type).label;
  }

  /** True for an expense that goes into "Real profit" instead of "Expenses". */
  isHiddenCost(ref: string | null | undefined, type: EntryCategoryType): boolean {
    return type === "expense" && this.resolve(ref, type).countsAs === "hidden_cost";
  }

  /** The category chosen first in the picker: the first one offered. */
  defaultRef(type: EntryCategoryType): string {
    const first = this.options(type)[0] ?? this.resolve(null, type);
    return first.ref;
  }

  private labelFor(row: CategoryRow): string {
    if (row.name) return row.name;
    if (row.key) return this.labelOfKey(row.key);
    return "";
  }
}

/** True when `key` is a default key of this kind (used to check keys sent by guests and the offline queue). */
export function isKnownKey(type: EntryCategoryType, key: string): boolean {
  return isDefaultKey(type, key);
}
