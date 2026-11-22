import { notFound } from "next/navigation";

/**
 * This page only ever answers "not found", so there is no UI to navigate to:
 * it opts out of Next.js's development check that navigations render instantly
 * (otherwise every wrong address printed an error in the dev console).
 */
export const instant = false;

/** Sends any unknown /[locale]/... address to the translated not-found page. */
export default function CatchAllPage() {
  notFound();
}
