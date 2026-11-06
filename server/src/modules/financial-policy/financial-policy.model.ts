import { z } from "zod";
import { financialSourceModules } from "../finance/finance.schema";

// Strings avoid IEEE-754 rounding and match DECIMAL(14,2)'s positive range.
export const thresholdAmount = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
  .refine((value) => /[1-9]/.test(value), "Amount must be positive");
export const thresholdConfig = z.object({ amountPhp: thresholdAmount }).strict();
export const restrictionConfig = z.object({
  categoryIds: z.array(z.string().regex(/^[1-9]\d{0,4}$/)).max(500),
  sources: z.array(z.enum(financialSourceModules)).max(financialSourceModules.length),
}).strict().refine((v) => new Set(v.categoryIds).size === v.categoryIds.length && new Set(v.sources).size === v.sources.length, "Duplicate restrictions");
export const policyKind = z.enum(["threshold", "restrictions"]);
export type PolicyKind = z.infer<typeof policyKind>;
export type PolicyConfig = z.infer<typeof thresholdConfig> | z.infer<typeof restrictionConfig>;
export type PolicyRevision = {
  kind: PolicyKind; version: number; state: "DRAFT" | "APPROVED";
  config: PolicyConfig; createdBy: string; createdAt: string;
  approvedBy: string | null; approvedAt: string | null; effectiveAt: string | null;
};

export function validateConfig(kind: PolicyKind, config: unknown): PolicyConfig {
  return (kind === "threshold" ? thresholdConfig : restrictionConfig).parse(config);
}

export type PolicyAssessment = {
  lifecycle: "Inactive";
  threshold: "ABSENT" | "DRAFT" | "APPROVED_VALID_AMOUNT" | "NOT_YET_EFFECTIVE" | "INVALID";
  restrictions: "ABSENT" | "DRAFT" | "APPROVED_EMPTY" | "APPROVED_WITH_ENTRIES" | "NOT_YET_EFFECTIVE" | "INVALID";
  futureActivationEligible: false;
  configurationComplete: boolean;
  hypotheticalActiveResult: "POLICY_CONFIGURATION_REQUIRED" | "CONFIGURATION_COMPLETE";
};

// This is a configuration assessment only. It cannot activate or authorize a financial write.
export function assessConfiguration(threshold: PolicyRevision | null, restrictions: PolicyRevision | null, now: Date, expected?: { threshold: number; restrictions: number }): PolicyAssessment {
  function state(revision: PolicyRevision | null, kind: PolicyKind) {
    if (!revision) return "ABSENT";
    if (revision.kind !== kind || !Number.isSafeInteger(revision.version) || revision.version < 1 || (expected && revision.version !== expected[kind])) return "INVALID";
    const parsed = (kind === "threshold" ? thresholdConfig : restrictionConfig).safeParse(revision.config);
    if (!parsed.success) return "INVALID";
    if (revision.state === "DRAFT") return "DRAFT";
    if (revision.state !== "APPROVED" || !revision.approvedBy || !revision.approvedAt || !revision.effectiveAt || Number.isNaN(Date.parse(revision.approvedAt)) || Number.isNaN(Date.parse(revision.effectiveAt))) return "INVALID";
    if (Number.isNaN(now.getTime())) return "INVALID";
    if (Date.parse(revision.effectiveAt) > now.getTime()) return "NOT_YET_EFFECTIVE";
    if (kind === "threshold") return "APPROVED_VALID_AMOUNT";
    const config = parsed.data as z.infer<typeof restrictionConfig>;
    return config.categoryIds.length || config.sources.length ? "APPROVED_WITH_ENTRIES" : "APPROVED_EMPTY";
  }
  const t = state(threshold, "threshold") as PolicyAssessment["threshold"];
  const r = state(restrictions, "restrictions") as PolicyAssessment["restrictions"];
  const complete = t === "APPROVED_VALID_AMOUNT" && (r === "APPROVED_EMPTY" || r === "APPROVED_WITH_ENTRIES");
  return { lifecycle: "Inactive", threshold: t, restrictions: r, futureActivationEligible: false, configurationComplete: complete, hypotheticalActiveResult: complete ? "CONFIGURATION_COMPLETE" : "POLICY_CONFIGURATION_REQUIRED" };
}
