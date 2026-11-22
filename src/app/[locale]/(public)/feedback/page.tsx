import { MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import { getSupportWhatsAppLink } from "@/lib/platform/support-contact";

export async function generateMetadata({ params }: PageProps<"/[locale]/feedback">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "feedback" });
  // Nothing here for search engines.
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

/**
 * /[locale]/feedback (Part D2 "Feedback", Part F2 folder structure): a message,
 * an optional contact and, when the Admin has set a number, a WhatsApp support
 * button. Open to everyone.
 */
export default async function FeedbackPage() {
  const t = await getTranslations("feedback");

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:py-16">
      <div className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{t("title")}</h1>
        <p className="text-pretty text-muted-foreground">{t("intro")}</p>
      </div>

      {/* The form reads ?from= (the page the person came from), so it streams in. */}
      <Suspense fallback={<FeedbackFormSkeleton />}>
        <FeedbackForm />
      </Suspense>

      <Suspense fallback={null}>
        <WhatsAppHelp />
      </Suspense>
    </div>
  );
}

/** "Need help right now?" with the WhatsApp button; hidden until the Admin has set a number. */
async function WhatsAppHelp() {
  const t = await getTranslations("feedback");
  const link = await getSupportWhatsAppLink(t("helpText"));
  if (!link) return null;

  return (
    <section className="mt-10 space-y-3 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{t("helpTitle")}</h2>
      <p className="text-muted-foreground">{t("helpBody")}</p>
      <Button asChild variant="outline" size="lg" className="h-auto min-h-14 py-2 text-center leading-tight whitespace-normal w-full bg-background sm:w-auto">
        <a href={link} target="_blank" rel="noopener noreferrer" data-testid="feedback-whatsapp">
          <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
          {t("helpButton")}
        </a>
      </Button>
    </section>
  );
}

function FeedbackFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-14 w-40 rounded-xl" />
    </div>
  );
}
