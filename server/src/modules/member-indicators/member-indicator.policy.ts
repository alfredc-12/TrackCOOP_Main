import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../utils/app-error";
import type {
  RfmFilters,
  RfmSettings,
  RfmRecalculationInput,
} from "./member-indicator.workspace-types";

export const rfmFormulaVersion = "TRACKCOOP_RFM_V1";
export const fallbackRfmConfiguration = {
  thresholds: {
    recencyDays: [
      { max: 30, score: 5 },
      { max: 90, score: 4 },
      { max: 180, score: 3 },
      { max: 365, score: 2 },
    ],
    frequencyCount: [
      { min: 12, score: 5 },
      { min: 6, score: 4 },
      { min: 3, score: 3 },
      { min: 1, score: 2 },
    ],
    contributionAmount: [
      { min: 15000, score: 5 },
      { min: 3000, score: 4 },
      { min: 1500, score: 3 },
      { min: 0.01, score: 2 },
    ],
  },
  labels: { activeMin: 12, needsMonitoringMin: 7 },
  qualifyingParticipationStatuses: ["Participated"],
};
const score = z.number().int().min(1).max(5);
const thresholdsSchema = z.object({
  recencyDays: z
    .array(z.object({ max: z.number().nonnegative().finite(), score }))
    .min(1),
  frequencyCount: z
    .array(z.object({ min: z.number().nonnegative().finite(), score }))
    .min(1),
  contributionAmount: z
    .array(z.object({ min: z.number().nonnegative().finite(), score }))
    .min(1),
});
export function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function configurationFromSettings(
  settings: Map<string, string | null>,
): RfmSettings {
  function read(key: string, fallback: unknown) {
    const raw = settings.get(key);
    if (raw === undefined || raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      throw new AppError(
        `Invalid RFM setting: ${key}. Review system settings before recalculating.`,
        422,
        "INVALID_RFM_CONFIGURATION",
      );
    }
  }
  const thresholdOverrides = thresholdsSchema
    .partial()
    .safeParse(read("member_indicators.fallback_thresholds", {}));
  const labelSchema = z.object({
    activeMin: z.number().int().min(3).max(15),
    needsMonitoringMin: z.number().int().min(3).max(15),
  });
  const labelOverrides = labelSchema
    .partial()
    .safeParse(read("member_indicators.label_thresholds", {}));
  if (!thresholdOverrides.success || !labelOverrides.success)
    throw new AppError(
      "RFM configuration is invalid. No scores were saved.",
      422,
      "INVALID_RFM_CONFIGURATION",
    );
  const thresholds = thresholdsSchema.safeParse({
    ...fallbackRfmConfiguration.thresholds,
    ...thresholdOverrides.data,
  });
  const labels = labelSchema
    .refine((v) => v.activeMin > v.needsMonitoringMin)
    .safeParse({ ...fallbackRfmConfiguration.labels, ...labelOverrides.data });
  const statuses = z
    .array(z.string().trim().min(1).max(80))
    .min(1)
    .safeParse(
      read(
        "member_indicators.qualifying_participation_statuses",
        fallbackRfmConfiguration.qualifyingParticipationStatuses,
      ),
    );
  if (!thresholds.success || !labels.success || !statuses.success)
    throw new AppError(
      "RFM configuration is invalid. No scores were saved.",
      422,
      "INVALID_RFM_CONFIGURATION",
    );
  // Preserve configured order: the existing engine uses first matching threshold.
  const result = {
    formulaVersion: rfmFormulaVersion,
    thresholds: thresholds.data,
    labels: labels.data,
    qualifyingParticipationStatuses: [...new Set(statuses.data)].sort(),
  };
  // Same canonical fields used by the parallel Member Analytics configuration reference.
  const configurationFingerprint = fingerprint({
    formulaVersion: result.formulaVersion,
    recency: result.thresholds.recencyDays,
    frequency: result.thresholds.frequencyCount,
    contribution: result.thresholds.contributionAmount,
    activeMin: result.labels.activeMin,
    needsMonitoringMin: result.labels.needsMonitoringMin,
    qualifyingParticipationStatuses: result.qualifyingParticipationStatuses,
    inactivitySafeguard: "zero-frequency-and-no-participation-within-365-days",
  });
  return { ...result, configurationFingerprint };
}
export function manilaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function normalizeRfmBasis(
  input: Partial<RfmRecalculationInput>,
  today = manilaToday(),
) {
  const end = input.basisPeriodEnd ?? today;
  if (!z.iso.date().safeParse(end).success || end > today)
    throw new AppError(
      "Choose a valid calculation date that is not in the future.",
      400,
      "INVALID_BASIS",
    );
  const date = new Date(`${end}T00:00:00Z`);
  const year = date.getUTCFullYear() - 1,
    month = date.getUTCMonth();
  const day = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  );
  const start = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  if (input.basisPeriodStart && input.basisPeriodStart !== start)
    throw new AppError(
      "The basis start must match the rolling 12-month start derived from the end date.",
      400,
      "INVALID_BASIS",
    );
  return { start, end };
}
const optionalText = z.string().trim().min(1).max(190).optional();
const optionalNumber = (max: number) =>
  z.coerce.number().finite().min(0).max(max).optional();
