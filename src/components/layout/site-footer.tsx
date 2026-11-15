import { getTranslations } from "next-intl/server";
import { CALCULATORS } from "@/config/calculators";
import { publicRoutes } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";

export async function SiteFooter() {
  const t = await getTranslations();

  const companyLinks = [
    { href: publicRoutes.about, label: t("footer.about") },
    { href: publicRoutes.privacy, label: t("footer.privacy") },
    { href: publicRoutes.terms, label: t("footer.terms") },
    { href: publicRoutes.feedback, label: t("footer.feedback") },
  ];

  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
        </div>

        <FooterColumn title={t("nav.calculators")}>
          {CALCULATORS.map((calculator) => (
            <FooterLink key={calculator.id} href={calculator.href}>
              {t(`calc.${calculator.id}.name`)}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title={t("common.appName")}>
          {companyLinks.map((link) => (
            <FooterLink key={link.href} href={link.href}>
              {link.label}
            </FooterLink>
          ))}
        </FooterColumn>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="inline-block py-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        {children}
      </Link>
    </li>
  );
}
