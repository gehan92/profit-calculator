import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Makes every dashboard page load fresh data on the next visit. Server Actions
 * call it after they change entries or shop settings, so Home, Entries,
 * Summary and the header never show old numbers or an old shop name.
 */
export function refreshDashboard(): void {
  revalidatePath("/[locale]/dashboard", "layout");
}
