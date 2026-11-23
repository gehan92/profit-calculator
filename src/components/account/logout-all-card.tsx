"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { logoutAllDevices } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRouter } from "@/i18n/navigation";
import { clearPrivateCaches } from "@/lib/pwa/private-cache";

/**
 * Account → Login & security → "Log out of all devices". Asks first, because
 * it also logs this device out. The server ends every login and sends the
 * person to the home page.
 */
export function LogoutAllCard() {
  const t = useTranslations("accountPage");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function confirm() {
    if (!navigator.onLine) return void toast.error(t("common.offline"));

    try {
      const result = await logoutAllDevices();
      if (result.ok) {
        // The offline copy of the dashboard on this phone goes too (as in a normal log out),
        // then the home page opens. The server has already cleared the login cookies.
        await clearPrivateCaches();
        router.replace("/");
        return;
      }
    } catch {
      // fall through to the message below
    }
    toast.error(t("security.logoutAllFailed"));
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-12 w-full bg-background px-5 py-2 text-base whitespace-normal sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <LogOutIcon data-icon="inline-start" aria-hidden="true" />
        {t("security.logoutAllButton")}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("security.logoutAllConfirmTitle")}
        description={t("security.logoutAllBody")}
        confirmLabel={t("security.logoutAllConfirm")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => void confirm()}
      />
    </>
  );
}
