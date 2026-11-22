"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsBrowser } from "@/components/use-is-browser";
import { formatDayMonth, formatWeekdayDayMonth } from "@/lib/admin/format";

interface DailyCountChartProps {
  /** One point per day, oldest first: `date` is "2026-11-21". */
  data: readonly { date: string; value: number }[];
  /** What is counted, in the tooltip: "sign-ups", "active people". */
  unit: string;
  /** Read by screen readers instead of the picture. */
  ariaLabel: string;
}

const HEIGHT = 200;

/**
 * A bar for each day's count (Part C2 admin dashboard "chart, 30 days"):
 * one hue (the brand teal), thin bars with a rounded top, a hairline grid,
 * whole-number axis, and a tooltip on hover or focus. Two measures get two
 * charts, never one chart with two axes.
 */
export function DailyCountChart({ data, unit, ariaLabel }: DailyCountChartProps) {
  const browser = useIsBrowser();
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const last = data.length - 1;
  const ticks = data.filter((_, index) => index % 7 === 0 || index === last).map((point) => point.date);
  // Drop the second to last tick when it would touch the last one.
  const cleanTicks = ticks.length > 1 && last % 7 !== 0 && last % 7 < 3 ? [...ticks.slice(0, -2), ticks.at(-1)!] : ticks;

  return (
    <div role="img" aria-label={`${ariaLabel} Total: ${total}.`} className="text-xs text-muted-foreground">
      {browser ? (
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <BarChart data={[...data]} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%" accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis
              dataKey="date"
              ticks={cleanTicks}
              interval={0}
              padding={{ left: 4, right: 20 }}
              tickFormatter={formatDayMonth}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickMargin={6}
            />
            <YAxis
              width={32}
              allowDecimals={false}
              tickCount={4}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.7 }}
              content={(props) => <CountTooltip {...props} unit={unit} />}
              isAnimationActive={false}
            />
            <Bar dataKey="value" fill="var(--primary)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Skeleton aria-hidden="true" className="w-full rounded-xl" style={{ height: HEIGHT }} />
      )}
    </div>
  );
}

function CountTooltip({ active, payload, unit }: TooltipContentProps & { unit: string }) {
  const point = active ? (payload?.[0]?.payload as { date: string; value: number } | undefined) : undefined;
  if (!point) return null;

  return (
    <div className="rounded-xl border bg-background px-3 py-2 text-sm shadow-lg">
      <p className="text-xs text-muted-foreground">{formatWeekdayDayMonth(point.date)}</p>
      <p className="mt-0.5 text-base font-semibold text-foreground">
        {point.value}
        <span className="ml-2 text-xs font-medium text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}
