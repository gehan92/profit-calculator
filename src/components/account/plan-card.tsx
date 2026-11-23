import { useLocale, useTranslations } from "next-intl";
import { isAppLocale } from "@/i18n/config";
import { safeInvoiceUrl, type PaymentInfo, type PlanState } from "@/lib/account/billing";
import { Money } from "@/lib/money";
import { cn } from "@/lib/utils";
import { LocalDateTime } from "./local-date-time";

interface PlanCardProps {
  state: PlanState;
  /** The plan's name ("Pro"); only used when the plan is not Free. */
  planName: string | null;
}

/**
 * Account → Plan & billing → "Your plan": the Free plan, or the paid plan with
 * its next payment or end date. Changing or cancelling a plan arrives with the
 * payment pages; until then the card says paid plans are coming.
 */
export function PlanCard({ state, planName }: PlanCardProps) {
  const t = useTranslations("accountPage.plan");
  const free = state.kind === "free";

  return (
    <div className={cn("space-y-3 rounded-xl border p-4", free ? "bg-background" : "border-primary/40 bg-primary-soft")}>
      <p className="text-xl font-semibold">{free ? t("freeName") : (planName ?? t("paidName"))}</p>

      {state.kind === "free" && <p className="text-pretty text-muted-foreground">{t("freeBody")}</p>}
      {state.kind === "renews" && (
        <p>
          {t("renews")} <LocalDateTime iso={state.date ?? ""} withTime={false} />
        </p>
      )}
      {state.kind === "ends" && (
        <p>
          {t("ends")} <LocalDateTime iso={state.date ?? ""} withTime={false} />
        </p>
      )}
      {state.kind === "trial" && (
        <p>
          {t("trial")} <LocalDateTime iso={state.date ?? ""} withTime={false} />
        </p>
      )}
      {state.kind === "pastDue" && (
        <p role="alert" className="font-medium text-destructive">
          {t("pastDue")} <LocalDateTime iso={state.date ?? ""} withTime={false} />
        </p>
      )}

      {free && <p className="text-sm text-muted-foreground">{t("upgradeSoon")}</p>}
    </div>
  );
}

const STATUS_CLASS: Record<PaymentInfo["status"], string> = {
  paid: "bg-profit/10 text-profit",
  failed: "bg-loss/10 text-loss",
  refunded: "bg-muted text-muted-foreground",
  partially_refunded: "bg-muted text-muted-foreground",
};

/** Account → Plan & billing → "Billing history": one row per payment, with the invoice link when there is one. */
export function BillingHistory({ payments }: { payments: readonly PaymentInfo[] }) {
  const t = useTranslations("accountPage.plan");
  const locale = useLocale();
  const appLocale = isAppLocale(locale) ? locale : "en";

  if (payments.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-center text-muted-foreground">{t("historyEmpty")}</p>;
  }

  return (
    <ul className="divide-y rounded-xl border bg-background">
      {payments.map((payment) => {
        const invoice = safeInvoiceUrl(payment.invoiceUrl);
        return (
          <li key={payment.id} className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
            <span className="min-w-0">
              <span className="money block font-medium">
                {Money.fromCents(payment.amountCents, payment.currency).format(appLocale)}
              </span>
              <span className="block text-sm text-muted-foreground">
                <LocalDateTime iso={payment.paidAt} withTime={false} />
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_CLASS[payment.status])}>
                {t(`status.${payment.status}`)}
              </span>
              {invoice && (
                <a
                  href={invoice}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t("invoice")}
                </a>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
