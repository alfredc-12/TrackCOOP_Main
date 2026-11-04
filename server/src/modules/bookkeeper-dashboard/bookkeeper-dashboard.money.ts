/**
 * Centavo-safe money helpers for the Bookkeeper Financial Dashboard.
 * Database DECIMAL(…, 2) values arrive as strings. They are converted to integer centavos,
 * combined as integers, and formatted back to fixed two-decimal strings. No floating-point
 * peso arithmetic is used.
 */
export type Centavos = number;

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const HUNDRED = BigInt(100);
const TEN_THOUSAND = BigInt(10000);

/** Converts a DECIMAL string (or number) to integer centavos, rounding half away from zero at the 3rd decimal. */
export function toCentavos(value: unknown): Centavos {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.round(Math.abs(value) * 100 + 1e-9) * (value < 0 ? -1 : 1);
  }
  const text = String(value).trim();
  const match = DECIMAL_PATTERN.exec(text);
  if (!match) return 0;
  const [, sign, whole, fraction = ""] = match;
  const padded = `${fraction}000`;
  let cents = BigInt(whole) * HUNDRED + BigInt(padded.slice(0, 2));
  if (padded.charCodeAt(2) >= 53) cents += ONE; // third digit >= 5 rounds up
  const result = Number(cents);
  return sign ? -result : result;
}

/** Formats integer centavos as a fixed two-decimal string such as "-1250.05". */
export function formatCentavos(value: Centavos): string {
  const negative = value < 0;
  const absolute = BigInt(Math.abs(Math.trunc(value)));
  const whole = absolute / HUNDRED;
  const fraction = (absolute % HUNDRED).toString().padStart(2, "0");
  return `${negative && absolute !== ZERO ? "-" : ""}${whole}.${fraction}`;
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const twice = (remainder < ZERO ? -remainder : remainder) * TWO;
  if (twice < denominator) return quotient;
  return quotient + (numerator < ZERO ? -ONE : ONE);
}

function formatBasisPoints(basisPoints: bigint): string {
  const negative = basisPoints < ZERO;
  const absolute = negative ? -basisPoints : basisPoints;
  const whole = absolute / HUNDRED;
  const fraction = (absolute % HUNDRED).toString().padStart(2, "0");
  return `${negative && absolute !== ZERO ? "-" : ""}${whole}.${fraction}`;
}

/** Share Of Total (%) = part / total × 100, to two decimals. Unavailable when the total is not positive. */
export function sharePercent(part: Centavos, total: Centavos): string | null {
  if (total <= 0) return null;
  return formatBasisPoints(roundDivide(BigInt(part) * TEN_THOUSAND, BigInt(total)));
}

export type PercentChange = {
  available: boolean;
  /** Signed percentage with two decimals, or null when no meaningful percentage exists. */
  percent: string | null;
  direction: "up" | "down" | "flat" | null;
  /** Current minus previous, as a decimal peso string. Always available. */
  absolute: string;
  reason: "no-previous-value" | null;
};

/**
 * Percentage Change = ((current − previous) / |previous|) × 100.
 * A zero previous value gives an explicit "unavailable" result instead of a misleading percentage.
 */
export function percentChange(current: Centavos, previous: Centavos): PercentChange {
  const difference = current - previous;
  const absolute = formatCentavos(difference);
  if (previous === 0) {
    return { available: false, percent: null, direction: difference === 0 ? "flat" : null, absolute, reason: "no-previous-value" };
  }
  const basisPoints = roundDivide(BigInt(difference) * TEN_THOUSAND, BigInt(Math.abs(previous)));
  return {
    available: true,
    percent: formatBasisPoints(basisPoints),
    direction: difference === 0 ? "flat" : difference > 0 ? "up" : "down",
    absolute,
    reason: null,
  };
}
