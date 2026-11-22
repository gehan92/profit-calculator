"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * "Welcome back!" for someone who used Create free account but already had an
 * account: they are simply logged in (Part C1.7 "No dead ends"). The dashboard
 * renders this once when the address says so.
 */
export function WelcomeBackToast() {
  const t = useTranslations("appNav");
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.success(t("welcomeBack"));
  }, [t]);

  return null;
}
