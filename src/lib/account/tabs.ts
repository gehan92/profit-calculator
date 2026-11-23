/**
 * The six sections of the Account page (spec D6), in the order shown. The
 * page keeps the open section in the address (`/account?tab=privacy`).
 */
export const ACCOUNT_TABS = ["profile", "security", "language", "plan", "privacy", "notifications"] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

export const DEFAULT_ACCOUNT_TAB: AccountTab = "profile";

/** The section named in the address; anything unknown opens the first one. */
export function accountTabFrom(value: string | string[] | undefined): AccountTab {
  const first = Array.isArray(value) ? value[0] : value;
  return (ACCOUNT_TABS as readonly string[]).includes(first ?? "") ? (first as AccountTab) : DEFAULT_ACCOUNT_TAB;
}

/** The address of the Account page (no language) with a section open. */
export const ACCOUNT_PATH = "/account";

export function accountTabHref(tab: AccountTab): string {
  return tab === DEFAULT_ACCOUNT_TAB ? ACCOUNT_PATH : `${ACCOUNT_PATH}?tab=${tab}`;
}
