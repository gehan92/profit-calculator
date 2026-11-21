"use client";

import { useLayoutEffect, useRef, type ChangeEvent, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { caretAfterFormat, formatAmountInput, type AmountInputOptions } from "@/lib/amount-input";
import { cn } from "@/lib/utils";
import { useCalcFormat } from "./use-calc-format";

export interface NumberFieldProps extends AmountInputOptions {
  id: string;
  label: string;
  /** What the field shows, e.g. "25,000". Empty string = empty field. */
  value: string;
  onValueChange: (value: string) => void;
  /** Shown inside the field on the left, e.g. "Rs". */
  prefix?: string;
  /** Shown inside the field on the right, e.g. "%". */
  suffix?: string;
  placeholder?: string;
  /** Short help or error text under the field (may contain a link). */
  hint?: ReactNode;
  invalid?: boolean;
  /** Extra control next to the label, e.g. a remove button. */
  labelAction?: ReactNode;
  /**
   * The keypad's action key. "next" (default) moves to the next field, as on
   * the calculators; "done" sends the form (Add entry: type the amount, done).
   */
  enterKeyHint?: "next" | "done";
}

/**
 * A number field that follows the Part D1 shared input rules:
 * number keypad on phones, 0 or more, up to 2 decimals, and thousands
 * separators added while typing without the cursor jumping.
 */
export function NumberField({
  id,
  label,
  value,
  onValueChange,
  prefix,
  suffix,
  placeholder = "0",
  hint,
  invalid = false,
  labelAction,
  maxDecimals = 2,
  groupThousands = true,
  maxWholeDigits,
  enterKeyHint = "next",
}: NumberFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const hintId = hint ? `${id}-hint` : undefined;

  // Put the cursor back where the person was typing after commas move.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input && pendingCaret.current !== null && document.activeElement === input) {
      input.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    const caret = event.target.selectionStart ?? raw.length;
    const formatted = formatAmountInput(raw, { maxDecimals, groupThousands, maxWholeDigits });

    pendingCaret.current = caretAfterFormat(raw, caret, formatted);
    onValueChange(formatted);
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <Label htmlFor={id} className="text-base font-medium">
          {label}
        </Label>
        {labelAction}
      </div>

      <div className="relative">
        {prefix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base font-medium text-muted-foreground"
          >
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode={maxDecimals > 0 ? "decimal" : "numeric"}
          autoComplete="off"
          enterKeyHint={enterKeyHint}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
          className={cn(
            "money h-14 w-full min-w-0 rounded-xl border border-input bg-background px-4 text-lg font-semibold transition-colors outline-none",
            "placeholder:font-normal placeholder:text-muted-foreground/70",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            prefix && (prefix.length > 2 ? "pl-14" : "pl-12"),
            suffix && "pr-11",
          )}
        />
        {suffix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base font-medium text-muted-foreground"
          >
            {suffix}
          </span>
        )}
      </div>

      {hint && (
        <p
          id={hintId}
          className={cn("text-sm", invalid ? "text-destructive" : "text-muted-foreground")}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * MoneyInput (Part E3): a NumberField with the currency prefix ("Rs").
 * Turn its value into cents with `Money.parse(value)`.
 */
export function MoneyInput(props: Omit<NumberFieldProps, "prefix" | "suffix">) {
  const { symbol } = useCalcFormat();
  return <NumberField {...props} prefix={symbol} />;
}
