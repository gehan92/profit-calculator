import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { publicRoutes } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { HeaderAccount, HeaderAccountSkeleton } from "./header-account";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

/**
 * Top bar (Part C1): Logo · Calculators · Language · Log in / My shop,
 * plus the "My Business (try)" link. Logged-in roles get their own
 * navigation from the dashboard layout (Day 8).
 */
export async function SiteHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Logo compactOnMobile />

        <nav aria-label={t("mainMenu")} className="ml-4 hidden items-center gap-1 md:flex">
          <HeaderLink href="/#calculators">{t("calculators")}</HeaderLink>
          <HeaderLink href={publicRoutes.tryMyBusiness}>{t("tryMyBusiness")}</HeaderLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <Suspense fallback={<HeaderAccountSkeleton />}>
            <HeaderAccount />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:px-3"
    >
      {children}
    </Link>
  );
}
