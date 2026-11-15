"use client";

import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { getCalculator } from "@/config/calculators";
import { absoluteUrl } from "@/config/site";
import { parseAmount } from "@/lib/amount-input";
import { margin } from "@/lib/calc";
import { Money } from "@/lib/money";
import { MoneyInput, NumberField } from "./number-field";
import { ResultActions } from "./result-actions";
import { ResultCard } from "./result-card";
import { useCalcFormat } from "./use-calc-format";
import { useRememberedState } from "./use-remembered-state";

// ------------------------------------------------------------------ state

const formSchema = z.object({
  cost: z.string(),
  price: z.string(),
  quantity: z.string(),
});

type MarginForm = z.infer<typeof formSchema>;

const INITIAL_FORM: MarginForm = { cost: "", price: "", quantity: "" };

const STORAGE_KEY = "calc:margin:v1";

/** Quantity is 1 when the field is empty or 0 (Part D1: "quantity (default 1)"). */
function readQuantity(value: string): number {
  const quantity = parseAmount(value);
  return quantity && quantity > 0 ? quantity : 1;
}

// -------------------------------------------------------------- component

/**
 * Margin calculator (Part D1).
 * Per item = Price − Cost. Margin % = (Price − Cost) ÷ Price × 100.
 * Markup % = (Price − Cost) ÷ Cost × 100. Total = Per item × Qty.
 */
export function MarginCalculator() {
  const t = useTranslations("calc.margin");
  const tUi = useTranslations("calcUi");
  const locale = useLocale();
  const format = useCalcFormat();
  const [form, setForm, resetForm] = useRememberedState(STORAGE_KEY, formSchema, INITIAL_FORM);

  // ---- maths (all in cents)
  const cost = Money.parse(form.cost);
  const price = Money.parse(form.price);
  const quantity = readQuantity(form.quantity);
  const result = cost && price ? margin(cost.cents, price.cents, quantity) : null;
  const isLoss = result !== null && result.perItemCents < 0;

  // ---- text
  const notAvailable = "—";
  const amountText = result ? format.money(Math.abs(result.perItemCents)) : null;
  const marginText = result?.marginPct != null ? format.percent(result.marginPct) : notAvailable;
  const markupText = result?.markupPct != null ? format.percent(result.markupPct) : notAvailable;

  const shareText =
    result && cost && price && amountText
      ? t(isLoss ? "shareLoss" : "shareProfit", {
          cost: format.money(cost.cents),
          price: format.money(price.cents),
          amount: amountText,
          margin: marginText,
          link: absoluteUrl(locale, getCalculator("margin").href),
        })
      : null;

  function update(field: keyof MarginForm) {
    return (value: string) => setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <section
        aria-labelledby="margin-inputs-title"
        className="space-y-6 rounded-2xl border bg-background p-5 sm:p-6"
      >
        <h2 id="margin-inputs-title" className="sr-only">
          {tUi("inputsTitle")}
        </h2>

        <MoneyInput id="cost" label={t("cost")} value={form.cost} onValueChange={update("cost")} />
        <MoneyInput
          id="price"
          label={t("price")}
          value={form.price}
          onValueChange={update("price")}
        />
        <NumberField
          id="quantity"
          label={t("quantity")}
          value={form.quantity}
          onValueChange={update("quantity")}
          placeholder="1"
          maxDecimals={0}
          maxWholeDigits={7}
          hint={t("quantityHint")}
        />

        <p className="rounded-xl bg-accent p-4 text-sm text-accent-foreground">
          {t("marginVsMarkup")}
        </p>
      </section>

      <div className="lg:sticky lg:top-24">
        <ResultCard
          tone={isLoss ? "loss" : "profit"}
          label={isLoss ? t("lossPerItem") : t("profitPerItem")}
          amount={amountText}
          emptyText={t("empty")}
          details={
            result
              ? [
                  { label: t("marginPct"), value: marginText },
                  { label: t("markupPct"), value: markupText },
                  {
                    label: t(isLoss ? "totalLoss" : "totalProfit", { quantity }),
                    value: format.money(Math.abs(result.totalCents)),
                  },
                ]
              : []
          }
        >
          <ResultActions shareText={shareText} onReset={resetForm} />
        </ResultCard>
      </div>
    </div>
  );
}
