import { z } from "zod";

/**
 * Shared building blocks for the Chairman People Management list and summary queries.
 * Lists and summaries build their predicates from the same helpers so counts always reconcile.
 */

/** Asia/Manila has no daylight saving, so a fixed +08:00 offset is exact. */
const MANILA_OFFSET = "+08:00";
const DAY_MS = 86_400_000;

/** Reserved filter value that matches records with no barangay recorded. */
export const BARANGAY_UNSPECIFIED = "Unspecified";

export const isoDateSchema = z.iso.date();

/** `a,b,c` or `a|b|c` query value into a validated, de-duplicated list. */
export function csvEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .preprocess(
      (value) => (typeof value === "string" ? value.split(/[|,]/).map((item) => item.trim()).filter(Boolean) : value),
      z.array(z.enum(values)).max(values.length),
    )
    .transform((items) => Array.from(new Set(items)));
}

function utcDateTime(milliseconds: number) {
  return new Date(milliseconds).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * UTC bounds of an inclusive Asia/Manila calendar-date range, for `column >= start AND column < end`.
 * DATETIME columns are stored in UTC, so comparing instants keeps the column index usable.
 */
export function manilaRangeBounds(from?: string | null, to?: string | null) {
  const start = from ? Date.parse(`${from}T00:00:00${MANILA_OFFSET}`) : null;
  const end = to ? Date.parse(`${to}T00:00:00${MANILA_OFFSET}`) + DAY_MS : null;
  return {
    startUtc: start === null || Number.isNaN(start) ? null : utcDateTime(start),
    endExclusiveUtc: end === null || Number.isNaN(end) ? null : utcDateTime(end),
  };
}

export type SqlFilter = { sql: string; values: Array<string | number> };

/** Inclusive Manila date range as SQL conditions on a DATETIME column; empty when no bound is given. */
export function manilaDateRangeFilter(column: string, from?: string | null, to?: string | null): SqlFilter[] {
  const { startUtc, endExclusiveUtc } = manilaRangeBounds(from, to);
  const filters: SqlFilter[] = [];
  if (startUtc) filters.push({ sql: `${column} >= ?`, values: [startUtc] });
  if (endExclusiveUtc) filters.push({ sql: `${column} < ?`, values: [endExclusiveUtc] });
  return filters;
}

/** Barangays are free text, so compare trimmed and case-insensitively; `Unspecified` finds blank values. */
export function barangayFilter(column: string, barangay: string): SqlFilter {
  if (barangay.trim().toLowerCase() === BARANGAY_UNSPECIFIED.toLowerCase()) {
    return { sql: `(${column} IS NULL OR TRIM(${column}) = '')`, values: [] };
  }
  return { sql: `LOWER(TRIM(${column})) = ?`, values: [barangay.trim().toLowerCase()] };
}

/** `column IN (?, ?)` for a non-empty list. */
export function inFilter(column: string, items: readonly string[]): SqlFilter {
  return { sql: `${column} IN (${items.map(() => "?").join(", ")})`, values: [...items] };
}

/** Escapes LIKE wildcards so a search for `50%` or `a_b` matches literally. */
export function likeTerm(value: string) {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export function joinFilters(filters: SqlFilter[]) {
  return {
    whereSql: filters.length ? ` WHERE ${filters.map((filter) => filter.sql).join(" AND ")}` : "",
    values: filters.flatMap((filter) => filter.values),
  };
}

/** Rejects ranges whose end precedes their start. */
export function refineDateRange<T extends Record<string, unknown>>(from: keyof T & string, to: keyof T & string) {
  return (value: T, context: z.RefinementCtx) => {
    const start = value[from];
    const end = value[to];
    if (typeof start === "string" && typeof end === "string" && end < start) {
      context.addIssue({ code: "custom", path: [to], message: "The end date must be on or after the start date" });
    }
  };
}
