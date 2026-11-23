import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";
import type { Product, ProductFields, ProductKind, ProductUnit } from "./product";

/** Thrown when Supabase refuses or fails a products query. */
export class ProductQueryError extends Error {
  readonly code: string | undefined;

  constructor(
    action: string,
    cause: { message: string; code?: string },
  ) {
    super(`Could not ${action}: ${cause.message}`);
    this.name = "ProductQueryError";
    this.code = cause.code;
  }

  /** The Free plan's 20 active products are used up (a database rule, migration 0007). */
  get isLimitReached(): boolean {
    return this.message.includes("free_limit_products");
  }

  /** Another active product in this shop already has this name. */
  get isNameTaken(): boolean {
    return this.code === "23505";
  }
}

const COLUMNS = "id, name, kind, company_name, unit, cost_cents, price_cents, barcode, notes, archived" as const;
type Row = Pick<
  Tables<"products">,
  "id" | "name" | "kind" | "company_name" | "unit" | "cost_cents" | "price_cents" | "barcode" | "notes" | "archived"
>;

function toProduct(row: Row): Product {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ProductKind,
    companyName: row.company_name,
    unit: row.unit as ProductUnit,
    costCents: Number(row.cost_cents),
    priceCents: Number(row.price_cents),
    barcode: row.barcode,
    notes: row.notes,
    archived: row.archived,
  };
}

function toValues(fields: ProductFields) {
  return {
    name: fields.name,
    kind: fields.kind,
    company_name: fields.companyName,
    unit: fields.unit,
    cost_cents: fields.costCents,
    price_cents: fields.priceCents,
    barcode: fields.barcode,
    notes: fields.notes,
  };
}

/**
 * Reads and writes a shop's products (Part D8, `products`). It uses the
 * logged-in person's own client, so Row Level Security decides: every member
 * reads (Staff and Viewer need the names for Add entry and the lists), only the
 * Owner writes, and the database enforces the Free limit of 20 active products.
 */
export class ProductRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** Every product of the shop, A–Z, put-away ones included. */
  async list(businessId: string): Promise<Product[]> {
    const { data, error } = await this.db
      .from("products")
      .select(COLUMNS)
      .eq("business_id", businessId)
      .order("name");

    if (error) throw new ProductQueryError("load the products", error);
    return data.map(toProduct);
  }

  async create(businessId: string, fields: ProductFields): Promise<Product> {
    const { data, error } = await this.db
      .from("products")
      .insert({ business_id: businessId, ...toValues(fields) })
      .select(COLUMNS)
      .single();

    if (error) throw new ProductQueryError("add the product", error);
    return toProduct(data);
  }

  /** Changes a product. Returns `false` when it does not exist or RLS hides it. */
  async update(id: string, fields: ProductFields): Promise<boolean> {
    const { data, error } = await this.db.from("products").update(toValues(fields)).eq("id", id).select("id");
    if (error) throw new ProductQueryError("change the product", error);
    return data.length > 0;
  }

  /** Puts a product away, or brings it back (which counts against the Free limit again). */
  async setArchived(id: string, archived: boolean): Promise<boolean> {
    const { data, error } = await this.db.from("products").update({ archived }).eq("id", id).select("id");
    if (error) throw new ProductQueryError(archived ? "put the product away" : "bring the product back", error);
    return data.length > 0;
  }

  /** Company names this shop has used, for the type-ahead on the product form. */
  async companyNames(businessId: string): Promise<string[]> {
    const { data, error } = await this.db.rpc("my_company_names", { b: businessId });
    if (error) throw new ProductQueryError("load the company names", error);
    return data ?? [];
  }
}
