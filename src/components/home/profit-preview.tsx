import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Money } from "@/lib/money";

/**
 * A static example of the profit calculator result (Part A5, scenario 1),
 * so first-time visitors see what they will get before typing anything.
 */
const EXAMPLE = {
  sales: Money.fromCents(2_500_000),
  stock: Money.fromCents(1_500_000),
  other: Money.fromCents(150_000),
};

export async function ProfitPreview() {
  const [t, locale, format] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    getFormatter(),
  ]);

  const profit = EXAMPLE.sales.subtract(Money.sum([EXAMPLE.stock, EXAMPLE.other]));
  const profitShare = profit.cents / EXAMPLE.sales.cents;

  const rows = [
    { label: t("previewSales"), value: EXAMPLE.sales },
    { label: t("previewStock"), value: EXAMPLE.stock },
    { label: t("previewOther"), value: EXAMPLE.other },
  ];

  return (
    <figure className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden="true"
        className="absolute -inset-4 -z-10 rounded-[2rem] bg-linear-to-br from-primary-soft via-accent to-transparent blur-2xl"
      />
      <div className="rounded-2xl border bg-background p-5 shadow-xl shadow-primary/10">
        <figcaption className="mb-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("previewLabel")}
        </figcaption>

        <dl className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="money rounded-lg bg-card px-3 py-1.5 text-sm font-medium">
                {row.value.format(locale, { trimZeroCents: true })}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 rounded-xl bg-profit/10 p-4">
          <p className="text-xs font-semibold tracking-wide text-profit-foreground uppercase">
            {t("previewProfit")}
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="money text-[2.5rem] leading-none font-bold text-profit">
              {profit.format(locale, { trimZeroCents: true })}
            </span>
            <span className="money text-base font-semibold text-profit-foreground">
              {format.number(profitShare, { style: "percent" })}
            </span>
          </p>
        </div>
      </div>
    </figure>
  );
}
