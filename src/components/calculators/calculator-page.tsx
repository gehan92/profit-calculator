import { LockKeyholeIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { getCalculator, type CalculatorId } from "@/config/calculators";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { CalculatorFaq } from "./calculator-faq";
import { CalculatorGrid } from "./calculator-grid";
import { CalculatorIcon } from "./calculator-icon";

/**
 * Title, description, hreflang links and share preview for a calculator,
 * in the page's language (Part F4.5).
 * Usage in a page file: `export const generateMetadata = calculatorMetadata("profit");`
 */
export function calculatorMetadata(id: CalculatorId) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) return {};

    const t = await getTranslations({ locale });
    return pageMetadata({
      locale,
      path: getCalculator(id).href,
      title: t(`calc.${id}.metaTitle`),
      description: t(`calc.${id}.metaDescription`),
      siteName: t("common.appName"),
    });
  };
}

interface CalculatorPageProps {
  id: CalculatorId;
  /** The interactive calculator (a Client Component). */
  children: ReactNode;
  /** Short guide under the calculator, see `CalculatorGuide`. */
  guide?: ReactNode;
}

/**
 * The layout every calculator page shares (Part C2 wireframe, Part F4.5):
 * H1 and intro, the calculator, a short guide, FAQ, then links to the other tools.
 */
export async function CalculatorPage({ id, children, guide }: CalculatorPageProps) {
  const [t, tUi] = await Promise.all([getTranslations("calc"), getTranslations("calcUi")]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header className="mb-8 flex items-start gap-4">
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary sm:flex">
          <CalculatorIcon id={id} className="size-6" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {t(`${id}.title`)}
          </h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">{t(`${id}.intro`)}</p>
        </div>
      </header>

      {children}

      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <LockKeyholeIcon aria-hidden="true" className="size-4 shrink-0" />
        {tUi("remembered")}
      </p>

      {guide}

      <CalculatorFaq id={id} />

      <section aria-labelledby="other-tools-title" className="mt-16 space-y-6">
        <h2 id="other-tools-title" className="text-xl font-semibold tracking-tight">
          {tUi("otherTools")}
        </h2>
        <CalculatorGrid exclude={id} />
      </section>
    </div>
  );
}

interface CalculatorGuideProps {
  title: string;
  formula: string;
  example: string;
}

/** "How to calculate" box with the formula and a worked example (Part F4.5). */
export async function CalculatorGuide({ title, formula, example }: CalculatorGuideProps) {
  const t = await getTranslations("calcUi");

  return (
    <section aria-labelledby="guide-title" className="mt-12 rounded-2xl border bg-card p-6 sm:p-8">
      <h2 id="guide-title" className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <dl className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <dt className="text-sm font-semibold tracking-wide text-primary uppercase">
            {t("formula")}
          </dt>
          <dd className="rounded-xl border bg-background p-4 text-base">{formula}</dd>
        </div>
        <div className="space-y-2">
          <dt className="text-sm font-semibold tracking-wide text-primary uppercase">
            {t("example")}
          </dt>
          <dd className="rounded-xl border bg-background p-4 text-base">{example}</dd>
        </div>
      </dl>
    </section>
  );
}
