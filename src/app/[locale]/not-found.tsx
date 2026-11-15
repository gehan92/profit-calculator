import { CompassIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Friendly message + one action (Part E4). */
export default async function NotFound() {
  const t = await getTranslations();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <CompassIcon aria-hidden="true" className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
        <p className="text-muted-foreground">{t("notFound.body")}</p>
      </div>
      <Button asChild>
        <Link href="/">{t("common.backHome")}</Link>
      </Button>
    </main>
  );
}
