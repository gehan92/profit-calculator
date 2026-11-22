import { WrenchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getPlatformSettings } from "@/lib/platform/platform-settings";

/**
 * "Back soon" strip at the top of My Business while the Admin has maintenance
 * mode ON (Part C2 "Access rules": calculators still work; My Business shows a
 * "Back soon" banner). Shows nothing when maintenance is off.
 */
export async function MaintenanceBanner() {
  const { maintenance } = await getPlatformSettings();
  if (!maintenance.on) return null;

  const t = await getTranslations("maintenance");
  return (
    <div role="status" data-testid="maintenance-banner" className="border-b bg-warning/15">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3 text-sm sm:px-6">
        <WrenchIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
        <p>
          <strong className="block">{t("title")}</strong>
          <span className="block font-normal">{t("body")}</span>
        </p>
      </div>
    </div>
  );
}
