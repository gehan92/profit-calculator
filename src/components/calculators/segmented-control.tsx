"use client";

import { cn } from "@/lib/utils";

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

interface SegmentedControlProps<Value extends string> {
  /** Groups the radio buttons; must be unique on the page. */
  name: string;
  legend: string;
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  /** Short help under the buttons, e.g. what the chosen option means. */
  hint?: string;
}

/**
 * A row of buttons where exactly one is chosen (e.g. Markup | Margin).
 *
 * Built from real radio inputs, so arrow keys, screen readers and forms
 * work without extra code. Also the base for the Income | Expense
 * TypeToggle on the Add entry screen (Part E3).
 */
export function SegmentedControl<Value extends string>({
  name,
  legend,
  options,
  value,
  onValueChange,
  hint,
}: SegmentedControlProps<Value>) {
  const hintId = hint ? `${name}-hint` : undefined;

  return (
    <fieldset className="min-w-0 space-y-2" aria-describedby={hintId}>
      <legend className="mb-2 text-base font-medium">{legend}</legend>

      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-sm leading-tight font-medium wrap-anywhere text-muted-foreground transition-colors",
              "hover:text-foreground",
              "has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm",
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
      </div>

      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </fieldset>
  );
}
