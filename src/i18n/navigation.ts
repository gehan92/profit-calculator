import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Language-aware replacements for Next.js navigation helpers.
 * Always import `Link`, `redirect`, `usePathname` and `useRouter` from here
 * (not from `next/link` / `next/navigation`) so the current language is kept.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
