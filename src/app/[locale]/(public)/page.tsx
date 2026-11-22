import { ArrowRightIcon, BadgeCheckIcon, LanguagesIcon, LockKeyholeIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CalculatorGrid } from "@/components/calculators/calculator-grid";
import { ProfitPreview } from "@/components/home/profit-preview";
import { Button } from "@/components/ui/button";
import { getCalculator } from "@/config/calculators";
import { publicRoutes } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

/** Home page title, description, hreflang links and share preview (Part F4.5). */
export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale });
  return pageMetadata({
    locale,
    path: publicRoutes.home,
    title: t("metadata.title"),
    description: t("metadata.description"),
    siteName: t("common.appName"),
    absoluteTitle: true,
  });
}

/** Public home (wireframe in Part C2). */
export default async function HomePage() {
  const t = await getTranslations("home");
  const tNav = await getTranslations("nav");

  const trustPoints = [
    { icon: LockKeyholeIcon, text: t("trustPrivate") },
    { icon: BadgeCheckIcon, text: t("trustNoAds") },
    { icon: LanguagesIcon, text: t("trustLanguages") },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-linear-to-b from-accent to-transparent"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pt-20 md:pb-24">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full border border-primary/20 bg-background px-3 py-1 text-sm font-medium text-primary">
              {t("badge")}
            </p>
            <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight text-balance sm:text-5xl sm:leading-[1.1]">
              {t("heroTitle")}
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              {t("heroSubtitle")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={getCalculator("profit").href}>
                  {t("ctaCalculate")}
                  <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/#calculators">{t("ctaTools")}</Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
              {trustPoints.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon aria-hidden="true" className="size-4 text-primary" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <ProfitPreview />
        </div>
      </section>

      {/* Calculators */}
      <section
        id="calculators"
        aria-labelledby="calculators-title"
        className="scroll-mt-20 border-t bg-card"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 space-y-2">
            <h2 id="calculators-title" className="text-2xl font-semibold tracking-tight">
              {t("toolsTitle")}
            </h2>
            <p className="text-muted-foreground">{t("toolsSubtitle")}</p>
          </div>
          <CalculatorGrid />
        </div>
      </section>

      {/* Save records: Create free account + Log in (Part C2 home wireframe, C1.7); guest mode /try stays one tap away */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-6 rounded-2xl bg-primary p-8 text-primary-foreground sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{t("saveTitle")}</h2>
            <p className="max-w-lg text-primary-foreground/85">{t("saveBody")}</p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="h-auto min-h-12 w-full bg-background py-2 leading-tight whitespace-normal text-primary hover:bg-primary-soft sm:w-auto"
              >
                <Link href={publicRoutes.signup}>
                  {tNav("signup")}
                  <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-auto min-h-12 w-full border-primary-foreground/50 bg-transparent py-2 leading-tight whitespace-normal text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
              >
                <Link href={publicRoutes.login}>{t("saveLogin")}</Link>
              </Button>
            </div>
            <Link
              href={publicRoutes.tryMyBusiness}
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary-foreground underline underline-offset-4"
            >
              {t("saveTry")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
