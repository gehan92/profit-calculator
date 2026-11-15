import { LockKeyholeIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "login" });
  // A login page has nothing for search engines.
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

/**
 * /[locale]/login (Part C2): Google or an email link.
 * Logged-in people never see it: the proxy sends them on to `next`.
 */
export default async function LoginPage() {
  const t = await getTranslations("login");

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <div className="rounded-2xl border bg-background p-6 shadow-lg shadow-primary/5 sm:p-8">
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t("title")}</h1>
          <p className="text-pretty text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* The form reads ?next= and ?error= from the address, so it streams in. */}
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <LockKeyholeIcon aria-hidden="true" className="size-4 shrink-0" />
        {t("privacy")}
      </p>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
