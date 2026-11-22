"use client";

import { SmartphoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { installController } from "@/lib/pwa/install-controller";

/**
 * A slim strip under the header offering "Add to your home screen" (Part F4.4):
 * from the second visit, with an Add button where the browser allows it
 * (Android, Chrome) and a two-line how-to on iPhone. Shows nothing otherwise.
 */
export function InstallPrompt() {
  const t = useTranslations("install");
  const offer = useSyncExternalStore(
    installController.subscribe,
    installController.getSnapshot,
    () => "none" as const,
  );

  useEffect(() => installController.start(), []);

  if (offer === "none") return null;

  return (
    <section aria-label={t("title")} data-testid="install-prompt" className="border-b bg-primary-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <p className="flex flex-1 items-start gap-3 text-sm">
          <SmartphoneIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <strong className="block font-semibold">{t("title")}</strong>
            <span className="block text-muted-foreground">{offer === "ios" ? t("iosBody") : t("body")}</span>
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          {offer === "prompt" && (
            <Button type="button" className="h-11" onClick={() => void installController.install()}>
              {t("add")}
            </Button>
          )}
          <Button type="button" variant="ghost" className="h-11" onClick={installController.dismiss}>
            {offer === "prompt" ? t("later") : t("close")}
          </Button>
        </div>
      </div>
    </section>
  );
}
