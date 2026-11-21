"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/calculators/number-field";
import { SegmentedControl } from "@/components/calculators/segmented-control";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Category } from "@/config/categories";
import { addDays, isIsoDate, type IsoDate } from "@/lib/dates";
import {
  CATEGORIES_BY_TYPE,
  DEFAULT_CATEGORY,
  EARLIEST_ENTRY_DATE,
  ENTRY_NOTE_MAX_LENGTH,
  entryFieldsSchema,
  type EntryFields,
  type EntryType,
} from "@/lib/entries/entry";
import { Money } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CHIP_CLASS, ChipGroup } from "./chip-group";

/** "today" and "yesterday" follow the clock (the form may stay open past midnight). */
type DateChoice = "today" | "yesterday" | IsoDate;

interface FormErrors {
  amount?: string;
  date?: string;
}

/**
 * What `onSave` answers: `true` (saved), `false` (not saved), or `"queued"`
 * (kept on this phone to be sent later: the caller has already said so).
 */
export type SaveResult = boolean | "queued";

interface EntryFormProps {
  /** Today on this phone, e.g. "2026-11-15". */
  today: IsoDate;
  /**
   * Saves the entry. Returns `false` when it could not be saved; the caller
   * tells the person why. The form then keeps what they typed.
   */
  onSave: (fields: EntryFields) => SaveResult | Promise<SaveResult>;
  /** Which type is chosen first, e.g. from the "− Expense" button. Default: income. */
  initialType?: EntryType;
  /** Put the cursor in the amount at once (opens the number keypad on phones). */
  autoFocusAmount?: boolean;
  /**
   * Changing a saved entry instead of adding a new one: the form starts with
   * `initial`, says "Save changes", and does not clear itself after saving
   * (the caller closes the edit sheet).
   */
  mode?: "add" | "edit";
  /** The entry being changed (`mode="edit"`). */
  initial?: EntryFields;
  /** Hide the date: it cannot be changed (Staff may only edit their entries from today). */
  lockDate?: boolean;
}

const AMOUNT_ID = "entry-amount";

function dateChoiceFor(date: IsoDate, today: IsoDate): DateChoice {
  if (date === today) return "today";
  return date === addDays(today, -1) ? "yesterday" : date;
}

/**
 * Add entry (Part D2, Part C2 wireframe): Income | Expense, amount, category
 * chip, date (today by default, no future dates) and an optional note.
 * After saving it shows "Saved" and stays ready for the next entry, keeping
 * the type, category and date. The same form edits an existing entry
 * (`mode="edit"`).
 */
