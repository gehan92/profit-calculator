"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { MessageScreen } from "@/components/layout/message-screen";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Shown when a page breaks while it is being drawn (Part E4: friendly message +
 * one action). The person is never shown technical details.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  const tCommon = useTranslations("common");

  useEffect(() => {
    // Visible to the developer in the browser console and in the hosting service's logs.
    console.error(error);
  }, [error]);

  return (
    <MessageScreen
      icon={TriangleAlertIcon}
      tone="warning"
      title={t("title")}
      actions={
        <>
          <Button type="button" size="lg" className="h-auto min-h-14 py-2 text-center leading-tight whitespace-normal w-full sm:w-auto sm:px-8" onClick={reset}>
            {t("retry")}
          </Button>
          <Button asChild variant="ghost" size="lg" className="h-auto min-h-14 py-2 text-center leading-tight whitespace-normal w-full sm:w-auto">
            <Link href="/">{tCommon("backHome")}</Link>
          </Button>
        </>
      }
    >
      <p>{t("body")}</p>
    </MessageScreen>
  );
}
