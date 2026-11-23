"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { saveCategoryOrder } from "@/actions/categories";
import { SegmentedControl } from "@/components/calculators/segmented-control";
import { CategoryIcon } from "@/components/category-icon";
import { NewCategoryDialog } from "@/components/my-business/new-category-dialog";
import { useCategoryCatalog } from "@/components/shop-catalog-context";
import { Button } from "@/components/ui/button";
import type { EntryCategoryType } from "@/config/categories";
import type { CategoryView } from "@/lib/categories/category";
import { CategoryEditSheet } from "./category-edit-sheet";

/**
 * Settings → Categories (Part D9): the kinds of money in and money out the shop
 * records. Add your own, rename, hide, reorder (the first ones show first in
 * Add entry) and mark costs as hidden costs for the Real profit check. The
 * original categories can be renamed or hidden but not removed, and records
 * never lose their category. Owner only.
 */
export function CategoriesManager() {
  const t = useTranslations("categoryManager");
  const catalog = useCategoryCatalog();
  const [type, setType] = useState<EntryCategoryType>("expense");
  const [editing, setEditing] = useState<CategoryView | null>(null);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState(false);

  const rows = catalog.all(type);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    const ids = rows.map((row) => row.id).filter((id): id is string => id !== null);
    [ids[index], ids[target]] = [ids[target], ids[index]];

    setMoving(true);
    const result = await saveCategoryOrder(ids).catch(() => null);
    setMoving(false);
    if (!result?.ok) toast.error(t(result && !result.ok && result.error === "tooMany" ? "tooMany" : "saveFailed"));
    // On success the page reloads the list in its new order.
  }

  return (
    <div className="space-y-5">
      <SegmentedControl
        name="category-kind"
        legend={t("title")}
        options={[
          { value: "expense", label: t("expenseTab") },
          { value: "income", label: t("incomeTab") },
        ]}
        value={type}
        onValueChange={setType}
      />

      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={row.ref} className="flex items-center gap-1 rounded-2xl border bg-background pr-1">
            <button
              type="button"
              aria-label={t("edit", { name: row.label })}
              onClick={() => setEditing(row)}
              className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
            >
              <CategoryIcon icon={row.icon} color={row.color} />
              <span className="min-w-0 flex-1">
                <span className={row.archived ? "line-clamp-2 block font-medium wrap-anywhere text-muted-foreground" : "line-clamp-2 block font-medium wrap-anywhere"}>
                  {row.label}
                </span>
                {(row.countsAs === "hidden_cost" || row.archived) && (
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {row.countsAs === "hidden_cost" && <Tag>{t("hiddenCostBadge")}</Tag>}
                    {row.archived && <Tag>{t("putAwayBadge")}</Tag>}
                  </span>
                )}
              </span>
            </button>
            <div className="flex shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-muted-foreground"
                aria-label={t("moveUp", { name: row.label })}
                disabled={moving || index === 0}
                onClick={() => void move(index, -1)}
              >
                <ArrowUpIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-muted-foreground"
                aria-label={t("moveDown", { name: row.label })}
                disabled={moving || index === rows.length - 1}
                onClick={() => void move(index, 1)}
              >
                <ArrowDownIcon aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" className="h-12 w-full border-dashed bg-background text-base" onClick={() => setCreating(true)}>
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        {t("newCategory")}
      </Button>

      <p className="text-sm text-pretty text-muted-foreground">{t("defaultsNote")}</p>

      <CategoryEditSheet category={editing} onClose={() => setEditing(null)} />
      <NewCategoryDialog open={creating} onOpenChange={setCreating} type={type} onCreated={() => {}} />
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{children}</span>;
}
