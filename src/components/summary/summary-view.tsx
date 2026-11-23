"use client";

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, InboxIcon, PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useCalcFormat } from "@/components/calculators/use-calc-format";
import { useToday } from "@/components/my-business/use-today";
import { useCategoryCatalog } from "@/components/shop-catalog-context";
import { useDateLabels } from "@/components/use-date-labels";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { monthOf, shiftMonth, type IsoDate } from "@/lib/dates";
import type { SummarySnapshot } from "@/lib/entries/monthly-summary";
import { can, dashboardRoutes, type MemberRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { DailyBarChart } from "./daily-bar-chart";
import { RealProfitCard } from "./real-profit-card";

interface SummaryViewProps {
  role: MemberRole;
  snapshot: SummarySnapshot;
  /** The month the page opens on, which the address leaves out. */
  defaultMonth: string;
  /** The month has more records than could be added up. */
  truncated: boolean;
}

/**
 * The monthly summary (Part D2 "Monthly summary", Part C2 wireframe):
 * month arrows, income / expenses / profit with the profit %, a bar chart of
 * the profit of each day, the top 3 costs, the real profit, the change since
 * last month and an "Entries by day" list. Owners and Viewers open it;
 * Viewers cannot add anything.
 *
 * All numbers come from one `MonthlySummary` on the server, so the cards, the
 * chart and the list always agree with the sum of the records.
 */
export function SummaryView({ role, snapshot, defaultMonth, truncated }: SummaryViewProps) {
  const t = useTranslations("summary");
  const tBusiness = useTranslations("myBusiness");
  const tCalc = useTranslations("calcUi");
  const tEntries = useTranslations("entries");
  const catalog = useCategoryCatalog();
  const format = useFormatter();
  const dates = useDateLabels();
  const { money } = useCalcFormat();
  const today = useToday();
  const tracked = useRef(false);

  // Only a label (the role), never an amount (Part F4.6).
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("summary_viewed", { role });
  }, [role]);

  const { month, totals, comparison } = snapshot;
  const isLoss = totals.profitCents < 0;
  const canAdd = can(role, "addEntry");

  const monthName = (value: string, style: "long" | "short") =>
    style === "long" ? dates.monthYear(value) : dates.monthShort(value);
  const dayName = (date: IsoDate) => dates.shortDay(date);
  // A real minus sign, as in the amounts next to it.
  const percent = (value: number, signed = false) =>
    format
      .number(value / 100, {
        style: "percent",
        maximumFractionDigits: 0,
        ...(signed && { signDisplay: "exceptZero" as const }),
      })
      .replace("-", "−");
  const linkTo = (target: string) =>
    target === defaultMonth ? dashboardRoutes.summary : `${dashboardRoutes.summary}?month=${target}`;

  const daysWithEntries = snapshot.days.filter((day) => day.count > 0).toReversed();

  return (
    <div className="space-y-5">
      {/* Month arrows */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border bg-background p-1.5">
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href={linkTo(shiftMonth(month, -1))} aria-label={tEntries("previousMonth")}>
            <ChevronLeftIcon aria-hidden="true" />
          </Link>
        </Button>
        <h2 aria-live="polite" className="text-lg font-semibold">
          {monthName(month, "long")}
        </h2>
        {today !== null && month < monthOf(today) ? (
          <Button asChild variant="ghost" size="icon" className="size-11">
            <Link href={linkTo(shiftMonth(month, 1))} aria-label={tEntries("nextMonth")}>
              <ChevronRightIcon aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <span aria-hidden="true" className="size-11" />
        )}
      </div>

      {truncated && (
        <p className="rounded-xl bg-warning/10 p-3 text-sm text-pretty">{t("truncated")}</p>
      )}

      {totals.count === 0 ? (
        <div className="rounded-2xl border border-dashed bg-background p-8 text-center">
          <InboxIcon aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">{tEntries("emptyMonth")}</p>
          {canAdd && (
            <Button asChild className="mt-4 h-auto min-h-11 py-2 whitespace-normal">
              <Link href={dashboardRoutes.add}>
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                {tEntries("addRecord")}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Income, expenses and profit */}
          <section
            aria-label={monthName(month, "long")}
            className="space-y-4 rounded-2xl border bg-background p-5 shadow-lg shadow-primary/5 sm:p-6"
          >
            <div className={cn("rounded-xl p-5", isLoss ? "bg-loss/10" : "bg-profit/10")}>
              <h3
                className={cn(
                  "text-sm font-semibold tracking-wide uppercase",
                  isLoss ? "text-loss" : "text-profit-foreground",
                )}
              >
                {isLoss ? tCalc("loss") : tCalc("profit")}
              </h3>
              <p
                className={cn(
                  "money mt-1 text-[2.5rem] leading-none font-bold break-all",
                  isLoss ? "text-loss" : "text-profit",
                )}
              >
                {money(Math.abs(totals.profitCents))}
              </p>
              {snapshot.profitPercent !== null && (
                <p className="mt-2 text-sm font-semibold">
                  {t("ofIncome", { percent: percent(snapshot.profitPercent) })}
                </p>
              )}
            </div>

            <dl className="grid grid-cols-2 divide-x rounded-xl border">
              <div className="space-y-1 px-4 py-3">
                <dt className="text-sm text-muted-foreground">{tBusiness("income")}</dt>
                <dd className="money text-base font-semibold break-all">{money(totals.incomeCents)}</dd>
              </div>
              <div className="space-y-1 px-4 py-3">
                <dt className="text-sm text-muted-foreground">{tBusiness("expenses")}</dt>
                <dd className="money text-base font-semibold break-all">{money(totals.expenseCents)}</dd>
              </div>
            </dl>

            {comparison && (
              <p
                className={cn(
                  "money text-sm font-semibold",
                  comparison.profitChangeCents < 0 ? "text-loss" : "text-profit-foreground",
                )}
              >
                {t(comparison.profitChangePercent === null ? "vsMonth" : "vsMonthPercent", {
                  month: monthName(comparison.month, "short"),
                  change: `${comparison.profitChangeCents < 0 ? "−" : "+"}${money(Math.abs(comparison.profitChangeCents))}`,
                  percent: comparison.profitChangePercent === null ? "" : percent(comparison.profitChangePercent, true),
                })}
              </p>
            )}
          </section>

          {/* Daily profit chart */}
          <section aria-labelledby="chart-title" className="space-y-3 rounded-2xl border bg-background p-5">
            <h3 id="chart-title" className="text-lg font-semibold">
              {t("chartTitle")}
            </h3>
            <DailyBarChart
              days={snapshot.days}
              ariaLabel={t("chartLabel", { month: monthName(month, "long") })}
              labels={{
                profit: tCalc("profit"),
                loss: tCalc("loss"),
                income: tBusiness("income"),
                expenses: tBusiness("expenses"),
                date: dayName,
                money,
              }}
            />
          </section>

          {/* Top costs */}
          <section aria-labelledby="top-costs-title" className="space-y-3 rounded-2xl border bg-background p-5">
            <h3 id="top-costs-title" className="text-lg font-semibold">
              {t("topCosts")}
            </h3>
            {snapshot.topCosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noCosts")}</p>
            ) : (
              <ul className="space-y-3">
                {snapshot.topCosts.map((cost) => (
                  <li key={cost.category} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{catalog.label(cost.category, "expense")}</span>
                      <span className="money text-sm text-muted-foreground">
                        {money(cost.amountCents)} · {percent(cost.percent)}
                      </span>
                    </div>
                    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(2, Math.min(100, cost.percent))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <RealProfitCard month={month} totals={totals} hiddenCosts={snapshot.hiddenCosts} canAdd={canAdd} />

          {/* Entries by day: the numbers behind the chart */}
          <details className="group rounded-2xl border bg-background">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
              {t("entriesByDay")}
              <ChevronDownIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t">
              <ul className="divide-y">
                {daysWithEntries.map((day) => (
                  <DayRow
                    key={day.date}
                    label={dayName(day.date)}
                    incomeCents={day.incomeCents}
                    expenseCents={day.expenseCents}
                    profitCents={day.profitCents}
                  />
                ))}
                <DayRow
                  label={t("monthTotal")}
                  incomeCents={totals.incomeCents}
                  expenseCents={totals.expenseCents}
                  profitCents={totals.profitCents}
                  total
                />
              </ul>
              <div className="border-t p-3">
                <Button asChild variant="ghost" className="h-auto min-h-11 w-full py-2 whitespace-normal">
                  <Link href={`${dashboardRoutes.entries}?month=${month}`}>{t("seeRecords")}</Link>
                </Button>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

/** One line of "Entries by day": the day (or the month total), its income and expenses, and its profit. */
function DayRow({
  label,
  incomeCents,
  expenseCents,
  profitCents,
  total = false,
}: {
  label: string;
  incomeCents: number;
  expenseCents: number;
  profitCents: number;
  total?: boolean;
}) {
  const tBusiness = useTranslations("myBusiness");
  const { money } = useCalcFormat();
  const isLoss = profitCents < 0;

  return (
    <li className={cn("flex items-start justify-between gap-3 px-5 py-3", total && "border-t-2 bg-card font-semibold")}>
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="money mt-0.5 text-xs font-normal text-muted-foreground">
          {tBusiness("income")} {money(incomeCents)} · {tBusiness("expenses")} {money(expenseCents)}
        </p>
      </div>
      <p className={cn("money shrink-0 text-base font-semibold", isLoss ? "text-loss" : "text-profit-foreground")}>
        {isLoss ? "−" : ""}
        {money(Math.abs(profitCents))}
      </p>
    </li>
  );
}
