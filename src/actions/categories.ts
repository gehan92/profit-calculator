"use server";

import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import type { CategoryRow } from "@/lib/categories/category";
import {
  CATEGORY_COLORS,
  CATEGORY_NAME_MAX,
  CategoryQueryError,
  CategoryRepository,
} from "@/lib/categories/category-repository";
import { refreshDashboard } from "@/lib/dashboard-cache";

/**
 * Category Server Actions (Part D9, Settings → Categories): Owner only.
 * Each one: validate with zod → check the role → write (RLS and the database
 * rules check again) → refresh the dashboard → return `{ ok, error? }`.
 */

export type CategoryActionError =
  | "invalid"
  | "nameRequired"
  | "nameTooLong"
  | "nameTaken"
  | "notLoggedIn"
  | "notAllowed"
  | "notFound"
  | "tooMany"
  | "saveFailed";

export type CategoryActionResult = { ok: true; category?: CategoryRow } | { ok: false; error: CategoryActionError };

const idSchema = z.uuid();
const nameSchema = z.string().trim().min(1, "nameRequired").max(CATEGORY_NAME_MAX, "nameTooLong");

function nameError(error: z.ZodError): CategoryActionError {
  const message = error.issues[0]?.message;
  return message === "nameRequired" || message === "nameTooLong" ? message : "invalid";
}

/** Runs one category change as the Owner, with the same error handling for every action. */
async function run(
  action: (repository: CategoryRepository, businessId: string) => Promise<CategoryActionResult>,
): Promise<CategoryActionResult> {
  try {
    const access = await authorize("manageCategories", { limit: "entryChange" });
    if (!access.ok) return { ok: false, error: access.error };

    const result = await action(new CategoryRepository(access.supabase), access.membership.business.id);
    if (result.ok) refreshDashboard();
    return result;
  } catch (error) {
    if (error instanceof CategoryQueryError && error.isNameTaken) return { ok: false, error: "nameTaken" };
    // A category kind that cannot be a hidden cost, or a default one given no name: not a server fault.
    if (error instanceof CategoryQueryError && error.code === "23514") return { ok: false, error: "invalid" };
    return { ok: false, error: "saveFailed" };
  }
}

// ------------------------------------------------------------ createCategory

const createSchema = z.object({
  type: z.enum(["income", "expense"]),
  name: nameSchema,
  hiddenCost: z.boolean(),
  color: z.enum(CATEGORY_COLORS),
});

/** "+ New category" in Add entry and Settings → Categories. Unlimited and free for everyone (Part D9). */
export async function createCategory(input: {
  type: "income" | "expense";
  name: string;
  hiddenCost: boolean;
  color: string;
}): Promise<CategoryActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: nameError(parsed.error) };

  return run(async (repository, businessId) => ({
    ok: true,
    category: await repository.create(businessId, parsed.data),
  }));
}

// ------------------------------------------------------------ changeCategory

const changeSchema = z.object({
  id: idSchema,
  change: z
    .object({
      name: nameSchema.nullable().optional(),
      archived: z.boolean().optional(),
      hiddenCost: z.boolean().optional(),
      color: z.enum(CATEGORY_COLORS).optional(),
    })
    .refine((change) => Object.values(change).some((value) => value !== undefined), "invalid"),
});

/** What the Owner can change on one category in one go. Only the fields given are changed. */
export interface CategoryChangeInput {
  /** A new name; `null` goes back to the default name (default categories only). */
  name?: string | null;
  /** Hide it from the picker (`true`) or show it again (`false`). */
  archived?: boolean;
  /** Mark an expense category as a hidden cost (it then counts in Real profit only). */
  hiddenCost?: boolean;
  color?: string;
}

/** Renames, hides or shows, marks as a hidden cost or recolours one category. Old entries keep pointing to it. */
export async function changeCategory(id: string, change: CategoryChangeInput): Promise<CategoryActionResult> {
  const parsed = changeSchema.safeParse({ id, change });
  if (!parsed.success) return { ok: false, error: nameError(parsed.error) };

  const value = parsed.data.change;
  return run(async (repository) => {
    const changed = await repository.update(parsed.data.id, {
      name: value.name,
      archived: value.archived,
      countsAs: value.hiddenCost === undefined ? undefined : value.hiddenCost ? "hidden_cost" : "normal",
      color: value.color,
    });
    return changed ? { ok: true } : { ok: false, error: "notFound" };
  });
}

// ------------------------------------------------------------ saveCategoryOrder

const orderSchema = z.array(idSchema).min(1).max(100);

/** Saves a new order (first to last) for the categories of one kind. */
export async function saveCategoryOrder(orderedIds: readonly string[]): Promise<CategoryActionResult> {
  const parsed = orderSchema.safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: "invalid" };

  return run(async (repository) => {
    await repository.reorder(parsed.data);
    return { ok: true };
  });
}
