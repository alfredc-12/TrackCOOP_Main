import { apiRequest } from "@/lib/api-client";
import type {
  SettingsCatalog,
  SettingEntry,
} from "../../../server/src/modules/system-settings/settings.repository";
export type { SettingsCatalog, SettingEntry };
export type DraftValues = Record<string, unknown>;
export const getSettingsCatalog = (signal?: AbortSignal) =>
  apiRequest<SettingsCatalog>("/api/system-settings/catalog", { signal });
export const saveSettings = (settings: SettingEntry[], draft: DraftValues) =>
  apiRequest<SettingsCatalog>("/api/system-settings/batch", {
    method: "PUT",
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      changes: settings.map((s) => ({
        key: s.key,
        value: draft[s.key],
        expectedRevision: s.revision,
      })),
    }),
  });
export const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const names: Record<string, string> = {
  enabled: "Enabled",
  creditsPerSuccessfulReferral: "Credits per successful referral",
  label: "Reward label",
  activeMin: "Active minimum",
  needsMonitoringMin: "Needs Monitoring minimum",
  recencyDays: "Days since participation",
  frequencyCount: "Participation count",
  contributionAmount: "Share capital PHP",
  min: "At least",
  max: "Up to",
  score: "Score",
};
export function describeValue(v: unknown): string {
  if (v === null || v === undefined) return "Not recorded";
  if (typeof v === "boolean") return v ? "Enabled" : "Disabled";
  if (Array.isArray(v)) return v.map(describeValue).join("; ");
  if (
    typeof v === "object" &&
    !Array.isArray(v) &&
    "creditsPerSuccessfulReferral" in object(v)
  ) {
    const r = object(v);
    return `${r.enabled ? "Enabled" : "Disabled"} | ${r.creditsPerSuccessfulReferral} ${r.label ?? "credits"} per successful referral`;
  }
  if (typeof v === "object")
    return Object.entries(object(v))
      .map(([k, value]) => `${names[k] ?? k}: ${describeValue(value)}`)
      .join(" · ");
  return String(v);
}
export function draftError(s: SettingEntry, v: unknown) {
  if (
    s.kind === "number" &&
    (typeof v !== "number" ||
      !Number.isFinite(v) ||
      (s.unit === "%" ? v < 0 || v > 100 : v <= 0) ||
      (["hours", "months"].includes(s.unit ?? "") && !Number.isInteger(v)))
  )
    return `Enter a valid ${s.unit === "%" ? "percentage from 0 to 100" : `positive ${s.unit === "PHP" ? "amount" : "whole number"}`} for ${s.label.toLowerCase()}.`;
  if (
    s.kind === "text" &&
    (typeof v !== "string" || !v.trim() || v.length > 40)
  )
    return "Enter a terms version of 1–40 characters.";
  if (s.kind === "referral") {
    const r = object(v);
    if (
      typeof r.label !== "string" ||
      !r.label.trim() ||
      r.label.length > 80 ||
      typeof r.creditsPerSuccessfulReferral !== "number" ||
      !Number.isInteger(r.creditsPerSuccessfulReferral) ||
      r.creditsPerSuccessfulReferral < 0 ||
      r.creditsPerSuccessfulReferral > 100
    )
      return "Use a reward label and a whole-number credit amount from 0 to 100.";
  }
  if (s.kind === "labels") {
    const r = object(v),
      a = Number(r.activeMin),
      b = Number(r.needsMonitoringMin);
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 3 ||
      a > 15 ||
      b < 3 ||
      b > 15 ||
      a <= b
    )
      return "Active must have a higher minimum than Needs Monitoring; use whole scores from 3 to 15.";
  }
  if (s.kind === "statuses" && (!Array.isArray(v) || !v.length))
    return "Choose at least one participation status.";
  if (
    s.kind === "thresholds" &&
    Object.values(object(v)).some(
      (rows) =>
        !Array.isArray(rows) ||
        !rows.length ||
        rows.some((r) => {
          const a = object(r),
            boundary = a.max ?? a.min;
          return (
            typeof boundary !== "number" ||
            !Number.isFinite(boundary) ||
            boundary < 0 ||
            typeof a.score !== "number" ||
            !Number.isInteger(a.score) ||
            a.score < 1 ||
            a.score > 5
          );
        }),
    )
  )
    return "Each threshold needs a non-negative boundary and a whole score from 1 to 5.";
  return "";
}
