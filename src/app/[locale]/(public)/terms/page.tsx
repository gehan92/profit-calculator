import { LegalPage, legalMetadata } from "@/components/legal/legal-page";

export const generateMetadata = legalMetadata("terms");

/** /[locale]/terms: the terms of use (Part F2, Part F5 "Privacy"). */
export default function TermsPage() {
  return <LegalPage id="terms" />;
}
