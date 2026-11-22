import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/admin-ui";
import {
  DefaultsSection,
  FeaturesSection,
  MaintenanceSection,
  ProLimitsSection,
  SettingsStack,
  SupportNumberSection,
} from "@/components/admin/settings-forms";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/lib/admin/admin-guard";
import { AdminRepository } from "@/lib/admin/admin-repository";

export const metadata: Metadata = { title: "Settings" };

/**
 * /admin/settings — website-wide switches (Part D4 Settings): maintenance
 * mode, feature flags, Pro limits, defaults for new shops and the support
 * WhatsApp number. Admin only; every change is checked on the server, saved
 * under the Admin's own login (Row Level Security allows only admins) and
 * written to the audit log with the old and new value.
 */
export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const { supabase } = await requireAdminPage("changeSettings");
  const settings = await new AdminRepository(supabase).settings();

  return (
    <>
      <PageHeader title="Settings" description="Changes apply to the whole website at once." />
      {/* `key` starts the forms fresh from the saved values after each save. */}
      <SettingsStack>
        <MaintenanceSection key={`m-${settings.maintenance.on}`} initial={settings.maintenance} />
        <FeaturesSection key={`f-${JSON.stringify(settings.features)}`} initial={settings.features} />
        <ProLimitsSection key={`p-${JSON.stringify(settings.pro_limits)}`} initial={settings.pro_limits} />
        <DefaultsSection key={`d-${JSON.stringify(settings.defaults)}`} initial={settings.defaults} />
        <SupportNumberSection key={`s-${settings.support.whatsapp}`} initial={settings.support} />
      </SettingsStack>
    </>
  );
}

function SettingsSkeleton() {
  return (
    <div className="max-w-2xl space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
