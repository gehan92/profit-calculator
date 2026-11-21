import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Logo } from "@/components/layout/logo";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppLocale } from "@/i18n/config";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { AccountMenu } from "./account-menu";

/**
 * Header for logged-in screens (Part C1.2): shop name, a role badge for
 * Staff and Viewers (Part E3 "RoleBadge"), the language switch and the
 * account menu. Only the shop part waits for the database; the rest is
 * ready at once.
 */
export function DashboardHeader({ locale }: { locale: AppLocale }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Logo compactOnMobile />
        <Suspense fallback={<ShopSkeleton />}>
          <ShopAndAccount locale={locale} />
        </Suspense>
      </div>
    </header>
  );
}

async function ShopAndAccount({ locale }: { locale: AppLocale }) {
  const [{ user, membership }, t] = await Promise.all([
    getDashboardContext(locale),
    getTranslations("roleBadge"),
  ]);
  const { role, business } = membership;

  return (
    <>
      <div className="min-w-0 flex-1 sm:border-l sm:pl-4">
        <p className="truncate leading-tight font-semibold">{business.name}</p>
        {role !== "owner" && (
          <p className="truncate text-xs font-medium text-muted-foreground">
            {role === "staff" ? t("staff") : t("viewer")}
          </p>
        )}
      </div>
      <LanguageSwitcher />
      <AccountMenu email={user.email} />
    </>
  );
}

function ShopSkeleton() {
  return (
    <>
      <div className="min-w-0 flex-1 sm:border-l sm:pl-4">
        <Skeleton className="h-5 w-28" />
      </div>
      <LanguageSwitcher />
      <Skeleton aria-hidden="true" className="size-10 rounded-full" />
    </>
  );
}
