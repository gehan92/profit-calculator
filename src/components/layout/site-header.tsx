import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { publicRoutes } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

/**
 * Guest top bar (Part C1): Logo · Calculators · Language · Login,
 * plus the "My Business (try)" link. Logged-in roles get their own
 * navigation from the dashboard layout (Day 8).
 */
export async function SiteHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Logo compactOnMobile />

        <nav aria-label={t("mainMenu")} className="ml-4 hidden items-center gap-1 md:flex">
          <HeaderLink href="/#calculators">{t("calculators")}</HeaderLink>
          <HeaderLink href={publicRoutes.tryMyBusiness}>{t("tryMyBusiness")}</HeaderLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <Button asChild className="h-10 px-4">
            <Link href={publicRoutes.login}>{t("login")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}
