import { ChevronDownIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import type { CalculatorId } from "@/config/calculators";

/** Each calculator has a list of questions in `messages/*.json` → calc.<id>.faq. */
const faqSchema = z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).min(1);

/**
 * FAQ under each calculator (Part F4.5), with FAQ structured data
 * (JSON-LD) so search engines understand the questions and answers.
 *
 * Uses <details>, so it opens and closes without any JavaScript.
 */
export async function CalculatorFaq({ id }: { id: CalculatorId }) {
  const [t, tUi, locale] = await Promise.all([
    getTranslations("calc"),
    getTranslations("calcUi"),
    getLocale(),
  ]);
  const items = faqSchema.parse(t.raw(`${id}.faq`));

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section aria-labelledby="faq-title" className="mt-12">
      <h2 id="faq-title" className="text-xl font-semibold tracking-tight">
        {tUi("faqTitle")}
      </h2>

      <div className="mt-5 divide-y rounded-2xl border bg-background">
        {items.map((item) => (
          <details key={item.q} className="group px-5 sm:px-6">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDownIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="pb-5 text-pretty text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>

      <script
        type="application/ld+json"
        // Escape "<" so text can never close the script tag (Next.js JSON-LD guide).
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
    </section>
  );
}
