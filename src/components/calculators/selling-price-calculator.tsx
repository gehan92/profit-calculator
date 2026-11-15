"use client";

import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { getCalculator } from "@/config/calculators";
import { absoluteUrl } from "@/config/site";
import { parseAmount } from "@/lib/amount-input";
import { margin, sellingPrice, type PriceMode, type RoundTo } from "@/lib/calc";
import { Money } from "@/lib/money";
import { MoneyInput, NumberField } from "./number-field";
import { ResultActions } from "./result-actions";
import { ResultCard, type ResultDetail } from "./result-card";
import { SegmentedControl } from "./segmented-control";
import { useCalcFormat } from "./use-calc-format";
import { useRememberedState } from "./use-remembered-state";

// ------------------------------------------------------------------ state

/** Rounding choices (Part D1: none / 5 / 10), stored by name, used in cents. */
const ROUNDING = { none: 0, five: 500, ten: 1000 } as const satisfies Record<string, RoundTo>;
type Rounding = keyof typeof ROUNDING;

const formSchema = z.object({
  cost: z.string(),
  pct: z.string(),
  mode: z.enum(["markup", "margin"]),
  rounding: z.enum(["none", "five", "ten"]),
});

type PriceForm = z.infer<typeof formSchema>;

/** Markup is the default mode (Part D1). */
const INITIAL_FORM: PriceForm = { cost: "", pct: "", mode: "markup", rounding: "none" };

const STORAGE_KEY = "calc:price:v1";

// -------------------------------------------------------------- component

/**
 * Selling price calculator (Part D1).
 * Markup: Price = Cost × (1 + p ÷ 100). Margin: Price = Cost ÷ (1 − p ÷ 100), p < 100.
 * Optional rounding up to the next Rs 5 or Rs 10.
 */
export function SellingPriceCalculator() {
  const t = useTranslations("calc.price");
  const tUi = useTranslations("calcUi");
  const locale = useLocale();
  const format = useCalcFormat();
  const [form, setForm, resetForm] = useRememberedState(STORAGE_KEY, formSchema, INITIAL_FORM);

  // ---- maths (all in cents)
  const cost = Money.parse(form.cost);
  const pct = parseAmount(form.pct);
  // "Margin mode refuses 100% or more with a friendly message" (Part D1 acceptance).
  const marginTooHigh = form.mode === "margin" && pct !== null && pct >= 100;
  const canCalculate = cost !== null && pct !== null && !marginTooHigh;

  const exactPrice = canCalculate ? sellingPrice(cost.cents, pct, form.mode) : null;
  const price = canCalculate
    ? sellingPrice(cost.cents, pct, form.mode, ROUNDING[form.rounding])
    : null;
  // Margin and markup of the final (rounded) price, so the numbers match what the customer pays.
  const finalMargin = canCalculate && price !== null ? margin(cost.cents, price) : null;

  // ---- text
  const priceText = price !== null ? format.money(price) : null;
  const pctText = pct !== null ? format.percent(pct) : "";

  const details: ResultDetail[] = [];
  if (price !== null && exactPrice !== null && finalMargin) {
    if (price !== exactPrice) {
      details.push({ label: t("beforeRounding"), value: format.money(exactPrice) });
    }
    details.push({ label: t("profitPerItem"), value: format.money(finalMargin.perItemCents) });
    if (finalMargin.marginPct !== null) {
      details.push({ label: t("marginPct"), value: format.percent(finalMargin.marginPct) });
    }
    if (finalMargin.markupPct !== null) {
      details.push({ label: t("markupPct"), value: format.percent(finalMargin.markupPct) });
    }
  }

  const shareText =
    priceText && cost
      ? t(form.mode === "markup" ? "shareMarkup" : "shareMargin", {
          cost: format.money(cost.cents),
          pct: pctText,
          price: priceText,
          link: absoluteUrl(locale, getCalculator("price").href),
        })
      : null;

  const modeOptions = [
    { value: "markup", label: t("modeMarkup") },
    { value: "margin", label: t("modeMargin") },
  ] as const satisfies readonly { value: PriceMode; label: string }[];

  const roundingOptions = [
    { value: "none", label: t("roundNone") },
    { value: "five", label: t("roundTo", { amount: format.money(ROUNDING.five) }) },
    { value: "ten", label: t("roundTo", { amount: format.money(ROUNDING.ten) }) },
  ] as const satisfies readonly { value: Rounding; label: string }[];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <section
        aria-labelledby="price-inputs-title"
        className="space-y-6 rounded-2xl border bg-background p-5 sm:p-6"
      >
        <h2 id="price-inputs-title" className="sr-only">
          {tUi("inputsTitle")}
        </h2>

        <MoneyInput
          id="cost"
          label={t("cost")}
          value={form.cost}
          onValueChange={(cost) => setForm((current) => ({ ...current, cost }))}
        />

        <NumberField
          id="pct"
          label={t("pct")}
          value={form.pct}
          onValueChange={(pct) => setForm((current) => ({ ...current, pct }))}
          suffix="%"
          groupThousands={false}
          maxWholeDigits={4}
          invalid={marginTooHigh}
          hint={marginTooHigh ? t("marginTooHigh") : undefined}
        />

        <SegmentedControl
          name="price-mode"
          legend={t("mode")}
          options={modeOptions}
          value={form.mode}
          onValueChange={(mode) => setForm((current) => ({ ...current, mode }))}
          hint={form.mode === "markup" ? t("modeMarkupHelp") : t("modeMarginHelp")}
        />

        <SegmentedControl
          name="price-rounding"
          legend={t("round")}
          options={roundingOptions}
          value={form.rounding}
          onValueChange={(rounding) => setForm((current) => ({ ...current, rounding }))}
        />
      </section>

      <div className="lg:sticky lg:top-24">
        <ResultCard
          tone="neutral"
          label={t("result")}
          amount={priceText}
          emptyText={marginTooHigh ? t("marginTooHigh") : t("empty")}
          details={details}
        >
          <ResultActions calculator="price" shareText={shareText} onReset={resetForm} />
        </ResultCard>
      </div>
    </div>
  );
}