const optionalScore = z.coerce.number().int().min(1).max(5).optional();
export const rfmFiltersSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: optionalText,
    classification: z
      .enum(["Active", "Needs Monitoring", "Inactive", "Not Yet Scored"])
      .optional(),
    context: z.enum(["current", "historical", "run"]).default("current"),
    basisEnd: z.iso.date().optional(),
    runId: z.string().min(1).max(160).optional(),
    membershipType: z.enum(["Associate", "True Member"]).optional(),
    officialStatus: z.enum(["Active", "Inactive"]).optional(),
    barangay: optionalText,
    sector: optionalText,
    version: optionalText,
    quality: z
      .enum([
        "Current",
        "Potentially Outdated",
        "Historical",
        "Missing",
        "Incompatible Version",
        "Requires Review",
      ])
      .optional(),
    minScore: z.coerce.number().int().min(3).max(15).optional(),
    maxScore: z.coerce.number().int().min(3).max(15).optional(),
    recencyScore: optionalScore,
    frequencyScore: optionalScore,
    contributionScore: optionalScore,
    minRecency: optionalNumber(1000000),
    maxRecency: optionalNumber(1000000),
    minFrequency: optionalNumber(1000000),
    maxFrequency: optionalNumber(1000000),
    minContribution: optionalNumber(1e12),
    maxContribution: optionalNumber(1e12),
    sortBy: z
      .enum([
        "fullName",
        "totalScore",
        "recencyScore",
        "frequencyScore",
        "contributionScore",
        "computedAt",
        "recencyDays",
        "frequencyCount",
        "validatedShareCapital",
      ])
      .default("computedAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .superRefine((q, ctx) => {
    if (q.context === "historical" && !q.basisEnd)
      ctx.addIssue({
        code: "custom",
        path: ["basisEnd"],
        message: "A historical basis date is required",
      });
    if (q.context === "run" && !q.runId)
      ctx.addIssue({
        code: "custom",
        path: ["runId"],
        message: "Select a saved calculation run",
      });
    for (const [a, b] of [
      ["minScore", "maxScore"],
      ["minRecency", "maxRecency"],
      ["minFrequency", "maxFrequency"],
      ["minContribution", "maxContribution"],
    ] as const)
      if (q[a] !== undefined && q[b] !== undefined && q[a]! > q[b]!)
        ctx.addIssue({
          code: "custom",
          path: [b],
          message: "Maximum must be at least the minimum",
        });
  });
export const rfmRecalculationSchema = z.object({
  memberId: z.string().regex(/^\d+$/).max(30).optional(),
  basisPeriodEnd: z.iso.date(),
  basisPeriodStart: z.iso.date().nullable().optional(),
});
export const rfmCommitSchema = rfmRecalculationSchema.extend({
  confirmed: z.literal(true),
  previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export const defaultRfmFilters = (): RfmFilters => rfmFiltersSchema.parse({});
