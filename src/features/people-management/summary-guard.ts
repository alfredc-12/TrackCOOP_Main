import { ApiClientError } from "@/lib/api-client";

/**
 * Fails loudly when the API predates the figures a page needs, rather than showing zeros for them.
 * `paths` are dot-separated keys that must hold numbers.
 */
export function requireSummaryFields<T>(summary: T, paths: string[], what: string): T {
  const missing = paths.some((path) => {
    const value = path
      .split(".")
      .reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined), summary);
    return typeof value !== "number" || !Number.isFinite(value);
  });
  if (missing) {
    throw new ApiClientError(`The ${what} figures are not available from this version of the server. Update the API and refresh.`, 0);
  }
  return summary;
}
