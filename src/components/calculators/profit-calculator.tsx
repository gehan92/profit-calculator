"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { PROFIT_CALCULATOR_COSTS, type ProfitCalculatorCost } from "@/config/categories";
import { getCalculator } from "@/config/calculators";
import { absoluteUrl } from "@/config/site";
import { biggestCost, profit } from "@/lib/calc";
import { Money } from "@/lib/money";
import { MoneyInput } from "./number-field";
import { ResultActions } from "./result-actions";
import { ResultCard } from "./result-card";
import { useCalcFormat } from "./use-calc-format";
import { useRememberedState } from "./use-remembered-state";

// ------------------------------------------------------------------ state

const costKey = z.enum(PROFIT_CALCULATOR_COSTS);

const formSchema = z.object({
  sales: z.string(),
  /** Which cost rows are shown, in order. */
  rows: z.array(costKey),
  costs: z.partialRecord(costKey, z.string()),
});

type ProfitForm = z.infer<typeof formSchema>;

/** Starts like the wireframe in Part C2: sales, stock, other costs. */
const INITIAL_FORM: ProfitForm = { sales: "", rows: ["stock", "other"], costs: {} };

const STORAGE_KEY = "calc:profit:v1";

// -------------------------------------------------------------- component

/** Profit calculator (Part D1): Profit = Sales − Σ costs. */
export function ProfitCalculator() {
  const t = useTranslations("calc.profit");
  const tUi = useTranslations("calcUi");
  const tCategory = useTranslations("categories");
  const locale = useLocale();
  const format = useCalcFormat();
  const [form, setForm, resetForm] = useRememberedState(STORAGE_KEY, formSchema, INITIAL_FORM);

  // ---- maths (all in cents)
  const sales = Money.parse(form.sales);
  const costs = form.rows.map((key) => ({
    key,
    cents: Money.parse(form.costs[key] ?? "")?.cents ?? 0,
  }));
  const result = sales ? profit(sales.cents, costs.map((cost) => cost.cents)) : null;
  const tip = sales ? biggestCost(sales.cents, costs) : null;

  // ---- text
  const amountText = result ? format.money(Math.abs(result.profitCents)) : null;
  const pctText = result?.pct != null ? format.percent(Math.abs(result.pct)) : undefined;

  // WhatsApp text from Part D1: "My profit today: Rs 8,500 (34%). Calculate yours free: <link>"
  const link = absoluteUrl(locale, getCalculator("profit").href);
  let shareText: string | null = null;
  if (result && amountText) {
    if (result.isLoss) shareText = t("shareLoss", { amount: amountText, link });
    else if (pctText) shareText = t("shareProfit", { amount: amountText, pct: pctText, link });
    else shareText = t("shareProfitNoPct", { amount: amountText, link });
  }

  // ---- actions
  const hiddenCosts = PROFIT_CALCULATOR_COSTS.filter((key) => !form.rows.includes(key));

  function setCost(key: ProfitCalculatorCost, value: string) {
    setForm((current) => ({ ...current, costs: { ...current.costs, [key]: value } }));
  }

  function addCost(key: ProfitCalculatorCost) {
    setForm((current) => ({ ...current, rows: [...current.rows, key] }));
    // Move the cursor straight into the new field.
    requestAnimationFrame(() => document.getElementById(`cost-${key}`)?.focus());
  }

  function removeCost(key: ProfitCalculatorCost) {
    setForm((current) => {
      const remainingCosts = { ...current.costs };
      delete remainingCosts[key];
      return { ...current, rows: current.rows.filter((row) => row !== key), costs: remainingCosts };
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <section
        aria-labelledby="profit-inputs-title"
        className="space-y-6 rounded-2xl border bg-background p-5 sm:p-6"
      >
        <h2 id="profit-inputs-title" className="sr-only">
          {tUi("inputsTitle")}
        </h2>

        <MoneyInput
          id="sales"
          label={t("sales")}
          value={form.sales}
          onValueChange={(sales) => setForm((current) => ({ ...current, sales }))}
        />

        <fieldset className="space-y-4">
          <legend className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("costsTitle")}
          </legend>

          {form.rows.map((key) => (
            <MoneyInput
              key={key}
              id={`cost-${key}`}
              label={tCategory(key)}
              value={form.costs[key] ?? ""}
              onValueChange={(value) => setCost(key, value)}
              labelAction={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCost(key)}
                  aria-label={t("removeCost", { cost: tCategory(key) })}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              }
            />
          ))}

          {hiddenCosts.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-sm text-muted-foreground">{t("addCost")}</p>
              <div className="flex flex-wrap gap-2">
                {hiddenCosts.map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full px-4"
                    onClick={() => addCost(key)}
                  >
                    <PlusIcon data-icon="inline-start" aria-hidden="true" />
                    {tCategory(key)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      </section>

      <div className="lg:sticky lg:top-24">
        <ResultCard
          tone={result?.isLoss ? "loss" : "profit"}
          label={result?.isLoss ? tUi("loss") : tUi("profit")}
          amount={amountText}
          aside={pctText}
          emptyText={t("empty")}
          details={
            result && sales
              ? [
                  { label: t("sales"), value: format.money(sales.cents) },
                  { label: t("totalCosts"), value: format.money(result.costsCents) },
                ]
              : []
          }
          tip={
            tip
              ? t("tip", { cost: tCategory(tip.key), pct: format.percent(tip.pctOfSales) })
              : undefined
          }
        >
          <ResultActions shareText={shareText} onReset={resetForm} />
        </ResultCard>
      </div>
    </div>
  );
}
