"use client";

import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CategoryCatalog, defaultCategoryRows, type CategoryRow } from "@/lib/categories/category";
import { categoryNameOf } from "@/lib/categories/category-labels";
import type { Product } from "@/lib/products/product";

interface ShopCatalogValue {
  categories: readonly CategoryRow[];
  products: readonly Product[];
  /** Shows a category made a moment ago before the page has reloaded the list. */
  addCategory: (category: CategoryRow) => void;
}

/** Outside a shop (guest "My Business (try)") there are only the default categories and no products. */
const GUEST_CATALOG: ShopCatalogValue = {
  categories: defaultCategoryRows(),
  products: [],
  addCategory: () => {},
};

const ShopCatalogContext = createContext<ShopCatalogValue>(GUEST_CATALOG);

/**
 * Tells every entry screen below it which categories and products the shop
 * has (Part D8, D9): the picker in Add entry, the names on the lists and
 * the hidden-cost rule for the totals. Dashboard pages wrap their content in it.
 */
export function ShopCatalogProvider({
  categories,
  products,
  children,
}: {
  categories: readonly CategoryRow[];
  products: readonly Product[];
  children: ReactNode;
}) {
  const [added, setAdded] = useState<readonly CategoryRow[]>([]);
  const addCategory = useCallback((category: CategoryRow) => setAdded((previous) => [...previous, category]), []);

  const value = useMemo<ShopCatalogValue>(() => {
    // The reloaded list wins: a category that has arrived is not counted twice.
    const known = new Set(categories.map((category) => category.id));
    return {
      categories: [...categories, ...added.filter((category) => !known.has(category.id))],
      products,
      addCategory,
    };
  }, [categories, products, added, addCategory]);

  return <ShopCatalogContext.Provider value={value}>{children}</ShopCatalogContext.Provider>;
}

/** The shop's categories, with translated names for the default ones. */
export function useCategoryCatalog(): CategoryCatalog {
  const t = useTranslations("categories");
  const { categories } = useContext(ShopCatalogContext);
  return useMemo(() => new CategoryCatalog(categories, (key) => categoryNameOf(t, key)), [categories, t]);
}

/** Adds a category the person just created, so it can be chosen at once. */
export function useAddCategory(): (category: CategoryRow) => void {
  return useContext(ShopCatalogContext).addCategory;
}

/** The shop's products (none in guest mode). */
export function useProducts(): readonly Product[] {
  return useContext(ShopCatalogContext).products;
}

/** One product by id, or `undefined` (an entry may point to a product removed long ago). */
export function useProduct(id: string | null | undefined): Product | undefined {
  const products = useProducts();
  return useMemo(() => (id ? products.find((product) => product.id === id) : undefined), [products, id]);
}
