import "server-only";
import { cache } from "react";
import type { AppLocale } from "@/i18n/config";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FeatureRepository } from "./feature-repository";
import { resolveFeatures, type FeatureContext } from "./flag";

/**
 * Which features are on for the logged-in person (spec D7, "How the code uses
 * it"): the database says which keys are on for them (status, plan, testers,
 * rollout), then the limits by role and language are applied. One answer per
 * request, shared by the menu and the page.
 *
 * Reads the login cookie: call it inside a <Suspense> boundary.
 */
const loadFeatures = cache(async (role: FeatureContext["role"], locale: string): Promise<ReadonlySet<string>> => {
  const repository = new FeatureRepository(await createSupabaseServerClient());
  const [keys, flags] = await Promise.all([repository.enabledKeys(), repository.list()]);
  return resolveFeatures(keys, flags, { role, locale });
});

/** The features that are on for this person on a dashboard page in this language. */
export async function getFeatures(locale: AppLocale): Promise<ReadonlySet<string>> {
  const { membership } = await getDashboardContext(locale);
  return loadFeatures(membership.role, locale);
}

/** True when `key` is on for this person here. A page uses it like `if (!(await isFeatureOn("credit_book", locale))) notFound();`. */
export async function isFeatureOn(key: string, locale: AppLocale): Promise<boolean> {
  return (await getFeatures(locale)).has(key);
}
