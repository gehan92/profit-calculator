"use client";

import { DownloadIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { exportMyData } from "@/actions/profile";
import { Button } from "@/components/ui/button";

/**
 * Account → Privacy & data → "Download all my data (JSON)". The server builds
 * the document from the person's own data; the browser turns it into a file.
 * Nothing is stored on the server.
 */
export function ExportMyDataCard() {
  const t = useTranslations("accountPage");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!navigator.onLine) return void toast.error(t("common.offline"));

    setBusy(true);
    try {
      const result = await exportMyData(locale);
      if (!result.ok) return void toast.error(t("privacy.downloadFailed"));

      const url = URL.createObjectURL(new Blob([result.json], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.append(link);
      link.click();
      link.remove();
      // Give the browser a moment to start the download before the address is released.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(t("privacy.downloaded"));
    } catch {
      toast.error(t("privacy.downloadFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-12 w-full bg-background px-5 py-2 text-base whitespace-normal sm:w-auto"
      disabled={busy}
      onClick={() => void download()}
    >
      <DownloadIcon data-icon="inline-start" aria-hidden="true" />
      {busy ? t("privacy.preparing") : t("privacy.downloadJson")}
    </Button>
  );
}
