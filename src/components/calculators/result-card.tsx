import { LightbulbIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ResultTone = "profit" | "loss";

export interface ResultDetail {
  label: string;
  value: string;
}

interface ResultCardProps {
  /** The word next to the number: "Profit" or "Loss" (colour alone is not enough). */
  label: string;
  /** The big number, e.g. "Rs 8,500". `null` shows `emptyText` instead. */
  amount: string | null;
  tone: ResultTone;
  /** Small text next to the big number, e.g. "34%". */
  aside?: string;
  /** Shown before the person has typed enough, e.g. "Enter your sales". */
  emptyText: string;
  details?: ResultDetail[];
  tip?: string;
  /** Buttons under the result (share, copy, reset, save). */
  children?: ReactNode;
}

const TONE_STYLES: Record<ResultTone, { panel: string; label: string; amount: string }> = {
  profit: { panel: "bg-profit/10", label: "text-profit-foreground", amount: "text-profit" },
  loss: { panel: "bg-loss/10", label: "text-loss", amount: "text-loss" },
};

/**
 * ResultCard (Part E3): big number in green or red plus the word
 * Profit/Loss, optional details, one tip and the action buttons.
 * Screen readers hear the new result as people type (aria-live).
 */
export function ResultCard({
  label,
  amount,
  tone,
  aside,
  emptyText,
  details = [],
  tip,
  children,
}: ResultCardProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div className="overflow-hidden rounded-2xl border bg-background shadow-lg shadow-primary/5">
      <div aria-live="polite" aria-atomic="true" className="space-y-4 p-5 sm:p-6">
        {amount === null ? (
          <p className="rounded-xl bg-card p-5 text-center text-base text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <>
            <div className={cn("rounded-xl p-5", styles.panel)}>
              <p
                className={cn("text-sm font-semibold tracking-wide uppercase", styles.label)}
              >
                {label}
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={cn(
                    "money text-[2.5rem] leading-none font-bold break-all",
                    styles.amount,
                  )}
                >
                  {amount}
                </span>
                {aside && (
                  <span className={cn("money text-lg font-semibold", styles.label)}>{aside}</span>
                )}
              </p>
            </div>

            {details.length > 0 && (
              <dl className="divide-y rounded-xl border">
                {details.map((detail) => (
                  <div
                    key={detail.label}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <dt className="text-sm text-muted-foreground">{detail.label}</dt>
                    <dd className="money text-base font-semibold">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {tip && (
              <p className="flex gap-3 rounded-xl bg-warning/10 p-4 text-sm text-foreground">
                <LightbulbIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-warning-foreground"
                />
                <span>{tip}</span>
              </p>
            )}
          </>
        )}
      </div>

      {children && <div className="border-t bg-card p-4 sm:px-6">{children}</div>}
    </div>
  );
}
