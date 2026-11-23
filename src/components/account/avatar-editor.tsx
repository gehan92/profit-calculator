"use client";

import { UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { removeAvatar, saveAvatar } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { AVATAR_BUCKET, AVATAR_MAX_BYTES, AVATAR_SIZE, newAvatarPath } from "@/lib/account/avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** A phone photo can be big; refuse anything over 10 MB before even opening it. */
const MAX_PICKED_BYTES = 10 * 1024 * 1024;

/** Cuts the middle square out of the picture and draws it AVATAR_SIZE pixels wide, as a small WebP. */
async function shrinkToSquare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    // An older browser that cannot make WebP answers with a PNG; the bucket accepts both.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (!blob || blob.size === 0 || blob.size > AVATAR_MAX_BYTES) throw new Error("bad picture");
    return blob;
  } finally {
    bitmap.close();
  }
}

/**
 * Account → Profile → photo. The person picks a picture, the phone shrinks it
 * to a small square and sends it to their own folder in Storage, then the
 * server keeps its address on the profile and deletes the older pictures.
 * `initialUrl` is the stored address, or `null` when there is no photo.
 */
export function AvatarEditor({ initialUrl, initial }: { initialUrl: string | null; initial: string }) {
  const t = useTranslations("accountPage");
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again still fires
    if (!file) return;

    if (file.size > MAX_PICKED_BYTES) return void toast.error(t("profile.photoTooBig"));
    if (!navigator.onLine) return void toast.error(t("common.offline"));

    setBusy(true);
    try {
      let blob: Blob;
      try {
        blob = await shrinkToSquare(file);
      } catch {
        toast.error(t("profile.photoUnreadable"));
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return void toast.error(t("profile.photoFailed"));

      const path = newAvatarPath(auth.user.id);
      const uploaded = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: blob.type });
      if (uploaded.error) return void toast.error(t("profile.photoFailed"));

      const result = await saveAvatar(path);
      if (!result.ok) {
        // Nothing was kept: do not leave a stray picture behind.
        await supabase.storage.from(AVATAR_BUCKET).remove([path]).catch(() => undefined);
        return void toast.error(t("profile.photoFailed"));
      }
      setUrl(result.url);
      toast.success(t("profile.photoSaved"));
    } catch {
      toast.error(t("profile.photoFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!navigator.onLine) return void toast.error(t("common.offline"));
    setBusy(true);
    try {
      const result = await removeAvatar();
      if (result.ok) {
        setUrl(null);
        toast.success(t("profile.photoRemoved"));
      } else {
        toast.error(t("profile.photoFailed"));
      }
    } catch {
      toast.error(t("profile.photoFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    // On a phone the photo sits above its buttons: a long Sinhala or Tamil button would not fit beside it.
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <span
        aria-hidden={url ? undefined : true}
        className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-2xl font-semibold text-primary"
      >
        {url ? (
          // A 256 px picture we made ourselves: Next's image resizer would add nothing.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={t("profile.photoAlt")} width={80} height={80} className="size-full object-cover" />
        ) : initial ? (
          initial
        ) : (
          <UserRoundIcon aria-hidden="true" className="size-9" />
        )}
      </span>

      <div className="flex min-w-0 flex-wrap gap-2">
        <input
          ref={fileInput}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => void pick(event)}
        />
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-12 bg-background px-5 py-2 text-base whitespace-normal"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? t("profile.uploading") : url ? t("profile.changePhoto") : t("profile.choosePhoto")}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-12 px-5 py-2 text-base whitespace-normal"
            disabled={busy}
            onClick={() => void remove()}
          >
            {t("profile.removePhoto")}
          </Button>
        )}
      </div>
    </div>
  );
}
