"use client";

import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { publicRoutes } from "@/config/site";

type FeedbackLinkProps = Omit<ComponentProps<typeof Link>, "href">;

/**
 * A link to the feedback page that remembers the page the person is on, so
 * the team knows what the message is about (Part D2 Feedback: "page URL
 * auto-attached"). The page address goes in `?from=`; the form validates it.
 */
export function FeedbackLink(props: FeedbackLinkProps) {
  const pathname = usePathname();
  const from = pathname && !pathname.endsWith(publicRoutes.feedback) ? pathname : undefined;

  return <Link {...props} href={{ pathname: publicRoutes.feedback, query: from ? { from } : {} }} />;
}
