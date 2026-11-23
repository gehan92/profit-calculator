"use client";

import {
  CalculatorIcon,
  LogOutIcon,
  MessageSquareIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserCogIcon,
  UserRoundIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import NextLink from "next/link";
import { LogoutForm } from "@/components/auth/logout-form";
import { FeedbackLink } from "@/components/feedback/feedback-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { ACCOUNT_PATH } from "@/lib/account/tabs";
import { adminRoutes } from "@/lib/admin/admin-roles";
import { dashboardRoutes } from "@/lib/roles";

const LOGOUT_FORM_ID = "logout-form";

/**
 * The avatar menu in the dashboard header (Part C1.2): who is logged in,
 * Your account, Settings (Owner), the Admin panel (Support and Admin), the
 * free calculators, Send feedback and Log out.
 */
export function AccountMenu({
  email,
  showSettings,
  showAdmin,
}: {
  email: string | null;
  showSettings: boolean;
  /** Support and Admin get a link to the admin panel (Part C1: "Admin link in header"). */
  showAdmin: boolean;
}) {
  const t = useTranslations("account");
  const locale = useLocale();

  return (
    <>
      {/*
        The form stays on the page: the menu closes (and disappears) as soon as
        "Log out" is tapped, which would otherwise cut off the move to the home page.
        A real form also works before JavaScript has loaded.
      */}
      <LogoutForm id={LOGOUT_FORM_ID} locale={locale} hidden />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="size-10 rounded-full" aria-label={t("menu")}>
            <UserRoundIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {email && (
            <>
              <DropdownMenuLabel className="font-normal">
                <span className="block text-xs text-muted-foreground">{t("loggedInAs")}</span>
                <span className="block truncate font-medium">{email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          {/* Every logged-in person has an Account page, whatever their role (spec D6). */}
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={ACCOUNT_PATH}>
              <UserCogIcon aria-hidden="true" />
              {t("account")}
            </Link>
          </DropdownMenuItem>
          {showSettings && (
            <DropdownMenuItem asChild className="min-h-11">
              <Link href={dashboardRoutes.settings}>
                <SettingsIcon aria-hidden="true" />
                {t("settings")}
              </Link>
            </DropdownMenuItem>
          )}
          {showAdmin && (
            <DropdownMenuItem asChild className="min-h-11">
              {/* The admin panel is outside the translated site, so a plain link. */}
              <NextLink href={adminRoutes.dashboard}>
                <ShieldCheckIcon aria-hidden="true" />
                {t("admin")}
              </NextLink>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className="min-h-11">
            <Link href="/#calculators">
              <CalculatorIcon aria-hidden="true" />
              {t("calculators")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-11">
            <FeedbackLink>
              <MessageSquareIcon aria-hidden="true" />
              {t("feedback")}
            </FeedbackLink>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="min-h-11 w-full">
            <button type="submit" form={LOGOUT_FORM_ID}>
              <LogOutIcon aria-hidden="true" />
              {t("logout")}
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
