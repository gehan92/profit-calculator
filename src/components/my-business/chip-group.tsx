"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChipOption<Value extends string> {
  value: Value;
  label: string;
}

interface ChipGroupProps<Value extends string> {
  /** Groups the radio buttons; must be unique on the page. */
  name: string;
  legend: string;
  options: readonly ChipOption<Value>[];
  /** `null` when none of the chips is chosen (e.g. a date picked elsewhere). */
  value: Value | null;
  onValueChange: (value: Value) => void;
  /** Extra control at the end of the row, e.g. a date field. */
  children?: ReactNode;
  /** Error text under the chips. */
  error?: string;
}

/** Shape shared by chips and controls placed next to them. */
export const CHIP_CLASS =
  "inline-flex min-h-11 items-center rounded-full border bg-background px-4 text-sm font-medium leading-tight transition-colors";

/**
 * Tappable chips where one is chosen, e.g. (Stock)(Rent)(Salary) on the
 * Add entry screen (Part C2 wireframe). Built from real radio inputs, so
 * keyboards and screen readers work without extra code.
 */
export function ChipGroup<Value extends string>({
  name,
  legend,
  options,
  value,
  onValueChange,
  children,
  error,
}: ChipGroupProps<Value>) {
  const errorId = error ? `${name}-error` : undefined;

  return (
    <fieldset aria-describedby={errorId} aria-invalid={error ? true : undefined}>
      <legend className="mb-2 text-base font-medium">{legend}</legend>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              CHIP_CLASS,
              "cursor-pointer hover:bg-muted",
              "has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-checked:hover:bg-primary/90",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onValueChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
        {children}
      </div>

      {error && (
        <p id={errorId} className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
