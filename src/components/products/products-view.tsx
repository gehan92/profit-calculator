"use client";

import { PackageIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/calculators/segmented-control";
import { useCalcFormat } from "@/components/calculators/use-calc-format";
import { useProducts } from "@/components/shop-catalog-context";
import { Button } from "@/components/ui/button";
import {
  FREE_PRODUCT_LIMIT,
  groupByCompany,
  marginHealth,
  productMargin,
  type MarginHealth,
  type Product,
  type ProductKind,
} from "@/lib/products/product";
import { cn } from "@/lib/utils";
import { ProductFormSheet } from "./product-form-sheet";

interface ProductsViewProps {
  /** Company names used before (for the type-ahead). */
  companyNames: readonly string[];
  /** Pro has no limit on active products; Free stops at 20. */
  isPro: boolean;
}

/** Show the search box once the list is long enough to need it. */
const SEARCH_FROM = 8;

/**
 * The Products screen (Part D8, Owner): "Made by my shop" and "From a
 * company" tabs, a search box for long lists, each product with its cost,
 * price and margin, put-away products behind a switch, and the Free plan's
 * 20-product limit shown only when it matters (the upgrade message appears at
 * the limit, never before).
 */
export function ProductsView({ companyNames, isPro }: ProductsViewProps) {
  const t = useTranslations("products");
  const products = useProducts();
  const [kind, setKind] = useState<ProductKind>("own");
  const [search, setSearch] = useState("");
  const [showPutAway, setShowPutAway] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const activeCount = products.filter((product) => !product.archived).length;
  const limitReached = !isPro && activeCount >= FREE_PRODUCT_LIMIT;
  const putAwayCount = products.filter((product) => product.archived).length;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter(
      (product) =>
        product.kind === kind &&
        (showPutAway || !product.archived) &&
        (needle === "" || `${product.name} ${product.companyName ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [products, kind, search, showPutAway]);

  const ofKind = products.filter((product) => product.kind === kind && !product.archived).length;
  const grouped = kind === "company" ? groupByCompany(visible) : new Map([["", visible]]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {isPro ? t("countPro", { count: activeCount }) : t("count", { count: activeCount, limit: FREE_PRODUCT_LIMIT })}
        </p>
        <Button type="button" className="h-12 px-5 text-base" disabled={limitReached} onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {t("add")}
        </Button>
      </div>

      {limitReached && (
        <div role="status" className="space-y-1 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <p className="font-semibold">{t("limitTitle")}</p>
          <p className="text-sm text-pretty">{t("limitBody")}</p>
        </div>
      )}

      <SegmentedControl
        name="product-tab"
        legend={t("title")}
        options={[
          { value: "own", label: t("tabOwn") },
          { value: "company", label: t("tabCompany") },
        ]}
        value={kind}
        onValueChange={setKind}
      />

      {products.length >= SEARCH_FROM && (
        <div className="relative">
          <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            className="h-14 w-full rounded-xl border border-input bg-background pr-4 pl-12 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          kind={kind}
          searching={search.trim() !== ""}
          search={search.trim()}
          hasAny={ofKind > 0}
          onAdd={limitReached ? undefined : () => setEditing("new")}
        />
      ) : (
        <div className="space-y-5">
          {[...grouped.entries()].map(([company, items]) => (
            <section key={company || "none"} aria-label={company || undefined} className="space-y-2">
              {kind === "company" && (
                <h2 className="px-1 text-sm font-semibold text-muted-foreground">{company || t("companyNone")}</h2>
              )}
              <ul className="space-y-2">
                {items.map((product) => (
                  <li key={product.id}>
                    <ProductRow product={product} onSelect={() => setEditing(product)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {putAwayCount > 0 && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={showPutAway}
            onChange={(event) => setShowPutAway(event.target.checked)}
            className="size-5 accent-primary"
          />
          {t("showPutAway")} ({putAwayCount})
        </label>
      )}

      <ProductFormSheet product={editing} companyNames={companyNames} defaultKind={kind} onClose={() => setEditing(null)} />
    </div>
  );
}

const HEALTH_CLASS: Record<MarginHealth, string> = {
  good: "bg-profit/10 text-profit",
  thin: "bg-warning/15 text-warning-foreground",
  loss: "bg-loss/10 text-loss",
  unknown: "bg-muted text-muted-foreground",
};

function ProductRow({ product, onSelect }: { product: Product; onSelect: () => void }) {
  const t = useTranslations("products");
  const tUnits = useTranslations("units");
  const { money, percent } = useCalcFormat();

  const health = marginHealth(product);
  const { marginPct } = productMargin(product);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border bg-background p-3 text-left transition-colors",
        "hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        product.archived && "opacity-70",
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <PackageIcon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{product.name}</span>
          {product.archived && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {t("putAwayBadge")}
            </span>
          )}
        </span>
        <span className="money block truncate text-sm text-muted-foreground">
          {t("cost", { amount: money(product.costCents) })} · {t("price", { amount: money(product.priceCents) })} / {tUnits(product.unit)}
        </span>
      </span>
      <span className={cn("money shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:text-sm", HEALTH_CLASS[health])}>
        {health === "unknown" ? t("noPrice") : health === "loss" ? t("loss") : t("margin", { percent: percent(marginPct ?? 0) })}
      </span>
    </button>
  );
}

function EmptyState({
  kind,
  searching,
  search,
  hasAny,
  onAdd,
}: {
  kind: ProductKind;
  searching: boolean;
  search: string;
  hasAny: boolean;
  onAdd?: () => void;
}) {
  const t = useTranslations("products");

  return (
    <div className="rounded-2xl border border-dashed bg-background p-8 text-center">
      <PackageIcon aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
      {searching && hasAny ? (
        <p className="mt-3 text-pretty font-semibold">{t("noMatch", { search })}</p>
      ) : (
        <>
          <p className="mt-3 font-semibold">{kind === "own" ? t("emptyOwnTitle") : t("emptyCompanyTitle")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-muted-foreground">
            {kind === "own" ? t("emptyOwnBody") : t("emptyCompanyBody")}
          </p>
          {onAdd && (
            <Button type="button" className="mt-4 h-12 px-6 text-base" onClick={onAdd}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              {t("add")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
