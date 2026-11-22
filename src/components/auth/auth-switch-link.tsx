"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { authRoutes, safeNextPath } from "@/lib/auth/routes";

const LINK_CLASS = "font-medium text-primary underline underline-offset-4";

/**
 * The link between the two pages (Part C1.7): "New here? Create free account"
 * on Log in, "Already have an account? Log in" on Create free account. It
 * keeps `?next=`, so a person who was on their way somewhere still gets there.
 */
export function AuthSwitchLink({ mode }: { mode: "login" | "signup" }) {
  const tLogin = useTranslations("login");
  const tSignup = useTranslations("signup");
  const searchParams = useSearchParams();

  const next = safeNextPath(searchParams.get("next"), "");
  const href = {
    pathname: mode === "login" ? authRoutes.signup : authRoutes.login,
    ...(next ? { query: { next } } : {}),
  };
  const link = (text: React.ReactNode) => (
    <Link href={href} className={LINK_CLASS}>
      {text}
    </Link>
  );

  return (
    <p className="text-center text-base text-pretty">
      {mode === "login" ? tLogin.rich("newHere", { link }) : tSignup.rich("haveAccount", { link })}
    </p>
  );
}
