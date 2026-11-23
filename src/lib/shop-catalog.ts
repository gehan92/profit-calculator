import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { CategoryRow } from "@/lib/categories/category";
import { CategoryRepository } from "@/lib/categories/category-repository";
import type { Product } from "@/lib/products/product";
import { ProductRepository } from "@/lib/products/product-repository";
import type { Database } from "@/lib/supabase/types";

/** A shop's categories and products: what Add entry, the lists and the summary need to show names. */
export interface ShopCatalogData {
  categories: CategoryRow[];
  products: Product[];
}

/**
 * Loads the shop's categories and products for a dashboard page (Part D8,
 * D9). Every member may read both (RLS), so Staff can pick a product and
 * Viewers see names. Loaded on each page, so a change made on another
 * device shows up on the next visit.
 */
export async function loadShopCatalog(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<ShopCatalogData> {
  const [categories, products] = await Promise.all([
    new CategoryRepository(supabase).list(businessId),
    new ProductRepository(supabase).list(businessId),
  ]);
  return { categories, products };
}

/** The same, but a page and its children asking twice in one request share one answer. */
export const loadShopCatalogOnce = cache(loadShopCatalog);
