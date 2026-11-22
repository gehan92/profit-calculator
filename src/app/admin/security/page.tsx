import type { Metadata } from "next";
import { Suspense } from "react";
import { MfaPanel } from "@/components/admin/mfa-panel";
import { PageHeader, Panel } from "@/components/admin/admin-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/lib/admin/admin-guard";

export const metadata: Metadata = { title: "Two-step login" };

/**
 * /admin/security: two-step login for the team (Part F5 "MFA for admins").
 *
 * It is the one admin page a person can open before entering their code:
 * every other admin page and action sends them here first.
 */
export default function AdminSecurityPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full max-w-xl rounded-2xl" />}>
      <SecurityContent />
    </Suspense>
  );
}

async function SecurityContent() {
  const { mfaStep } = await requireAdminPage("manageSecurity", { skipMfa: true });

  const title = mfaStep === "enroll" ? "Set up two-step login" : mfaStep === "challenge" ? "Enter your code" : "Two-step login";
  const description =
    mfaStep === "done"
      ? "Extra protection for everyone who can open the admin panel."
      : "The admin panel can see every user, so it needs a second step at login: a 6-digit code from an authenticator app.";

  return (
    <>
      <PageHeader title={title} description={description} />
      <Panel className="max-w-xl">
        <MfaPanel step={mfaStep} />
      </Panel>
    </>
  );
}
