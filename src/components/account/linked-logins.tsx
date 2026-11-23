"use client";

import { MailIcon, PhoneIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { unlinkLogin } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRouter } from "@/i18n/navigation";
import { accountTabHref } from "@/lib/account/tabs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type LoginProvider = "google" | "email" | "phone";

export interface LinkedLogin {
  /** Supabase's id for this login (needed to remove it). */
  id: string;
  provider: LoginProvider;
  /** The email address or phone number it belongs to, as the login provider knows it. */
  detail: string | null;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.04 5.04 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.99 7.28-2.67l-3.54-2.75c-.98.66-2.24 1.05-3.74 1.05-2.88 0-5.31-1.94-6.18-4.55H2.16v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.82 14.08A6.6 6.6 0 0 1 5.47 12c0-.72.12-1.42.35-2.08V7.08H2.16A11 11 0 0 0 1 12c0 1.78.43 3.46 1.16 4.92l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.46 2.1 14.97 1 12 1A11 11 0 0 0 2.16 7.08l3.66 2.84C6.69 7.32 9.12 5.38 12 5.38Z" />
    </svg>
  );
}

const PROVIDER_ICON: Record<LoginProvider, ReactNode> = {
  google: <GoogleMark />,
  email: <MailIcon aria-hidden="true" className="size-5" />,
  phone: <PhoneIcon aria-hidden="true" className="size-5" />,
};

/**
 * Account → Login & security → how this person logs in (Google, email link,
 * phone code). A login can be removed while at least one other remains, and
 * Google can be added to an account made with an email link.
 */
export function LinkedLogins({ logins }: { logins: readonly LinkedLogin[] }) {
  const t = useTranslations("accountPage");
  const locale = useLocale();
  const router = useRouter();
  const [removing, setRemoving] = useState<LinkedLogin | null>(null);
  const [busy, setBusy] = useState(false);

  const hasGoogle = logins.some((login) => login.provider === "google");
  const providerName = (provider: LoginProvider) => t(`security.providers.${provider}`);

  async function confirmRemove() {
    if (!removing) return;
    if (!navigator.onLine) return void toast.error(t("common.offline"));

    setBusy(true);
    try {
      const result = await unlinkLogin(removing.id);
      if (result.ok) {
        toast.success(t("security.loginRemoved"));
        setRemoving(null);
        router.refresh();
      } else if (result.error === "lastLogin") {
        toast.error(t("security.lastLogin"));
        setRemoving(null);
      } else {
        toast.error(t("common.saveFailed"));
      }
    } catch {
      toast.error(t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addGoogle() {
    if (!navigator.onLine) return void toast.error(t("common.offline"));
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const next = `/${locale}${accountTabHref("security")}`;
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    // On success the browser leaves for Google, so this only runs when something went wrong.
    if (error) toast.error(t("security.addGoogleFailed"));
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-xl border bg-background">
        {logins.map((login) => (
          <li key={login.id} className="flex min-h-16 items-center gap-3 px-4 py-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              {PROVIDER_ICON[login.provider]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{providerName(login.provider)}</span>
              {login.detail && <span className="block text-sm break-all text-muted-foreground">{login.detail}</span>}
            </span>
            {logins.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-h-11 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={busy}
                aria-label={t("security.removeLoginLabel", { method: providerName(login.provider) })}
                onClick={() => setRemoving(login)}
              >
                {t("security.remove")}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {logins.length === 1 && <p className="text-sm text-muted-foreground">{t("security.onlyLogin")}</p>}

      {!hasGoogle && (
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-12 w-full bg-background px-5 py-2 text-base whitespace-normal sm:w-auto"
          disabled={busy}
          onClick={() => void addGoogle()}
        >
          <GoogleMark />
          {t("security.addGoogle")}
        </Button>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && !busy && setRemoving(null)}
        title={t("security.removeTitle")}
        description={t("security.removeBody", { method: removing ? providerName(removing.provider) : "" })}
        confirmLabel={t("security.removeConfirm")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => void confirmRemove()}
      />
    </div>
  );
}
