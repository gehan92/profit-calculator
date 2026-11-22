import { LogOutIcon, MessageCircleIcon, PauseCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoutForm } from "@/components/auth/logout-form";
import { MessageScreen } from "@/components/layout/message-screen";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppLocale } from "@/i18n/config";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { isAccountPaused } from "@/lib/auth/account-status";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dashboardPath } from "@/lib/auth/routes";
import { getSupportWhatsAppLink } from "@/lib/platform/support-contact";

export async function generateMetadata({ params }: PageProps<"/[locale]/paused">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "paused" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * /[locale]/paused — what a blocked person sees after logging in (Part C2:
 * "Your account is paused" with a WhatsApp support button). Everyone else who
 * opens the address is sent where they belong: guests to the home page, people
 * in good standing to their dashboard.
 */
export default async function PausedPage({ params }: PageProps<"/[locale]/paused">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Who is asking is only known at request time, so it streams in.
  return (
    <Suspense fallback={<PausedSkeleton />}>
      <PausedScreen locale={locale} />
    </Suspense>
  );
}

async function PausedScreen({ locale }: { locale: AppLocale }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}`);
  if (!(await isAccountPaused(user.id))) redirect(dashboardPath(locale));

  const [t, tAccount] = await Promise.all([getTranslations("paused"), getTranslations("account")]);
  // Support knows who is writing when the first message already says which account it is.
  const hello = `${t("whatsappText")}${user.email ? ` (${user.email})` : ""}`;
  const whatsapp = await getSupportWhatsAppLink(hello);

  return (
    <MessageScreen
      icon={PauseCircleIcon}
      tone="warning"
      title={t("title")}
      actions={
        <>
          {whatsapp && (
            <Button asChild size="lg" className="h-auto min-h-14 py-2 text-center leading-tight whitespace-normal w-full sm:w-auto">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" data-testid="paused-whatsapp">
                <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
                {t("whatsapp")}
              </a>
            </Button>
          )}
          <LogoutForm locale={locale} className="w-full sm:w-auto">
            <Button type="submit" variant="outline" size="lg" className="h-auto min-h-14 py-2 text-center leading-tight whitespace-normal w-full bg-background sm:w-auto">
              <LogOutIcon data-icon="inline-start" aria-hidden="true" />
              {tAccount("logout")}
            </Button>
          </LogoutForm>
        </>
      }
    >
      <p>{t("body")}</p>
      {!whatsapp && <p className="mt-2">{t("noContact")}</p>}
      <p className="mt-4">
        <Link href="/#calculators" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("calculators")}
        </Link>
      </p>
    </MessageScreen>
  );
}

function PausedSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 py-16" aria-hidden="true">
      <Skeleton className="size-14 rounded-2xl" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
