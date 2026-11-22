import { LegalPage, legalMetadata } from "@/components/legal/legal-page";

export const generateMetadata = legalMetadata("privacy");

/** /[locale]/privacy: the privacy policy (Part C1.1, Part F5 "Privacy"). */
export default function PrivacyPage() {
  return <LegalPage id="privacy" />;
}
