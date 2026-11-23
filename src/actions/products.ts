"use server";

import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { refreshDashboard } from "@/lib/dashboard-cache";
import { productFieldsSchema, type Product, type ProductFields } from "@/lib/products/product";
import { ProductQueryError, ProductRepository } from "@/lib/products/product-repository";

/**
 * Product Server Actions (Part D8): Owner only. Each one: validate with zod →
 * check the role → write (RLS and the database rules check again) → refresh
 * the dashboard → return `{ ok, error? }`.
 */

/** A form field the person can fix, or something wrong on our side. */
export type ProductActionError =
  | "nameRequired"
  | "nameTooLong"
  | "companyRequired"
  | "companyTooLong"
  | "invalidAmount"
  | "barcodeTooLong"
  | "notesTooLong"
  | "invalid"
  /** The Free plan's 20 active products are used up. */
  | "limitReached"
  /** Another active product already has this name. */
  | "nameTaken"
  | "notLoggedIn"
  | "notAllowed"
  | "notFound"
  | "tooMany"
  | "saveFailed";

export type ProductActionResult = { ok: true; product?: Product } | { ok: false; error: ProductActionError };

const FIELD_ERRORS: ReadonlySet<string> = new Set([
  "nameRequired",
  "nameTooLong",
  "companyRequired",
  "companyTooLong",
  "invalidAmount",
  "barcodeTooLong",
  "notesTooLong",
]);

const idSchema = z.uuid();

/** The first thing wrong with the form, as a message key the screen can show next to the field. */
function fieldError(error: z.ZodError): ProductActionError {
  const message = error.issues[0]?.message ?? "";
  return FIELD_ERRORS.has(message) ? (message as ProductActionError) : "invalid";
}

async function run(
  action: (repository: ProductRepository, businessId: string) => Promise<ProductActionResult>,
): Promise<ProductActionResult> {
  try {
    const access = await authorize("manageProducts", { limit: "entryChange" });
    if (!access.ok) return { ok: false, error: access.error };

    const result = await action(new ProductRepository(access.supabase), access.membership.business.id);
    if (result.ok) refreshDashboard();
    return result;
  } catch (error) {
    if (error instanceof ProductQueryError) {
      if (error.isLimitReached) return { ok: false, error: "limitReached" };
      if (error.isNameTaken) return { ok: false, error: "nameTaken" };
    }
    return { ok: false, error: "saveFailed" };
  }
}

/** Adds a product (`id` is `null`) or changes one. */
export async function saveProduct(id: string | null, fields: ProductFields): Promise<ProductActionResult> {
  if (id !== null && !idSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  const parsed = productFieldsSchema.safeParse(fields);
  if (!parsed.success) return { ok: false, error: fieldError(parsed.error) };

  return run(async (repository, businessId) => {
    if (id === null) return { ok: true, product: await repository.create(businessId, parsed.data) };
    const changed = await repository.update(id, parsed.data);
    return changed ? { ok: true } : { ok: false, error: "notFound" };
  });
}

/**
 * Puts a product away (it is no longer offered in Add entry, but old entries
 * keep its name) or brings it back, which counts against the Free limit again.
 */
export async function setProductArchived(id: string, archived: boolean): Promise<ProductActionResult> {
  if (!idSchema.safeParse(id).success || typeof archived !== "boolean") return { ok: false, error: "invalid" };

  return run(async (repository) => {
    const changed = await repository.setArchived(id, archived);
    return changed ? { ok: true } : { ok: false, error: "notFound" };
  });
}
