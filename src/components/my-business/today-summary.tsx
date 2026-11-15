"use client";

import { useTranslations } from "next-intl";
import { useCalcFormat } from "@/components/calculators/use-calc-format";
import type { Totals } from "@/lib/entries/entry-book";
import { cn } from "@/lib/utils";

interface TodaySummaryProps {
  today: Totals;
  month: Totals;
}

/**
 * "TODAY'S PROFIT Rs 8,500 · This month: Rs 64,200" (Part C2 Owner home
 * wireframe). Green with the word Profit, or red with the word Loss, as on
 * the calculators: colour alone is never the only sign.
 */
export function TodaySummary({ today, month }: TodaySummaryProps) {
  const t = useTranslations("myBusiness");
  const { money } = useCalcFormat();
  const isLoss = today.profitCents < 0;
  const monthIsLoss = month.profitCents < 0;

  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className="space-y-4 rounded-2xl border bg-background p-5 shadow-lg shadow-primary/5 sm:p-6"
    >
      <div className={cn("rounded-xl p-5", isLoss ? "bg-loss/10" : "bg-profit/10")}>
        <h2
          className={cn(
            "text-sm font-semibold tracking-wide uppercase",
            isLoss ? "text-loss" : "text-profit-foreground",
          )}
        >
          {isLoss ? t("todayLoss") : t("todayProfit")}
        </h2>
        <p
          className={cn(
            "money mt-1 text-[2.5rem] leading-none font-bold break-all",
            isLoss ? "text-loss" : "text-profit",
          )}
        >
          {money(Math.abs(today.profitCents))}
        </p>
      </div>

      <dl className="grid grid-cols-2 divide-x rounded-xl border">
        <div className="space-y-1 px-4 py-3">
          <dt className="text-sm text-muted-foreground">{t("income")}</dt>
          <dd className="money text-base font-semibold break-all">{money(today.incomeCents)}</dd>
        </div>
        <div className="space-y-1 px-4 py-3">
          <dt className="text-sm text-muted-foreground">{t("expenses")}</dt>
          <dd className="money text-base font-semibold break-all">{money(today.expenseCents)}</dd>
        </div>
      </dl>

      <p className={cn("text-base font-medium", monthIsLoss && "text-loss")}>
        {monthIsLoss
          ? t("monthLoss", { amount: money(Math.abs(month.profitCents)) })
          : t("monthProfit", { amount: money(month.profitCents) })}
      </p>
    </section>
  );
}
