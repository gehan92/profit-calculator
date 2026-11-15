import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Hide the name on very small screens to leave room for the language switch. */
  compactOnMobile?: boolean;
}

export async function Logo({ className, compactOnMobile = false }: LogoProps) {
  const t = await getTranslations("common");

  return (
    <Link
      href="/"
      aria-label={t("appName")}
      className={cn("flex shrink-0 items-center gap-2.5 rounded-lg", className)}
    >
      <LogoMark />
      <span
        className={cn(
          "text-[1.05rem] leading-none font-semibold tracking-tight",
          compactOnMobile && "hidden sm:inline",
        )}
      >
        {t("appName")}
      </span>
    </Link>
  );
}

/** Brand mark: a rising line on the teal brand colour. */
function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-9 shrink-0">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M8 21.5l5.5-5.5 4 4L24 13.5"
        fill="none"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 13.5H24V18"
        fill="none"
        stroke="#99F6E4"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
