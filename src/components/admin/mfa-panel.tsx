"use client";

import { ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cleanMfaCode, isValidMfaCode, type MfaStep } from "@/lib/admin/mfa";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NOT_RIGHT = "That code is not right. Check the code in your app and try again.";
const FAILED = "It did not work. Please try again.";

type Setup = { factorId: string; qrCode: string; secret: string };

/**
 * Two-step login for the team (Part F5 "Admin protection: MFA for admins"):
 * link an authenticator app once, then type its 6-digit code at every login.
 *
 * The codes are checked by Supabase from the browser (like the login page);
 * a correct code upgrades the login to "aal2", which the admin panel then
 * requires on every page and action.
 */
export function MfaPanel({ step }: { step: MfaStep }) {
  if (step === "done") return <TurnedOn />;
  return step === "enroll" ? <SetUp /> : <EnterCode />;
}

function TurnedOn() {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-accent p-4" role="status">
      <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
      <div className="space-y-1">
        <p className="font-semibold">Two-step login is on</p>
        <p className="text-sm text-muted-foreground">
          You type a code from your authenticator app every time you log in to the admin panel. If you lose your
          phone, remove the app from this account in the Supabase dashboard (Authentication → Users) and set it up
          again.
        </p>
        <Link href="/admin" className="inline-block pt-1 text-sm font-medium text-primary underline underline-offset-4">
          Go to the admin panel
        </Link>
      </div>
    </div>
  );
}

/** First time: show a QR code, then ask for the first code to prove the app works. */
function SetUp() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setStarting(true);
    const supabase = createSupabaseBrowserClient();

    // A set-up that was started but never finished leaves a half-made app behind: remove it first.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const factor of factors?.all ?? []) {
      if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    setStarting(false);
    if (enrollError || !data) {
      setError(
        enrollError?.message.toLowerCase().includes("disabled")
          ? "Two-step login is switched off in Supabase. Turn on MFA (TOTP) under Authentication → Sign In / Providers."
          : FAILED,
      );
      return;
    }
    setSetup({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  if (!setup) {
    return (
      <div className="space-y-5">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Install an authenticator app on your phone (for example Google Authenticator or Microsoft Authenticator).</li>
          <li>Tap Start, then scan the QR code.</li>
          <li>Type the 6-digit code the app shows.</li>
        </ol>
        {error && <ErrorLine text={error} />}
        <Button size="lg" onClick={start} disabled={starting} data-testid="mfa-start">
          {starting ? "Starting…" : "Start"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-medium">1. Scan this QR code with your authenticator app</p>
        {/* A data: image made by Supabase for this one set-up; next/image has nothing to optimise. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qrCode} alt="QR code" className="size-48 rounded-lg border bg-white p-2" />
        <p className="text-sm text-muted-foreground">
          Cannot scan? Choose &ldquo;enter a key&rdquo; in the app and type:{" "}
          <code data-testid="mfa-secret" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
            {setup.secret}
          </code>
        </p>
      </div>
      <CodeForm factorId={setup.factorId} label="2. Type the 6-digit code from the app" button="Turn on" />
    </div>
  );
}

/** Every later login: the factor exists, ask for today's code. */
function EnterCode() {
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // The linked app's id, read once when the person starts typing.
  async function findFactor(): Promise<string | null> {
    if (factorId !== undefined) return factorId;
    const { data } = await createSupabaseBrowserClient().auth.mfa.listFactors();
    const id = data?.totp.find((factor) => factor.status === "verified")?.id ?? null;
    setFactorId(id);
    return id;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Open your authenticator app and type the 6-digit code for Profit Calculator.
      </p>
      {error && <ErrorLine text={error} />}
      <CodeForm findFactor={findFactor} onProblem={setError} label="Code" button="Continue" />
    </div>
  );
}

function CodeForm(props: {
  /** Known right away while setting up. */
  factorId?: string;
  /** Looked up on submit when logging in. */
  findFactor?: () => Promise<string | null>;
  onProblem?: (message: string | null) => void;
  label: string;
  button: string;
}) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function problem(message: string | null) {
    setError(message);
    props.onProblem?.(message);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = cleanMfaCode(code);
    if (!isValidMfaCode(clean)) {
      problem("Please type the 6 digits from your app.");
      return;
    }

    setChecking(true);
    problem(null);
    const factorId = props.factorId ?? (await props.findFactor?.());
    if (!factorId) {
      setChecking(false);
      problem(FAILED);
      return;
    }

    const { error: verifyError } = await createSupabaseBrowserClient().auth.mfa.challengeAndVerify({
      factorId,
      code: clean,
    });
    if (verifyError) {
      setChecking(false);
      setCode("");
      problem(verifyError.status === 429 ? "Too many tries. Please wait a minute and try again." : NOT_RIGHT);
      return;
    }
    // A full page load: the router may hold an earlier "go to the security page" answer for
    // /admin, and a fresh request is the surest way to use the new (aal2) login cookies.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/admin");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Label htmlFor="mfa-code" className="text-sm font-medium">
        {props.label}
      </Label>
      <input
        id="mfa-code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        enterKeyHint="done"
        maxLength={9}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="123456"
        aria-invalid={error !== null || undefined}
        className={cn(
          "h-12 w-full max-w-48 rounded-xl border border-input bg-background px-4 font-mono text-lg tracking-widest transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        )}
      />
      {/* On the code page the message is shown by the parent, above the form. */}
      {error && !props.onProblem && <ErrorLine text={error} />}
      <div>
        <Button type="submit" size="lg" disabled={checking}>
          {checking ? "Checking…" : props.button}
        </Button>
      </div>
    </form>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="rounded-xl bg-loss/10 p-3 text-sm font-medium text-loss">
      {text}
    </p>
  );
}
