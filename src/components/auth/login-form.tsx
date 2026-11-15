"use client";

import { MailCheckIcon, MailIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authRoutes, dashboardPath, safeNextPath } from "@/lib/auth/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type EmailState =
  | { step: "typing" }
  | { step: "sending" }
  | { step: "sent"; email: string };

const emailSchema = z.email();

/** Sinhala and Tamil labels are long: let buttons wrap instead of cutting the text. */
const WRAPPING_BUTTON = "h-auto min-h-12 w-full py-2 text-center leading-tight whitespace-normal";

/**
 * Login (Part C2 "Other screens", Part D2): Continue with Google, or a login
 * link by email (the backup method). Phone OTP comes once an SMS provider is
 * chosen.
 *
 * Both methods come back through /auth/callback, which creates the first shop.
 */
export function LoginForm() {
  const t = useTranslations("login");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), dashboardPath(locale));

  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<EmailState>({ step: "typing" });
  const [googleOpening, setGoogleOpening] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "callback" ? t("callbackError") : null,
  );

  /** Where Supabase sends the person back after Google or the email link. */
  function callbackUrl(): string {
    const url = new URL(authRoutes.callback, window.location.origin);
    url.searchParams.set("next", next);
    return url.toString();
  }

  async function continueWithGoogle() {
    setError(null);
    setGoogleOpening(true);
    const { error: oauthError } = await createSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    // On success the browser is already leaving for Google.
    if (oauthError) {
      setGoogleOpening(false);
      setError(t("failed"));
    }
  }

  async function sendLoginLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(t("invalidEmail"));
      return;
    }

    setEmailState({ step: "sending" });
    const { error: otpError } = await createSupabaseBrowserClient().auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: callbackUrl() },
    });

    if (otpError) {
      setEmailState({ step: "typing" });
      setError(otpError.status === 429 ? t("tooMany") : t("failed"));
      return;
    }
    setEmailState({ step: "sent", email: parsed.data });
  }

  if (emailState.step === "sent") {
    return (
      <div className="space-y-4 rounded-xl bg-accent p-5 text-center" role="status">
        <MailCheckIcon aria-hidden="true" className="mx-auto size-10 text-primary" />
        <h2 className="text-lg font-semibold">{t("sentTitle")}</h2>
        <p className="text-pretty">{t("sentBody", { email: emailState.email })}</p>
        <p className="text-sm text-muted-foreground">{t("sentSpam")}</p>
        <Button variant="ghost" onClick={() => setEmailState({ step: "typing" })}>
          {t("useOtherEmail")}
        </Button>
      </div>
    );
  }

  const sending = emailState.step === "sending";

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl bg-loss/10 p-4 text-sm font-medium text-loss">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className={WRAPPING_BUTTON}
        onClick={continueWithGoogle}
        disabled={googleOpening}
      >
        <GoogleLogo />
        {googleOpening ? t("googleOpening") : t("google")}
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={sendLoginLink} noValidate className="space-y-3">
        <Label htmlFor="email" className="text-base">
          {t("emailLabel")}
        </Label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="send"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("emailPlaceholder")}
          aria-invalid={error === t("invalidEmail") || undefined}
          className={cn(
            "h-14 w-full rounded-xl border border-input bg-background px-4 text-base transition-colors outline-none",
            "placeholder:text-muted-foreground/70",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          )}
        />
        <Button type="submit" className={WRAPPING_BUTTON} disabled={sending}>
          <MailIcon data-icon="inline-start" aria-hidden="true" />
          {sending ? t("sending") : t("emailButton")}
        </Button>
      </form>
    </div>
  );
}

/** Google's multi-colour "G", as Google's sign-in branding asks. */
function GoogleLogo() {
  return (
    <svg data-icon="inline-start" aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
