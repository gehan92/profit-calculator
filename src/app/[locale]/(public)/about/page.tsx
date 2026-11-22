import { LegalPage, legalMetadata } from "@/components/legal/legal-page";

export const generateMetadata = legalMetadata("about");

/** /[locale]/about (Part C1.1, Part F2). */
export default function AboutPage() {
  return <LegalPage id="about" />;
}
