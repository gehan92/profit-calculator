import { getTranslations } from "next-intl/server";
import { BusinessTypeForm } from "@/components/account/business-type-form";
import { AccessLog } from "@/components/account/access-log";
import { AvatarEditor } from "@/components/account/avatar-editor";
import { DeviceList } from "@/components/account/device-list";
import { ExportMyDataCard } from "@/components/account/export-my-data-card";
import { LinkedLogins, type LinkedLogin, type LoginProvider } from "@/components/account/linked-logins";
import { LogoutAllCard } from "@/components/account/logout-all-card";
import { NameForm } from "@/components/account/name-form";
import { NotificationsForm } from "@/components/account/notifications-form";
import { BillingHistory, PlanCard } from "@/components/account/plan-card";
import { RegionForm } from "@/components/account/region-form";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { ExportCard } from "@/components/settings/export-card";
import { SettingsCard } from "@/components/settings/settings-card";
import { SupportAccessCard } from "@/components/settings/support-access-card";
import type { AppLocale } from "@/i18n/config";
import { planState } from "@/lib/account/billing";
import { BillingRepository } from "@/lib/account/billing-repository";
import { ProfileRepository } from "@/lib/account/profile-repository";
import { isSupportAccessActive } from "@/lib/account/support-access";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { businessTypeOrDefault } from "@/lib/business/business-types";
import { utcIsoDate } from "@/lib/dates";
import { can } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The six sections of the Account page (spec D6). Each loads only what it
 * shows, with the person's own database client, so one slow or failing
 * section never stops the others. Rendered on the server; the forms inside are
 * Client Components.
 */

interface PanelProps {
  locale: AppLocale;
}

/** A list that failed to load shows as empty instead of breaking the whole section. */
async function orElse<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch {
    return fallback;
  }
}

// --------------------------------------------------------------------- Profile

export async function ProfilePanel({ locale }: PanelProps) {
  const [{ user, membership }, t] = await Promise.all([
    getDashboardContext(locale),
    getTranslations({ locale, namespace: "accountPage" }),
  ]);
  const profile = await new ProfileRepository(await createSupabaseServerClient()).getAccountProfile(user.id);
  const initial = (profile.fullName ?? user.email ?? "").trim().charAt(0).toUpperCase();
  const isOwner = can(membership.role, "editShop");

  return (
    <div className="space-y-5">
      <SettingsCard id="photo" title={t("profile.photoTitle")} description={t("profile.photoBody")}>
        <AvatarEditor initialUrl={profile.avatarUrl} initial={initial} />
      </SettingsCard>

      <SettingsCard id="name" title={t("profile.nameTitle")}>
        <NameForm initialName={profile.fullName ?? ""} />
      </SettingsCard>

      <SettingsCard
        id="business"
        title={t("profile.businessTitle")}
        description={isOwner ? t("profile.businessBody") : t("profile.businessStaff")}
      >
        {isOwner && <BusinessTypeForm initial={businessTypeOrDefault(membership.business.business_type)} />}
      </SettingsCard>
    </div>
  );
}

// ------------------------------------------------------------ Login & security

const KNOWN_PROVIDERS: readonly LoginProvider[] = ["google", "email", "phone"];

export async function SecurityPanel({ locale }: PanelProps) {
  const [t, supabase] = await Promise.all([
    getTranslations({ locale, namespace: "accountPage" }),
    createSupabaseServerClient(),
  ]);

  const [identities, devices] = await Promise.all([
    orElse(
      supabase.auth.getUserIdentities().then(({ data }) => data?.identities ?? []),
      [],
    ),
    orElse(new ProfileRepository(supabase).listDevices(), []),
  ]);

  const logins: LinkedLogin[] = identities.flatMap((identity) => {
    const provider = identity.provider as LoginProvider;
    if (!KNOWN_PROVIDERS.includes(provider)) return [];

    const data = (identity.identity_data ?? {}) as { email?: string; phone?: string };
    return [{ id: identity.identity_id, provider, detail: provider === "phone" ? (data.phone ?? null) : (data.email ?? null) }];
  });

  return (
    <div className="space-y-5">
      <SettingsCard id="logins" title={t("security.loginsTitle")} description={t("security.loginsBody")}>
        <LinkedLogins logins={logins} />
      </SettingsCard>

      <SettingsCard id="devices" title={t("security.devicesTitle")} description={t("security.devicesBody")}>
        {devices.length > 0 ? (
          <DeviceList devices={devices} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("security.devicesUnavailable")}</p>
        )}
        <LogoutAllCard />
      </SettingsCard>
    </div>
  );
}

