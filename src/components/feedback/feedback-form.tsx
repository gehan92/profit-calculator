"use client";

import { CircleCheckIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendFeedback } from "@/actions/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import { cleanPageParam, FEEDBACK_CONTACT_MAX, FEEDBACK_MESSAGE_MAX } from "@/lib/feedback/feedback";

type Status = "typing" | "sending" | "sent";

/**
 * The feedback form (Part D2 "Feedback": message, optional contact, page
 * address attached automatically). Open to everyone, guests too.
 *
 * `website` is a trap for scripts: it is hidden from people, and a message
 * that fills it is thrown away by the server.
 */
export function FeedbackForm() {
  const t = useTranslations("feedback");
  const searchParams = useSearchParams();
  const page = cleanPageParam(searchParams.get("from"));

  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("typing");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const text = message.trim();
    if (text.length === 0) return setError(t("emptyError"));
    if (text.length > FEEDBACK_MESSAGE_MAX) return setError(t("tooLong", { max: FEEDBACK_MESSAGE_MAX }));

    setStatus("sending");
    try {
      const result = await sendFeedback({ message: text, contact, page, website });
      if (result.ok) {
        track("feedback_sent", {});
        setMessage("");
        setContact("");
        setStatus("sent");
        return;
      }
      setError(
        result.error === "tooMany" ? t("tooMany") : result.error === "invalid" ? t("tooLong", { max: FEEDBACK_MESSAGE_MAX }) : t("failed"),
      );
    } catch {
      setError(t("failed"));
    }
    setStatus("typing");
  }

  if (status === "sent") {
    return (
      <div role="status" className="space-y-4 rounded-2xl bg-accent p-6 text-center" data-testid="feedback-thanks">
        <CircleCheckIcon aria-hidden="true" className="mx-auto size-10 text-primary" />
        <h2 className="text-xl font-semibold">{t("thanksTitle")}</h2>
        <p className="text-pretty">{t("thanksBody")}</p>
        <Button variant="outline" className="bg-background" onClick={() => setStatus("typing")}>
          {t("sendAnother")}
        </Button>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl bg-loss/10 p-4 text-sm font-medium text-loss">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="feedback-message" className="text-base">
          {t("messageLabel")}
        </Label>
        <Textarea
          id="feedback-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t("messagePlaceholder")}
          rows={6}
          maxLength={FEEDBACK_MESSAGE_MAX + 200}
          aria-invalid={error !== null && message.trim().length === 0}
          disabled={sending}
        />
        <p className="text-end text-xs text-muted-foreground" aria-hidden="true">
          {message.length} / {FEEDBACK_MESSAGE_MAX}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-contact" className="text-base">
          {t("contactLabel")}
        </Label>
        <Input
          id="feedback-contact"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          maxLength={FEEDBACK_CONTACT_MAX}
          autoComplete="off"
          className="h-12 text-base"
          disabled={sending}
        />
        <p className="text-sm text-muted-foreground">{t("contactHint")}</p>
      </div>

      {/* Trap for scripts: people never see or reach this field. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>

      {page && <p className="text-sm text-muted-foreground">{t("pageNote", { page })}</p>}

      <Button type="submit" size="lg" className="h-auto min-h-14 py-2 text-center leading-tight whitespace-normal w-full sm:w-auto sm:px-8" disabled={sending}>
        <SendIcon data-icon="inline-start" aria-hidden="true" />
        {sending ? t("sending") : t("send")}
      </Button>
    </form>
  );
}
