"use client";

import type { ComponentProps } from "react";
import { signOut } from "@/actions/auth";
import { clearPrivateCaches } from "@/lib/pwa/private-cache";

type LogoutFormProps = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  /** The language to return to; Server Actions cannot read it from the address. */
  locale: string;
};

/**
 * A log-out form. Besides logging out on the server it clears the offline copy
 * of the dashboard pages on this phone (see `clearPrivateCaches`). It is a real
 * form, so logging out also works before the page's JavaScript has loaded.
 */
export function LogoutForm({ locale, children, ...formProps }: LogoutFormProps) {
  return (
    <form {...formProps} action={signOut} onSubmit={() => void clearPrivateCaches()}>
      <input type="hidden" name="locale" value={locale} />
      {children}
    </form>
  );
}
