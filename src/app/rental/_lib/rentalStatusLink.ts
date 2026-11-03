export type RentalStatusLink = {
  /** Upper-case booking reference, empty when the dialog should open blank. */
  reference: string;
  token?: string;
  check: boolean;
};

type ParamReader = { get(name: string): string | null };

const REFERENCE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,39}$/;

/**
 * Reads the parameters that open the booking status dialog: `booking` + `k` (from an email) or `check`.
 * Anything that does not look like a booking reference is ignored, so a mangled link never reaches the API.
 */
export function readRentalStatusLink(params: ParamReader | null): RentalStatusLink | null {
  if (!params) return null;
  const reference = (params.get("booking") ?? "").trim().toUpperCase();
  const validReference = REFERENCE_PATTERN.test(reference) ? reference : "";
  const token = params.get("k")?.trim() || undefined;
  const check = Boolean(params.get("check"));
  if (!validReference && !check) return null;
  return { reference: validReference, token: validReference ? token : undefined, check };
}
