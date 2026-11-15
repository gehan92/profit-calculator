import { notFound } from "next/navigation";

/** Sends any unknown /[locale]/... address to the translated not-found page. */
export default function CatchAllPage() {
  notFound();
}
