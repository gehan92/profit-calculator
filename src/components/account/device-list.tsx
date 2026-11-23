import { LaptopIcon, SmartphoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { describeDevice } from "@/lib/account/device";
import type { SignedInDevice } from "@/lib/account/profile-repository";
import { LocalDateTime } from "./local-date-time";

/** Phones and tablets get the phone icon; everything else the laptop. */
function isHandheld(os: string | null): boolean {
  return os === "Android" || os === "iPhone" || os === "iPad";
}

/**
 * Account → Login & security → the devices that are logged in right now, most
 * recently used first, with the one in use marked. Shows a recognisable
 * description ("Chrome on Android") and times only: no network address.
 */
export function DeviceList({ devices }: { devices: readonly SignedInDevice[] }) {
  const t = useTranslations("accountPage.security");

  return (
    <ul className="divide-y rounded-xl border bg-background">
      {devices.map((device) => {
        const { browser, os } = describeDevice(device.userAgent);
        const label =
          browser && os ? t("deviceLabel", { browser, os }) : (browser ?? os ?? t("deviceUnknown"));
        const Icon = isHandheld(os) ? SmartphoneIcon : LaptopIcon;

        return (
          <li key={device.id} className="flex min-h-16 items-center gap-3 px-4 py-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{label}</span>
                {device.current && (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                    {t("thisDevice")}
                  </span>
                )}
              </span>
              <span className="block text-sm text-muted-foreground">
                {t("lastUsed")} <LocalDateTime iso={device.lastSeenAt} />
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
