import { StoreIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { authRoutes } from "@/lib/auth/routes";

/**
 * Guests see "Log in" (a text button) and "Create free account" (the teal main
 * button), both on phones too; logged-in people see "My shop" (Part C1
 * navigation, C1.7). Reads the login cookie, so the header renders it inside
 * <Suspense>.
 */
export async function HeaderAccount() {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("nav")]);

  if (user) {
    return (
      <Button asChild className="h-10 px-3 sm:px-4">
        <Link href={authRoutes.dashboard}>
          <StoreIcon data-icon="inline-start" aria-hidden="true" />
          {t("myShop")}
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-0.5 sm:gap-2">
      {/* The longer Sinhala and Tamil words wrap onto two lines on a small phone instead of pushing the bar wider. */}
      <Button
        asChild
        variant="ghost"
        className="h-auto min-h-10 max-w-20 px-1.5 py-1 text-center text-xs leading-tight whitespace-normal text-foreground sm:max-w-none sm:px-3 sm:text-sm"
      >
        <Link href={authRoutes.login}>{t("login")}</Link>
      </Button>
      <Button
        asChild
        className="h-auto min-h-10 max-w-28 px-2 py-1 text-center text-xs leading-tight whitespace-normal sm:max-w-none sm:px-4 sm:text-sm"
      >
        <Link href={authRoutes.signup}>{t("signup")}</Link>
      </Button>
    </div>
  );
}

/** Same size as the buttons, so the header does not jump while it loads. */
export function HeaderAccountSkeleton() {
  return <Skeleton aria-hidden="true" className="h-10 w-36 rounded-lg sm:w-52" />;
}
