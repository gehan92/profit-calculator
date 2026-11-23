import { useTranslations } from "next-intl";
import { LocalDateTime } from "./local-date-time";

/**
 * Account → Privacy & data → "Who looked at my account": every time our team
 * opened this account (only possible while support access was on), newest
 * first. Shows times only, never who.
 */
export function AccessLog({ times }: { times: readonly string[] }) {
  const t = useTranslations("accountPage.privacy");

  if (times.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-center text-muted-foreground">{t("accessLogEmpty")}</p>;
  }

  return (
    <ul className="divide-y rounded-xl border bg-background">
      {times.map((time, index) => (
        <li key={`${time}-${index}`} className="flex min-h-12 items-center px-4 py-2">
          <LocalDateTime iso={time} />
        </li>
      ))}
    </ul>
  );
}
