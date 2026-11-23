"use client";

import { CheckIcon, PackageIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/calculators/number-field";
import { SegmentedControl } from "@/components/calculators/segmented-control";
import { useCalcFormat } from "@/components/calculators/use-calc-format";
import { useCategoryCatalog, useProducts } from "@/components/shop-catalog-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { addDays, isIsoDate, type IsoDate } from "@/lib/dates";
import {
  EARLIEST_ENTRY_DATE,
  ENTRY_NOTE_MAX_LENGTH,
  entryFieldsSchema,
  type EntryFields,
  type EntryType,
} from "@/lib/entries/entry";
import { Money } from "@/lib/money";
import { lineAmountCents, unitAmountCents } from "@/lib/products/product";
import { dashboardRoutes } from "@/lib/roles";
import { formatQuantity, parseQuantity } from "@/lib/products/quantity";
import { cn } from "@/lib/utils";
import { CHIP_CLASS, ChipGroup } from "./chip-group";
import { NewCategoryDialog } from "./new-category-dialog";
import { ProductPicker } from "./product-picker";

/** "today" and "yesterday" follow the clock (the form may stay open past midnight). */
type DateChoice = "today" | "yesterday" | IsoDate;

interface FormErrors {
  amount?: string;
  date?: string;
  quantity?: string;
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
  /** Offer "+ New category" (the Owner of a shop; guests and Staff cannot add categories). */
  allowNewCategory?: boolean;
}

const AMOUNT_ID = "entry-amount";

function dateChoiceFor(date: IsoDate, today: IsoDate): DateChoice {
  if (date === today) return "today";
  return date === addDays(today, -1) ? "yesterday" : date;
}

/**
 * Add entry (Part D2, Part C2 wireframe): Income | Expense, amount, category
 * chip (the shop's own list, with "+ New category"), an optional product with
 * a quantity (the amount fills in), date (today by default, no future dates)
 * and an optional note. After saving it shows "Saved" and stays ready for the
 * next entry, keeping the type, category and date. The same form edits an
 * existing entry (`mode="edit"`).
 */
export function EntryForm({
  today,
  onSave,
  initialType = "income",
  autoFocusAmount = false,
  mode = "add",
  initial,
  lockDate = false,
  allowNewCategory = false,
}: EntryFormProps) {
  const t = useTranslations("entry");
  const { money } = useCalcFormat();
  const catalog = useCategoryCatalog();
  const products = useProducts();

  const [type, setType] = useState<EntryType>(initial?.type ?? initialType);
  const [category, setCategory] = useState<string>(
    initial?.category ?? catalog.defaultRef(initial?.type ?? initialType),
  );
  const [amount, setAmount] = useState(
    initial ? Money.fromCents(initial.amountCents).toInputString() : "",
  );
  // True once the person types the amount themselves: then choosing a product no longer overwrites it.
  const [amountTyped, setAmountTyped] = useState(initial !== undefined);
  const [productId, setProductId] = useState<string | null>(initial?.productId ?? null);
  const [quantity, setQuantity] = useState(initial?.quantity ? formatQuantity(initial.quantity) : "1");
  const [dateChoice, setDateChoice] = useState<DateChoice>(
    initial ? dateChoiceFor(initial.entryDate, today) : "today",
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);

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

  // The shop's categories for this kind of entry. One that was put away still shows while it is the chosen one.
  const chosenCategory = catalog.find(category, type);
  const categoryOptions = catalog.options(type);
  if (chosenCategory?.archived && !categoryOptions.some((option) => option.ref === chosenCategory.ref)) {
    categoryOptions.push(chosenCategory);
  }

  // Products to offer: the active ones, plus the one this entry already has.
  const productOptions = products.filter((product) => !product.archived || product.id === productId);
  const chosenProduct = products.find((product) => product.id === productId);
  const quantityValue = parseQuantity(quantity);
  const amountHint =
    chosenProduct && quantityValue
      ? t("amountFromProduct", {
          price: money(unitAmountCents(chosenProduct, type)),
          quantity: formatQuantity(quantityValue),
        })
      : undefined;

  /** Fills in the amount from the product's price (sale) or cost (purchase) times the quantity. */
  function fillAmount(nextProductId: string | null, nextQuantity: string, nextType: EntryType) {
    const product = products.find((candidate) => candidate.id === nextProductId);
    const count = parseQuantity(nextQuantity);
    if (!product || !count) return;
    setAmount(Money.fromCents(lineAmountCents(unitAmountCents(product, nextType), count)).toInputString());
    setErrors((previous) => ({ ...previous, amount: undefined }));
  }

  function chooseType(next: EntryType) {
    setType(next);
    setCategory(catalog.defaultRef(next));
    if (productId && !amountTyped) fillAmount(productId, quantity, next);
  }

  function chooseProduct(next: string | null) {
    setProductId(next);
    setQuantity("1");
    setErrors((previous) => ({ ...previous, quantity: undefined }));
    if (next) {
      // A newly chosen product works the amount out again, even over an earlier one.
      setAmountTyped(false);
      fillAmount(next, "1", type);
    }
  }

  function changeQuantity(next: string) {
    setQuantity(next);
    setErrors((previous) => ({ ...previous, quantity: undefined }));
    if (productId) {
      setAmountTyped(false);
      fillAmount(productId, next, type);
    }
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
    if (productId && quantityValue === null) found.quantity = t("quantityRequired");
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
    if (found.date || found.quantity) return;

    const parsed = entryFieldsSchema.safeParse({
      type,
      category,
      amountCents: Money.parse(amount)?.cents,
      entryDate,
      note,
      productId,
      quantity: productId ? quantityValue : null,
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
    setAmountTyped(false);
    setNote("");
    setProductId(null);
    setQuantity("1");
    focusAmount();
  }

  return (
    <>
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

        <ChipGroup
          name="entry-category"
          legend={t("category")}
          options={categoryOptions.map((option) => ({ value: option.ref, label: option.label }))}
          value={chosenCategory?.ref ?? null}
          onValueChange={setCategory}
        >
          {allowNewCategory && (
            <button
              type="button"
              onClick={() => setNewCategoryOpen(true)}
              className={cn(
                CHIP_CLASS,
                "cursor-pointer gap-1 border-dashed border-primary/50 text-primary hover:bg-primary-soft",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              )}
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              {t("newCategory")}
            </button>
          )}
        </ChipGroup>

        {/* A shop with no products yet is shown where to add them: amounts then fill in faster. */}
        {mode === "add" && allowNewCategory && products.length === 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm text-pretty">
            <PackageIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {t("addProductsHint")}{" "}
              <Link href={dashboardRoutes.products} className="font-medium whitespace-nowrap text-primary underline underline-offset-4">
                {t("addProductsLink")}
              </Link>
            </span>
          </p>
        )}

        {productOptions.length > 0 && (
          <ProductPicker
            products={productOptions}
            productId={productId}
            quantity={quantity}
            onProductChange={chooseProduct}
            onQuantityChange={changeQuantity}
            error={errors.quantity}
            hint={amountHint}
          />
        )}

        <MoneyInput
          id={AMOUNT_ID}
          label={t("amount")}
          value={amount}
          onValueChange={(value) => {
            setAmount(value);
            setAmountTyped(true);
            if (errors.amount) setErrors((previous) => ({ ...previous, amount: undefined }));
          }}
          invalid={Boolean(errors.amount)}
          hint={errors.amount}
          // The keypad's "Done" saves: the quickest way to add a record.
          enterKeyHint="done"
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

      {/* Outside the form on purpose: its own Enter key must never save the entry behind it. */}
      {allowNewCategory && (
        <NewCategoryDialog
          open={newCategoryOpen}
          onOpenChange={setNewCategoryOpen}
          type={type}
          onCreated={(created) => created.id && setCategory(created.id)}
        />
      )}
    </>
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