// ----------------------------------------------------------- Language & region

export async function LanguagePanel({ locale }: PanelProps) {
  const [{ user }, t] = await Promise.all([
    getDashboardContext(locale),
    getTranslations({ locale, namespace: "accountPage" }),
  ]);
  const profile = await new ProfileRepository(await createSupabaseServerClient()).getAccountProfile(user.id);

  return (
    <SettingsCard id="region" title={t("language.title")}>
      <RegionForm
        initial={{ dateFormat: profile.dateFormat, defaultCurrency: profile.defaultCurrency }}
        exampleDate={utcIsoDate()}
      />
    </SettingsCard>
  );
}

// ------------------------------------------------------------- Plan & billing

export async function PlanPanel({ locale }: PanelProps) {
  const [{ user }, t] = await Promise.all([
    getDashboardContext(locale),
    getTranslations({ locale, namespace: "accountPage" }),
  ]);
  const billing = new BillingRepository(await createSupabaseServerClient());
  const [subscription, payments] = await Promise.all([
    orElse(billing.currentSubscription(user.id), null),
    orElse(billing.payments(user.id), []),
  ]);

  return (
    <div className="space-y-5">
      <SettingsCard id="plan" title={t("plan.title")}>
        <PlanCard state={planState(subscription)} planName={subscription?.planName ?? null} />
      </SettingsCard>

      <SettingsCard id="history" title={t("plan.historyTitle")}>
        <BillingHistory payments={payments} />
      </SettingsCard>
    </div>
  );
}

// ------------------------------------------------------------- Privacy & data

export async function PrivacyPanel({ locale }: PanelProps) {
  const [{ user, membership }, t, tSettings] = await Promise.all([
    getDashboardContext(locale),
    getTranslations({ locale, namespace: "accountPage" }),
    getTranslations({ locale, namespace: "settings" }),
  ]);
  const profiles = new ProfileRepository(await createSupabaseServerClient());
  const [profile, accessLog] = await Promise.all([profiles.getAccountProfile(user.id), orElse(profiles.listAccessLog(), [])]);
  const isOwner = can(membership.role, "exportData");

  return (
    <div className="space-y-5">
      <SettingsCard id="support" title={tSettings("supportTitle")} description={tSettings("supportBody")}>
        <SupportAccessCard initialUntil={isSupportAccessActive(profile.supportAccessUntil) ? profile.supportAccessUntil : null} />
      </SettingsCard>

      <SettingsCard id="access-log" title={t("privacy.accessLogTitle")} description={t("privacy.accessLogBody")}>
        <AccessLog times={accessLog} />
      </SettingsCard>

      <SettingsCard
        id="data"
        title={t("privacy.dataTitle")}
        description={isOwner ? t("privacy.dataBody") : t("privacy.dataBodyMember")}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ExportMyDataCard />
          {isOwner && <ExportCard />}
        </div>
      </SettingsCard>

      <SettingsCard id="danger" title={tSettings("dangerTitle")} description={tSettings("dangerBody")} danger>
        <DeleteAccountCard />
      </SettingsCard>
    </div>
  );
}

// ---------------------------------------------------------------- Notifications

export async function NotificationsPanel({ locale }: PanelProps) {
  const [{ user }, t] = await Promise.all([
    getDashboardContext(locale),
    getTranslations({ locale, namespace: "accountPage" }),
  ]);
  const profile = await new ProfileRepository(await createSupabaseServerClient()).getAccountProfile(user.id);

  return (
    <SettingsCard id="notifications" title={t("notifications.title")} description={t("notifications.body")}>
      <NotificationsForm initial={profile.notifications} />
    </SettingsCard>
  );
}
