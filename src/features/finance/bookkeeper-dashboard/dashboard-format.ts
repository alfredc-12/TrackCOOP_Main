import type { PercentChange } from "./dashboard-api";

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const HUNDRED = BigInt(100);

/** Converts a DECIMAL string (or number) to integer centavos without floating-point peso math. */
export function parseCentavos(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.round(Math.abs(value) * 100 + 1e-9) * (value < 0 ? -1 : 1);
  }
  const match = DECIMAL_PATTERN.exec(String(value).trim());
  if (!match) return 0;
  const [, sign, whole, fraction = ""] = match;
  const padded = `${fraction}000`;
  let cents = BigInt(whole) * HUNDRED + BigInt(padded.slice(0, 2));
  if (padded.charCodeAt(2) >= 53) cents += ONE;
  const result = Number(cents);
  return sign ? -result : result;
}

/** Formats a decimal peso string (or centavo number) into exact Philippine Peso display text. */
export function formatPeso(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const cents = typeof value === "string" ? parseCentavos(value) : Math.round(value * 100);
  return formatCentavosPeso(cents);
}

export function formatCentavosPeso(cents: number): string {
  const negative = cents < 0;
  const absolute = BigInt(Math.abs(Math.trunc(cents)));
  const whole = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(absolute / HUNDRED);
  const fraction = (absolute % HUNDRED).toString().padStart(2, "0");
  return `${negative && absolute !== ZERO ? "-" : ""}₱${whole}.${fraction}`;
}

export function formatPesoSigned(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const cents = typeof value === "string" ? parseCentavos(value) : Math.round(value * 100);
  if (cents === 0) return "₱0.00";
  const prefix = cents > 0 ? "+" : "-";
  const absolute = BigInt(Math.abs(Math.trunc(cents)));
  const whole = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(absolute / HUNDRED);
  const fraction = (absolute % HUNDRED).toString().padStart(2, "0");
  return `${prefix}₱${whole}.${fraction}`;
}

export function formatPesoCompact(cents: number): string {
  const negative = cents < 0;
  const pesos = Math.abs(cents) / 100;
  const sign = negative && pesos > 0 ? "-" : "";
  if (pesos >= 1_000_000) return `${sign}₱${(pesos / 1_000_000).toFixed(1)}M`;
  if (pesos >= 1_000) return `${sign}₱${(pesos / 1_000).toFixed(pesos >= 10_000 ? 0 : 1)}k`;
  return `${sign}₱${pesos.toFixed(0)}`;
}

export function formatPercent(value: string | null | undefined): string {
  if (value === null || value === undefined) return "Not available";
  return `${value}%`;
}

export function formatSignedPercent(value: string | null | undefined): string {
  if (value === null || value === undefined) return "Not available";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not available";
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${value}%`;
}

export type ChangeSummary = {
  available: boolean;
  headline: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
  directionLabel: string;
};

/**
 * Produces human-readable change copy for Net Operating Surplus or category spending, handling
 * zero baselines, negative previous values, and sign changes explicitly.
 */
export function describeSurplusChange(
  change: PercentChange,
  currentNet: string,
  previousNet: string,
  previousLabel: string,
): ChangeSummary {
  const cur = parseCentavos(currentNet);
  const prev = parseCentavos(previousNet);
  const deltaText = formatPesoSigned(change.absolute);

  if (!change.available || change.percent === null) {
    return {
      available: false,
      headline: "Not available",
      detail:
        prev === 0 && cur === 0
          ? `Both periods recorded ₱0.00 net surplus (${previousLabel}).`
          : `${previousLabel} recorded ₱0.00 net surplus; percentage change is not meaningful (${deltaText} change).`,
      tone: cur > 0 ? "positive" : cur < 0 ? "negative" : "neutral",
      directionLabel: cur > prev ? "Increased from ₱0.00" : cur < prev ? "Decreased from ₱0.00" : "No change",
    };
  }

  if (change.direction === "flat") {
    return {
      available: true,
      headline: "0.00%",
      detail: `Unchanged vs ${previousLabel.toLowerCase()} (${formatPeso(previousNet)}).`,
      tone: "neutral",
      directionLabel: "Unchanged",
    };
  }

  const improved = cur > prev;
  const crossedFromDeficitToSurplus = prev < 0 && cur >= 0;
  const crossedFromSurplusToDeficit = prev >= 0 && cur < 0;

  let directionLabel = improved ? "Improved" : "Declined";
  if (crossedFromDeficitToSurplus) directionLabel = "Returned to surplus";
  else if (crossedFromSurplusToDeficit) directionLabel = "Moved into deficit";
  else if (prev < 0 && cur < 0) directionLabel = improved ? "Smaller deficit" : "Deeper deficit";

  return {
    available: true,
    headline: formatSignedPercent(change.percent),
    detail: `${deltaText} vs ${previousLabel.toLowerCase()} (${formatPeso(previousNet)}).`,
    tone: improved ? "positive" : "negative",
    directionLabel,
  };
}

export function formatManilaDate(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || "—";
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatManilaDateRange(start: string, end: string): string {
  if (!start || !end) return "—";
  if (start === end) return formatManilaDate(start);
  return `${formatManilaDate(start)} – ${formatManilaDate(end)}`;
}

export function formatManilaMonth(ym: string): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || "—";
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
  });
}

export function formatManilaTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
