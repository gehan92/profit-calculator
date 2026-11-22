import { LockKeyholeIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthSwitchLink } from "@/components/auth/auth-switch-link";
import { Skeleton } from "@/components/ui/skeleton";
import { publicRoutes } from "@/config/site";
import { Link } from "@/i18n/navigation";

const LEGAL_LINK_CLASS = "font-medium text-primary underline underline-offset-4";

/**
 * The page behind both "Log in" and "Create free account" (Part C1.7): the
 * same card and the same buttons, with their own title and words. Logged-in
 * people never see it: the proxy sends them on.
 */
export async function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const t = await getTranslations("login");
  const tSignup = await getTranslations("signup");
  const title = mode === "login" ? t("title") : tSignup("title");
  const subtitle = mode === "login" ? t("subtitle") : tSignup("subtitle");

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <div className="rounded-2xl border bg-background p-6 shadow-lg shadow-primary/5 sm:p-8">
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="text-pretty text-muted-foreground">{subtitle}</p>
        </div>

        {/* The form reads ?next= and ?error= from the address, so it streams in. */}
        <Suspense fallback={<AuthFormSkeleton />}>
          <AuthForm mode={mode} />
        </Suspense>

        <div className="mt-6 border-t pt-5">
          <Suspense fallback={<Skeleton aria-hidden="true" className="mx-auto h-6 w-3/4" />}>
            <AuthSwitchLink mode={mode} />
          </Suspense>
        </div>
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <LockKeyholeIcon aria-hidden="true" className="size-4 shrink-0" />
        {t("privacy")}
      </p>

      <p className="mt-3 text-center text-sm text-muted-foreground">
        {t.rich("agree", {
          terms: (text) => (
            <Link href={publicRoutes.terms} className={LEGAL_LINK_CLASS}>
              {text}
            </Link>
          ),
          privacy: (text) => (
            <Link href={publicRoutes.privacy} className={LEGAL_LINK_CLASS}>
              {text}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}

function AuthFormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
