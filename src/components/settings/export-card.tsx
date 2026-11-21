"use client";

import { DownloadIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { exportCsv } from "@/actions/account";
import { Button } from "@/components/ui/button";

/**
 * Settings → "Download your records" (Part D2 "export CSV"). The server builds
 * the file text from every record; this turns it into a download on the phone.
 */
export function ExportCard() {
  const t = useTranslations("settings");
  const tEntry = useTranslations("entry");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!navigator.onLine) {
      toast.error(tEntry("offlineAction"));
      return;
    }

    setBusy(true);
    try {
      const result = await exportCsv(locale);
      if (!result.ok) {
        toast.error(result.error === "empty" ? t("exportEmpty") : t("exportFailed"));
        return;
      }

      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.append(link);
      link.click();
      link.remove();
      // Give the browser a moment to start the download before releasing the file.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);

      toast.success(t("exportDone"));
      if (result.truncated) toast.warning(t("exportTruncated"));
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 w-full bg-background text-base sm:w-auto sm:px-6"
      onClick={download}
      disabled={busy}
    >
      <DownloadIcon data-icon="inline-start" aria-hidden="true" />
      {busy ? t("exporting") : t("exportButton")}
    </Button>
  );
}
