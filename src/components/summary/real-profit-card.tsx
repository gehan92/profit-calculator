"use client";

import { CircleHelpIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { addEntry } from "@/actions/entries";
import { MoneyInput } from "@/components/calculators/number-field";
import { useCalcFormat } from "@/components/calculators/use-calc-format";
import { useToday } from "@/components/my-business/use-today";
import { useCategoryCatalog } from "@/components/shop-catalog-context";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { CategoryView } from "@/lib/categories/category";
import { addDays, firstDayOfMonth, monthOf, shiftMonth, type IsoDate } from "@/lib/dates";
import type { Totals } from "@/lib/entries/entry-book";
import type { HiddenCost } from "@/lib/entries/monthly-summary";
import { Money } from "@/lib/money";
import { dashboardRoutes } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface RealProfitCardProps {
  month: string;
  totals: Totals;
  hiddenCosts: readonly HiddenCost[];
  /** Owners can add the missing costs on the spot; Viewers only read. */
  canAdd: boolean;
}

/**
 * The Real profit card (Part D2 "Real profit"): cash profit, minus the costs
 * owners forget (family use, owner salary, wastage, transport), gives the real
 * profit: "Cash profit 110,000 → Real profit 72,000".
 *
 * Those costs are not part of "Expenses" or "Profit", so each is taken off
 * once. If none is recorded this month, a checklist lets the Owner add them
 * right here.
 */
export function RealProfitCard({ month, totals, hiddenCosts, canAdd }: RealProfitCardProps) {
  const t = useTranslations("summary");
  const catalog = useCategoryCatalog();
  const { money } = useCalcFormat();
  const [whyOpen, setWhyOpen] = useState(false);
  const whyId = useId();

  const hasHiddenCosts = totals.hiddenCostCents > 0;
  const isLoss = totals.realProfitCents < 0;

  return (
    <section aria-labelledby="real-profit-title" className="space-y-4 rounded-2xl border bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="real-profit-title" className="text-lg font-semibold">
          {hasHiddenCosts && isLoss ? t("realLoss") : t("realProfit")}
        </h2>
        <Button
          type="button"
          variant="ghost"
          className="-mt-1 -mr-2 h-auto min-h-11 gap-1.5 px-3 py-2 text-muted-foreground"
          aria-expanded={whyOpen}
          aria-controls={whyId}
          onClick={() => setWhyOpen((open) => !open)}
        >
          <CircleHelpIcon aria-hidden="true" className="size-4" />
          {t("why")}
        </Button>
      </div>

      {whyOpen && (
        <p id={whyId} className="rounded-xl bg-muted p-4 text-sm text-pretty">
          {t("whyBody")}
        </p>
      )}

      {hasHiddenCosts ? (
        <>
          <p
            className={cn(
              "money rounded-xl p-4 text-3xl leading-none font-bold break-all",
              isLoss ? "bg-loss/10 text-loss" : "bg-profit/10 text-profit",
            )}
          >
            {money(Math.abs(totals.realProfitCents))}
          </p>

          <dl className="space-y-2 text-base">
            <div className="flex items-baseline justify-between gap-3">
              <dt>{t("cashProfit")}</dt>
              <dd className={cn("money font-semibold", totals.profitCents < 0 && "text-loss")}>
                {totals.profitCents < 0 ? "−" : ""}
                {money(Math.abs(totals.profitCents))}
              </dd>
            </div>
            {hiddenCosts
              .filter((cost) => cost.amountCents > 0)
              .map((cost) => (
                <div key={cost.category} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">− {catalog.label(cost.category, "expense")}</dt>
                  <dd className="money font-medium text-loss">{money(cost.amountCents)}</dd>
                </div>
              ))}
          </dl>

          {canAdd && (
            <Button asChild variant="outline" className="h-auto min-h-11 bg-background py-2 whitespace-normal">
              <Link href={`${dashboardRoutes.add}?type=expense`}>
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                {t("addAnotherCost")}
              </Link>
            </Button>
          )}
        </>
      ) : canAdd ? (
        <HiddenCostChecklist month={month} />
      ) : (
        <p className="text-sm text-pretty text-muted-foreground">{t("noHiddenCostsViewer")}</p>
      )}
    </section>
  );
}

/**
 * "What costs are missing?" (Part D2: "If none recorded: checklist with
 * quick-add"). Each row saves one expense for this month. It is dated today
 * for the current month and the last day of a past month.
 */
function HiddenCostChecklist({ month }: { month: string }) {
  const t = useTranslations("summary");
  const today = useToday();
  // The costs the owner has marked as hidden costs (Transport, Family use… unless changed in Settings → Categories).
  const hiddenCategories = useCategoryCatalog()
    .options("expense")
    .filter((category) => category.countsAs === "hidden_cost");

  // A past month has no "today": its costs go on the month's last day.
  const lastDay = addDays(firstDayOfMonth(shiftMonth(month, 1)), -1);
  const entryDate: IsoDate | null = today === null ? null : monthOf(today) === month ? today : lastDay;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{t("quickAddTitle")}</h3>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">{t("quickAddBody")}</p>
      </div>
      <ul className="space-y-4">
        {hiddenCategories.map((category) => (
          <li key={category.ref}>
            <QuickAddRow category={category} entryDate={entryDate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickAddRow({ category, entryDate }: { category: CategoryView; entryDate: IsoDate | null }) {
  const t = useTranslations("summary");
  const tEntry = useTranslations("entry");
  const tAddEntry = useTranslations("addEntry");
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const id = useId();

  async function save() {
    const amount = Money.parse(value);
    if (!amount || amount.cents <= 0 || entryDate === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);

    if (!navigator.onLine) {
      toast.error(tEntry("offlineAction"));
      return;
    }

    setSaving(true);
    try {
      const result = await addEntry(
        { type: "expense", category: category.ref, amountCents: amount.cents, entryDate, note: null, productId: null, quantity: null },
        crypto.randomUUID(),
      );
      if (result.ok) {
        toast.success(t("costAdded", { category: category.label }));
        // The page refreshes with the new totals and this checklist goes away.
      } else {
        toast.error(
          result.error === "notAllowed"
            ? tAddEntry("notAllowed")
            : result.error === "tooMany"
              ? tEntry("tooMany")
              : tAddEntry("saveFailed"),
        );
      }
    } catch {
      toast.error(tAddEntry("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2"
    >
      <MoneyInput
        id={id}
        label={category.label}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          setInvalid(false);
        }}
        enterKeyHint="done"
        invalid={invalid}
        hint={invalid ? tEntry("amountRequired") : undefined}
      />
      <Button type="submit" className="mt-8 h-14 px-5 text-base" disabled={saving || entryDate === null}>
        {saving ? t("adding") : t("add")}
      </Button>
    </form>
  );
}
