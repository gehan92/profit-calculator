"use client";

import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { getCalculator } from "@/config/calculators";
import { absoluteUrl } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { parseAmount } from "@/lib/amount-input";
import { breakEven, DEFAULT_OPEN_DAYS } from "@/lib/calc";
import { Money } from "@/lib/money";
import { MoneyInput, NumberField } from "./number-field";
import { ResultActions } from "./result-actions";
import { ResultCard } from "./result-card";
import { useCalcFormat } from "./use-calc-format";
import { useRememberedState } from "./use-remembered-state";

// ------------------------------------------------------------------ state

const formSchema = z.object({
  fixed: z.string(),
  margin: z.string(),
  days: z.string(),
});

type BreakEvenForm = z.infer<typeof formSchema>;

const INITIAL_FORM: BreakEvenForm = { fixed: "", margin: "", days: "" };

const STORAGE_KEY = "calc:breakEven:v1";

/** A month has at most 31 days. */
const MAX_OPEN_DAYS = 31;

/** Margin must be above 0% (otherwise you never break even) and at most 100%. */
function readMargin(value: string): { pct: number | null; invalid: boolean } {
  const pct = parseAmount(value);
  if (pct === null) return { pct: null, invalid: false };
  return pct > 0 && pct <= 100 ? { pct, invalid: false } : { pct: null, invalid: true };
}

/** Open days: empty means 26 (Part D1 default); otherwise a whole number from 1 to 31. */
function readOpenDays(value: string): { days: number | null; invalid: boolean } {
  const days = parseAmount(value);
  if (days === null) return { days: DEFAULT_OPEN_DAYS, invalid: false };
  return days >= 1 && days <= MAX_OPEN_DAYS
    ? { days, invalid: false }
    : { days: null, invalid: true };
}

/**
 * "Sales needed" is shown in whole rupees (11,538, not 11,538.46), as in the
 * Part D1 example; nobody plans their day's sales to the cent.
 */
function toWholeUnits(cents: number): number {
  return Math.round(cents / 100) * 100;
}

// -------------------------------------------------------------- component

/**
 * Break-even calculator (Part D1).
 * Monthly = Fixed ÷ (Margin % ÷ 100). Daily = Monthly ÷ open days.
 */
export function BreakEvenCalculator() {
  const t = useTranslations("calc.breakEven");
  const tUi = useTranslations("calcUi");
  const locale = useLocale();
  const format = useCalcFormat();
  const [form, setForm, resetForm] = useRememberedState(STORAGE_KEY, formSchema, INITIAL_FORM);

  // ---- maths (all in cents)
  const fixed = Money.parse(form.fixed);
  const margin = readMargin(form.margin);
  const openDays = readOpenDays(form.days);
  const result =
    fixed && margin.pct !== null && openDays.days !== null
      ? breakEven(fixed.cents, margin.pct, openDays.days)
      : null;

  // ---- text
  const monthlyText = result ? format.money(toWholeUnits(result.monthlyCents)) : null;
  const dailyText = result ? format.money(toWholeUnits(result.dailyCents)) : null;

  const shareText =
    result && fixed && margin.pct !== null && monthlyText && dailyText
      ? t("share", {
          fixed: format.money(fixed.cents),
          margin: format.percent(margin.pct),
          monthly: monthlyText,
          daily: dailyText,
          link: absoluteUrl(locale, getCalculator("breakEven").href),
        })
      : null;

  function update(field: keyof BreakEvenForm) {
    return (value: string) => setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <section
        aria-labelledby="break-even-inputs-title"
        className="space-y-6 rounded-2xl border bg-background p-5 sm:p-6"
      >
        <h2 id="break-even-inputs-title" className="sr-only">
          {tUi("inputsTitle")}
        </h2>

        <MoneyInput
          id="fixed"
          label={t("fixed")}
          value={form.fixed}
          onValueChange={update("fixed")}
          hint={t("fixedHint")}
        />
        <NumberField
          id="margin"
          label={t("margin")}
          value={form.margin}
          onValueChange={update("margin")}
          suffix="%"
          groupThousands={false}
          maxWholeDigits={3}
          invalid={margin.invalid}
          hint={
            margin.invalid
              ? t("marginInvalid")
              : t.rich("marginHint", {
                  link: (chunks) => (
                    <Link
                      href={getCalculator("margin").href}
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      {chunks}
                    </Link>
                  ),
                })
          }
        />
        <NumberField
          id="days"
          label={t("days")}
          value={form.days}
          onValueChange={update("days")}
          placeholder={String(DEFAULT_OPEN_DAYS)}
          maxDecimals={0}
          maxWholeDigits={2}
          invalid={openDays.invalid}
          hint={openDays.invalid ? t("daysInvalid") : t("daysHint")}
        />
      </section>

      <div className="lg:sticky lg:top-24">
        <ResultCard
          tone="neutral"
          label={t("result")}
          amount={monthlyText}
          emptyText={t("empty")}
          details={
            result && dailyText && openDays.days !== null
              ? [{ label: t("perDay", { days: openDays.days }), value: dailyText }]
              : []
          }
          tip={result ? t("explain") : undefined}
        >
          <ResultActions calculator="breakEven" shareText={shareText} onReset={resetForm} />
        </ResultCard>
      </div>
    </div>
  );
}
