/** Presentation signals only. These do not score members or change official status. */
export type AnalyticsTone = "good" | "warning" | "danger" | "neutral";
export type AnalyticsSignal = { tone: AnalyticsTone; label: string };

export const signalColors: Record<AnalyticsTone, string> = {
  good: "var(--coop-success, #1f6b43)",
  warning: "#b77c13",
  danger: "var(--coop-danger, #9a392a)",
  neutral: "var(--coop-muted, #5d6d63)",
};

export function growthSignal(value: number | null): AnalyticsSignal {
  if (value === null) return { tone: "neutral", label: "No baseline" };
  return value > 0 ? { tone: "good", label: "Increase" } : value < 0 ? { tone: "danger", label: "Decrease" } : { tone: "neutral", label: "No change" };
}

export function completionSignal(value: number | null, completeLabel = "Complete"): AnalyticsSignal {
  if (value === null) return { tone: "neutral", label: "No data" };
  return value >= 100 ? { tone: "good", label: completeLabel } : { tone: "warning", label: value === 0 ? "None recorded" : "Partial" };
}

export function attentionSignal(count: number | null, overdue: number, inactive: number): AnalyticsSignal {
  if (count === null) return { tone: "neutral", label: "Unavailable" };
  if (!count) return { tone: "good", label: "Clear" };
  if (overdue > 0) return { tone: "danger", label: "Overdue" };
  if (inactive > 0) return { tone: "danger", label: "Inactive RFM" };
  return { tone: "warning", label: "Monitoring" };
}

const goodLabels = new Set(["Active", "Completed", "Qualified", "Required to maximum", "At maximum"]);
const warningLabels = new Set(["Needs Monitoring", "Pending", "Zero balance", "Below required", "Due within 30 days", "Missing qualification evidence"]);
const dangerLabels = new Set(["Inactive", "Overdue", "Above maximum", "Rejected / cancelled"]);
const neutralLabels = new Set(["Not Yet Scored", "Unknown ledger", "Unknown balance", "Unknown deadline"]);
export function statusTone(label: string): AnalyticsTone | undefined {
  if (goodLabels.has(label)) return "good";
  if (warningLabels.has(label)) return "warning";
  if (dangerLabels.has(label)) return "danger";
  if (neutralLabels.has(label)) return "neutral";
  return undefined;
}
