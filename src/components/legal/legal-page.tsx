import { MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { publicRoutes } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

/** The three text pages (Part C1.1 "About, Privacy", Part F5 "Privacy"). */
export type LegalPageId = "about" | "privacy" | "terms";

const PAGE_PATHS = {
  about: publicRoutes.about,
  privacy: publicRoutes.privacy,
  terms: publicRoutes.terms,
} as const satisfies Record<LegalPageId, string>;

/** Each page keeps its text as a list of sections in `messages/*.json` → <page>.sections. */
const sectionsSchema = z
  .array(z.object({ title: z.string().min(1), body: z.array(z.string().min(1)).min(1) }))
  .min(1);

/**
 * Title, description, language links and share preview of a text page, in the
 * page's language. Usage: `export const generateMetadata = legalMetadata("privacy");`
 */
export function legalMetadata(id: LegalPageId) {
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
      path: PAGE_PATHS[id],
      title: t(`${id}.metaTitle`),
      description: t(`${id}.metaDescription`),
      siteName: t("common.appName"),
    });
  };
}

/**
 * About, Privacy policy and Terms of use: a title, a short introduction and
 * numbered-by-heading sections of plain paragraphs. The words live in the
 * message files so Sinhala and Tamil can be checked by a native speaker.
 */
export async function LegalPage({ id }: { id: LegalPageId }) {
  const t = await getTranslations();
  const sections = sectionsSchema.parse(t.raw(`${id}.sections`));

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-10 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{t(`${id}.title`)}</h1>
        <p className="text-lg text-pretty text-muted-foreground">{t(`${id}.intro`)}</p>

        {id === "about" ? (
          <div className="pt-3">
            <Button asChild size="lg" className="h-auto min-h-14 py-2 text-center leading-tight whitespace-normal">
              <Link href="/profit-calculator">{t("about.calcButton")}</Link>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("legal.lastUpdated")}</p>
        )}
      </header>

      <div className="space-y-9">
        {sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`${id}-section-${index}`} className="space-y-3">
            <h2 id={`${id}-section-${index}`} className="text-xl font-semibold tracking-tight text-balance">
              {section.title}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-pretty leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-12">
        <Button asChild variant="outline" size="lg" className="h-auto min-h-14 bg-background py-2 text-center leading-tight whitespace-normal">
          <Link href={publicRoutes.feedback}>
            <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
            {t("legal.contactButton")}
          </Link>
        </Button>
      </div>
    </article>
  );
}
