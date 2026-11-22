/** Rows on one admin list page. */
export const ADMIN_PAGE_SIZE = 25;

const MAX_PAGE = 10_000;

type Param = string | string[] | undefined;

/** The page number from `?page=3`: a whole number from 1, otherwise 1. */
export function parsePage(param: Param): number {
  const text = Array.isArray(param) ? param[0] : param;
  const page = Number(text);
  return Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1;
}

/** The row range for a page, as Supabase's `.range(from, to)` wants it (both ends included). */
export function pageRange(page: number, pageSize: number = ADMIN_PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** How many pages `total` rows fill (at least 1, so an empty list still has "page 1 of 1"). */
export function pageCount(total: number, pageSize: number = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
