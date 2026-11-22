import { StoreIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { authRoutes } from "@/lib/auth/routes";

/**
 * "Log in" for guests, "My shop" for logged-in people (Part C1 navigation).
 * Reads the login cookie, so the header renders it inside <Suspense>.
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
    <Button asChild className="h-10 px-3 sm:px-4">
      <Link href={authRoutes.login}>{t("login")}</Link>
    </Button>
  );
}

/** Same size as the button, so the header does not jump while it loads. */
export function HeaderAccountSkeleton() {
  return <Skeleton aria-hidden="true" className="h-10 w-24 rounded-lg" />;
}
