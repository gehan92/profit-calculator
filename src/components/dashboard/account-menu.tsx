"use client";

import { CalculatorIcon, LogOutIcon, SettingsIcon, UserRoundIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { signOut } from "@/actions/auth";
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
import { dashboardRoutes } from "@/lib/roles";

const LOGOUT_FORM_ID = "logout-form";

/**
 * The avatar menu in the dashboard header (Part C1.2): who is logged in,
 * Settings (Owner), the free calculators and Log out.
 */
export function AccountMenu({ email, showSettings }: { email: string | null; showSettings: boolean }) {
  const t = useTranslations("account");
  const locale = useLocale();

  return (
    <>
      {/*
        The form stays on the page: the menu closes (and disappears) as soon as
        "Log out" is tapped, which would otherwise cut off the move to the home page.
        A real form also works before JavaScript has loaded.
      */}
      <form id={LOGOUT_FORM_ID} action={signOut} hidden>
        <input type="hidden" name="locale" value={locale} />
      </form>
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
          {showSettings && (
            <DropdownMenuItem asChild className="min-h-11">
              <Link href={dashboardRoutes.settings}>
                <SettingsIcon aria-hidden="true" />
                {t("settings")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className="min-h-11">
            <Link href="/#calculators">
              <CalculatorIcon aria-hidden="true" />
              {t("calculators")}
            </Link>
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
