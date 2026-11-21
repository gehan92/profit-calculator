"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsBrowser } from "@/components/use-is-browser";
import { axisTickFormatter } from "@/lib/chart-axis";
import { dayOfMonth, type IsoDate } from "@/lib/dates";
import type { DaySummary } from "@/lib/entries/monthly-summary";

/** Words and formats the chart needs; the screen supplies them in the person's language. */
export interface DailyBarChartLabels {
  profit: string;
  loss: string;
  income: string;
  expenses: string;
  /** "Thu 5 Nov" */
  date: (date: IsoDate) => string;
  /** "Rs 8,500" for an amount in cents (no sign). */
  money: (cents: number) => string;
}

interface DailyBarChartProps {
  days: readonly DaySummary[];
  labels: DailyBarChartLabels;
  /** Read by screen readers instead of the picture; the "Entries by day" list holds the numbers. */
  ariaLabel: string;
}

const CHART_HEIGHT = 220;
const MAX_BAR_WIDTH = 24;
const CORNER_RADIUS = 4;

/**
 * Daily profit as a bar chart (Part E3 `DailyBarChart`): a green bar for a
 * profit day and a red bar for a loss day, one bar per day of the month.
 *
 * Follows the chart rules: bars at most 24px thick with the 4px rounded end
 * only on the data side, hairline grid, one axis, a tooltip on hover, focus
 * and touch. Colour is never the only sign: a loss bar hangs below the zero
 * line and the tooltip says "Loss". The numbers are also in the "Entries by
 * day" list under the chart.
 */
export function DailyBarChart({ days, labels, ariaLabel }: DailyBarChartProps) {
  const mounted = useIsBrowser();

  const data = days.map((day) => ({ ...day, day: dayOfMonth(day.date), profit: day.profitCents / 100 }));
  const largest = Math.max(0, ...data.map((day) => Math.abs(day.profit)));
  const formatTick = axisTickFormatter(largest);

  return (
    <div role="img" aria-label={ariaLabel} className="text-xs text-muted-foreground">
      {mounted ? (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            barCategoryGap="15%"
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis
              dataKey="day"
              ticks={tickDays(data.length)}
              interval={0}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickMargin={6}
            />
            <YAxis
              width={44}
              tickCount={5}
              tickFormatter={formatTick}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.7 }}
              content={(props) => <DayTooltip {...props} labels={labels} />}
              isAnimationActive={false}
            />
            <Bar
              dataKey="profit"
              maxBarSize={MAX_BAR_WIDTH}
              shape={DayBar}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Skeleton aria-hidden="true" className="w-full rounded-xl" style={{ height: CHART_HEIGHT }} />
      )}
    </div>
  );
}

/** The days labelled under the bars: 1, 5, 10 … and the last day, without crowding the end. */
function tickDays(count: number): number[] {
  const ticks = [1, 5, 10, 15, 20, 25].filter((day) => day < count - 2);
  return [...ticks, count];
}

/**
 * One bar: green above the zero line, red below it, with the rounded 4px end
 * only on the data side and a square foot on the zero line.
 */
function DayBar({ x, y, width, height, value }: BarShapeProps) {
  const profit = typeof value === "number" ? value : 0;
  const size = Math.abs(height);
  if (profit === 0 || size === 0) return null;

  const radius = Math.min(CORNER_RADIUS, width / 2, size);
  const top = Math.min(y, y + height);
  const bottom = top + size;
  const right = x + width;

  // The rounded end is the top for a profit bar, the bottom for a loss bar.
  const path =
    profit > 0
      ? `M${x},${bottom} V${top + radius} Q${x},${top} ${x + radius},${top} H${right - radius} Q${right},${top} ${right},${top + radius} V${bottom} Z`
      : `M${x},${top} V${bottom - radius} Q${x},${bottom} ${x + radius},${bottom} H${right - radius} Q${right},${bottom} ${right},${bottom - radius} V${top} Z`;

  return <path d={path} style={{ fill: profit > 0 ? "var(--profit)" : "var(--loss)" }} />;
}

type DayPoint = DaySummary & { day: number; profit: number };

function DayTooltip({
  active,
  payload,
  labels,
}: TooltipContentProps & { labels: DailyBarChartLabels }) {
  const point = active ? (payload?.[0]?.payload as DayPoint | undefined) : undefined;
  if (!point) return null;

  const isLoss = point.profitCents < 0;
  return (
    <div className="rounded-xl border bg-background px-3 py-2 text-sm shadow-lg">
      <p className="text-xs text-muted-foreground">{labels.date(point.date)}</p>
      <p className="money mt-0.5 text-base font-semibold text-foreground">
        {isLoss ? "−" : ""}
        {labels.money(Math.abs(point.profitCents))}
        <span className="ml-2 text-xs font-medium text-muted-foreground">
          {isLoss ? labels.loss : labels.profit}
        </span>
      </p>
      {point.count > 0 && (
        <p className="money mt-1 text-xs text-muted-foreground">
          {labels.income} {labels.money(point.incomeCents)} · {labels.expenses}{" "}
          {labels.money(point.expenseCents)}
        </p>
      )}
    </div>
  );
}
