"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * "No access: toast + redirect to role landing page" (Part E4). The page a
 * role was sent back to renders this once.
 */
export function NoAccessToast() {
  const t = useTranslations("appNav");
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.error(t("noAccess"));
  }, [t]);

  return null;
}