export function EntryForm({
  today,
  onSave,
  initialType = "income",
  autoFocusAmount = false,
  mode = "add",
  initial,
  lockDate = false,
}: EntryFormProps) {
  const t = useTranslations("entry");
  const tCategory = useTranslations("categories");

  const [type, setType] = useState<EntryType>(initial?.type ?? initialType);
  const [category, setCategory] = useState<Category>(
    initial?.category ?? DEFAULT_CATEGORY[initialType],
  );
  const [amount, setAmount] = useState(
    initial ? Money.fromCents(initial.amountCents).toInputString() : "",
  );
  const [dateChoice, setDateChoice] = useState<DateChoice>(
    initial ? dateChoiceFor(initial.entryDate, today) : "today",
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (autoFocusAmount) focusAmount();
  }, [autoFocusAmount]);

  const yesterday = addDays(today, -1);
  const entryDate =
    lockDate && initial
      ? initial.entryDate
      : dateChoice === "today"
        ? today
        : dateChoice === "yesterday"
          ? yesterday
          : dateChoice;

  function chooseType(next: EntryType) {
    setType(next);
    setCategory(DEFAULT_CATEGORY[next]);
  }

  function chooseDate(value: string) {
    setErrors((previous) => ({ ...previous, date: undefined }));
    // Clearing the date field means "back to today".
    if (!value || value === today) setDateChoice("today");
    else if (value === yesterday) setDateChoice("yesterday");
    else setDateChoice(value);
  }

  function validate(): FormErrors {
    const found: FormErrors = {};
    if (!Money.parse(amount)?.isPositive) found.amount = t("amountRequired");
    // A locked date is the entry's own, saved date: nothing to check.
    if (!lockDate) {
      if (!isIsoDate(entryDate) || entryDate < EARLIEST_ENTRY_DATE) found.date = t("dateInvalid");
      else if (entryDate > today) found.date = t("futureDate");
    }
    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (found.amount) return focusAmount();
    if (found.date) return;

    const parsed = entryFieldsSchema.safeParse({
      type,
      category,
      amountCents: Money.parse(amount)?.cents,
      entryDate,
      note,
    });
    if (!parsed.success) {
      // Only an amount above the 12-digit limit can get here.
      setErrors({ amount: t("amountRequired") });
      return focusAmount();
    }

    setSaving(true);
    const saved = await onSave(parsed.data);
    setSaving(false);
    if (!saved || mode === "edit") return;

    if (saved !== "queued") toast.success(t("saved"));
    setAmount("");
    setNote("");
    focusAmount();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <SegmentedControl
        name="entry-type"
        legend={t("typeLegend")}
        options={[
          { value: "income", label: t("income") },
          { value: "expense", label: t("expense") },
        ]}
        value={type}
        onValueChange={chooseType}
      />

      <MoneyInput
        id={AMOUNT_ID}
        label={t("amount")}
        value={amount}
        onValueChange={(value) => {
          setAmount(value);
          if (errors.amount) setErrors((previous) => ({ ...previous, amount: undefined }));
        }}
        invalid={Boolean(errors.amount)}
        hint={errors.amount}
        // The keypad's "Done" saves: the quickest way to add a record.
        enterKeyHint="done"
      />

      <ChipGroup
        name="entry-category"
        legend={t("category")}
        options={CATEGORIES_BY_TYPE[type].map((key) => ({ value: key, label: tCategory(key) }))}
        value={category}
        onValueChange={setCategory}
      />

      {!lockDate && (
        <ChipGroup
          name="entry-date"
          legend={t("date")}
          options={[
            { value: "today", label: t("today") },
            { value: "yesterday", label: t("yesterday") },
          ]}
          value={dateChoice === "today" || dateChoice === "yesterday" ? dateChoice : null}
          onValueChange={setDateChoice}
          error={errors.date}
        >
          <label
            className={cn(
              CHIP_CLASS,
              "gap-2 pr-2 focus-within:ring-3 focus-within:ring-ring/50",
              dateChoice !== "today" && dateChoice !== "yesterday" && "border-primary",
            )}
          >
            <span className="text-muted-foreground">{t("pickDate")}</span>
            <input
              type="date"
              value={entryDate}
              min={EARLIEST_ENTRY_DATE}
              max={today}
              onChange={(event) => chooseDate(event.target.value)}
              className="money min-h-9 rounded-full bg-transparent px-1 text-sm font-semibold outline-none"
            />
          </label>
        </ChipGroup>
      )}

      <div className="space-y-2">
        <Label htmlFor="entry-note" className="text-base font-medium">
          {t("note")}
        </Label>
        <input
          id="entry-note"
          type="text"
          value={note}
          maxLength={ENTRY_NOTE_MAX_LENGTH}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("notePlaceholder")}
          enterKeyHint="done"
          className={cn(
            "h-12 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
            "placeholder:text-muted-foreground/70",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          )}
        />
      </div>

      <Button
        type="submit"
        disabled={saving}
        className="h-auto min-h-14 w-full py-3 text-base leading-tight whitespace-normal"
      >
        <CheckIcon data-icon="inline-start" aria-hidden="true" />
        {mode === "edit" ? t("saveChanges") : type === "income" ? t("saveIncome") : t("saveExpense")}
      </Button>
    </form>
  );
}

/**
 * Back to the amount, so the next entry can be typed straight away.
 * The field is brought to the middle of the screen: left to the browser,
 * it may stop under the sticky header.
 */
function focusAmount() {
  const input = document.getElementById(AMOUNT_ID);
  if (!input) return;
  input.focus({ preventScroll: true });
  input.scrollIntoView({ block: "center" });
}
