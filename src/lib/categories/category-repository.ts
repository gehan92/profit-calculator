import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryType, CountsAs, EntryCategoryType } from "@/config/categories";
import type { Database, Tables } from "@/lib/supabase/types";
import type { CategoryRow } from "./category";

/** Thrown when Supabase refuses or fails a categories query. `code` is the Postgres error code, if any. */
export class CategoryQueryError extends Error {
  readonly code: string | undefined;

  constructor(action: string, cause: { message: string; code?: string }) {
    super(`Could not ${action}: ${cause.message}`);
    this.name = "CategoryQueryError";
    this.code = cause.code;
  }

  /** The owner already has a category with this name (in this kind). */
  get isNameTaken(): boolean {
    return this.code === "23505";
  }
}

export const CATEGORY_NAME_MAX = 40;

/** The colours the owner can give an own category (the names `components/category-icon.tsx` knows). */
export const CATEGORY_COLORS = ["green", "orange", "blue", "yellow", "purple", "red", "gray"] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

const COLUMNS = "id, key, name, type, icon, color, counts_as, sort, archived" as const;
type Row = Pick<Tables<"categories">, "id" | "key" | "name" | "type" | "icon" | "color" | "counts_as" | "sort" | "archived">;

function toRow(row: Row): CategoryRow {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    type: row.type as CategoryType,
    icon: row.icon,
    color: row.color,
    countsAs: row.counts_as as CountsAs,
    sort: row.sort,
    archived: row.archived,
  };
}

/** What the owner chooses when adding an own category. */
export interface NewCategory {
  type: EntryCategoryType;
  name: string;
  hiddenCost: boolean;
  color: CategoryColor;
}

/** What the owner can change on a category. Only the fields given are changed. */
export interface CategoryChange {
  /** A new name; `null` goes back to the default name (default categories only). */
  name?: string | null;
  /** Hide it from the picker (or bring it back). */
  archived?: boolean;
  countsAs?: CountsAs;
  color?: CategoryColor;
}

/**
 * Reads and writes a shop's categories (Part D9, `categories`). It uses the
 * logged-in person's own Supabase client, so Row Level Security decides: every
 * member reads, only the Owner writes, and the database refuses to change a
 * category's kind, shop or key (migration 0009).
 */
export class CategoryRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** Every category of the shop, hidden ones included, as plain rows. */
  async list(businessId: string): Promise<CategoryRow[]> {
    const { data, error } = await this.db
      .from("categories")
      .select(COLUMNS)
      .eq("business_id", businessId)
      .order("type")
      .order("sort")
      .order("created_at");

    if (error) throw new CategoryQueryError("load the categories", error);
    return data.map(toRow);
  }

  /**
   * Adds an own category. It goes just before "Other" (sort 99): after the
   * categories already there, so the owner's order stays and "Other" stays last.
   */
  async create(businessId: string, category: NewCategory): Promise<CategoryRow> {
    const existing = await this.list(businessId);
    const sorts = existing.filter((row) => row.type === category.type && row.sort < 99).map((row) => row.sort);
    const sort = Math.min(98, (sorts.length > 0 ? Math.max(...sorts) : 0) + 1);

    const { data, error } = await this.db
      .from("categories")
      .insert({
        business_id: businessId,
        type: category.type,
        name: category.name,
        color: category.color,
        counts_as: category.type === "expense" && category.hiddenCost ? "hidden_cost" : "normal",
        sort,
      })
      .select(COLUMNS)
      .single();

    if (error) throw new CategoryQueryError("add the category", error);
    return toRow(data);
  }

  /** Changes a category. Returns `false` when there is nothing to change (it does not exist, or RLS hides it). */
  async update(id: string, change: CategoryChange): Promise<boolean> {
    const values: Partial<Tables<"categories">> = {};
    if (change.name !== undefined) values.name = change.name;
    if (change.archived !== undefined) values.archived = change.archived;
    if (change.countsAs !== undefined) values.counts_as = change.countsAs;
    if (change.color !== undefined) values.color = change.color;
    if (Object.keys(values).length === 0) return true;

    const { data, error } = await this.db.from("categories").update(values).eq("id", id).select("id");
    if (error) throw new CategoryQueryError("change the category", error);
    return data.length > 0;
  }

  /**
   * Saves a new order for one kind of category: `orderedIds` first to last.
   * Each gets a position 10 apart, which leaves room for later additions.
   */
  async reorder(orderedIds: readonly string[]): Promise<void> {
    const results = await Promise.all(
      orderedIds.map((id, index) => this.db.from("categories").update({ sort: (index + 1) * 10 }).eq("id", id)),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new CategoryQueryError("save the order", failed.error);
  }
}
