"use client";

import { CopyIcon, MessageCircleIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCalculator, type CalculatorId } from "@/config/calculators";
import { publicRoutes } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";

interface ResultActionsProps {
  /** Which calculator this is, for analytics (Part F4.6). */
  calculator: CalculatorId;
  /** Text for WhatsApp and Copy. `null` while there is no result yet. */
  shareText: string | null;
  onReset: () => void;
}

/** Sends `calc_used` once per page visit, when the first result appears. */
function useTrackFirstResult(calculator: CalculatorId, hasResult: boolean) {
  const locale = useLocale();
  const alreadySent = useRef(false);

  useEffect(() => {
    if (!hasResult || alreadySent.current) return;
    alreadySent.current = true;
    track("calc_used", { calculator, locale });
  }, [calculator, hasResult, locale]);
}

/**
 * Sinhala and Tamil labels are long ("පිටපත් කරන්න"), so these buttons may wrap
 * onto two lines on small phones instead of pushing the page wider.
 */
const WRAPPING_BUTTON = "h-auto min-h-12 py-2 text-center leading-tight whitespace-normal";

/**
 * The result buttons from Part D1: WhatsApp, Copy, Reset, Save to my records.
 * "Save" opens My Business (guest mode, Day 7).
 */
export function ResultActions({ calculator, shareText, onReset }: ResultActionsProps) {
  const t = useTranslations("calcUi");
  const hasResult = shareText !== null;
  const page = getCalculator(calculator).href;

  useTrackFirstResult(calculator, hasResult);

  async function copyResult() {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  const whatsappContent = (
    <>
      <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
      {t("whatsapp")}
    </>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {hasResult ? (
          <Button asChild className={WRAPPING_BUTTON}>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("share_whatsapp", { page })}
            >
              {whatsappContent}
            </a>
          </Button>
        ) : (
          <Button disabled className={WRAPPING_BUTTON}>
            {whatsappContent}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={copyResult}
          disabled={!hasResult}
          className={WRAPPING_BUTTON}
        >
          <CopyIcon data-icon="inline-start" aria-hidden="true" />
          {t("copy")}
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Button asChild variant="secondary" className={WRAPPING_BUTTON}>
          <Link
            href={publicRoutes.tryMyBusiness}
            onClick={() => track("save_prompt_clicked", { page })}
          >
            <SaveIcon data-icon="inline-start" aria-hidden="true" />
            {t("save")}
          </Link>
        </Button>
        <Button variant="ghost" onClick={onReset} className={`${WRAPPING_BUTTON} text-muted-foreground`}>
          <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
          {t("reset")}
        </Button>
      </div>
    </div>
  );
}
