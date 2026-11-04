import { createHash } from "node:crypto";
import { z } from "zod";
import { safeText } from "../audit-logs/activity.safety";
import { AppError } from "../../utils/app-error";
import {
  fallbackRfmConfiguration,
  configurationFromSettings,
} from "../member-indicators/member-indicator.policy";
import {
  INITIAL_SHARE_CAPITAL,
  FULL_SHARE_CAPITAL,
  MAX_SHARE_CAPITAL,
} from "../share-capital/share-capital.constants";
export type SettingValue =
  | string
  | number
  | boolean
  | null
  | SettingValue[]
  | { [key: string]: SettingValue };
export type SettingDefinition = {
  key: string;
  category: string;
  label: string;
  help: string;
  kind:
    | "number"
    | "text"
    | "boolean"
    | "referral"
    | "thresholds"
    | "labels"
    | "statuses";
  group: string;
  fallback: SettingValue;
  editable: boolean;
  schema: z.ZodType;
  unit?: string;
  enforced?: SettingValue;
};
const positive = z
  .number()
  .finite()
  .positive()
  .max(9999999999.99)
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.0001,
    "Use at most two decimal places.",
  );
const whole = z.number().int().positive().max(87600);
const score = z.number().int().min(1).max(5);
const thresholds = z
  .object({
    recencyDays: z
      .array(
        z.object({ max: z.number().finite().nonnegative(), score }).strict(),
      )
      .min(1)
      .max(64),
    frequencyCount: z
      .array(
        z.object({ min: z.number().finite().nonnegative(), score }).strict(),
      )
      .min(1)
      .max(64),
    contributionAmount: z
      .array(
        z.object({ min: z.number().finite().nonnegative(), score }).strict(),
      )
      .min(1)
      .max(64),
  })
  .partial()
  .strict();
export const categories = [
  {
    id: "membership",
    label: "Membership Rules",
    help: "Application, checklist and account activation rules.",
  },
  {
    id: "referrals",
    label: "Referral Rewards",
    help: "Tracking credits for successful referrals.",
  },
  {
    id: "indicators",
    label: "Member Indicators",
    help: "Activity and contribution scoring rules.",
  },
  {
    id: "inventory",
    label: "Inventory Controls",
    help: "Stock safeguards enforced by the system.",
  },
];
export const definitions: SettingDefinition[] = [
  {
    key: "membership.associate_fee",
    category: "membership",
    group: "membership",
    label: "Associate membership fee",
    help: "Fee used by new Associate membership applications. Existing payment records are not rewritten.",
    kind: "number",
    unit: "PHP",
    fallback: 200,
    editable: true,
    schema: positive,
  },
  {
    key: "membership.initial_share_capital",
    category: "membership",
    group: "membership",
    label: "Initial capital payment",
    help: "Some workflows also enforce a fixed capital policy. This value is view-only until those policies are aligned.",
    kind: "number",
    unit: "PHP",
    fallback: 1500,
    enforced: INITIAL_SHARE_CAPITAL,
    editable: false,
    schema: positive,
  },
  {
    key: "membership.true_member_required_capital",
    category: "membership",
    group: "membership",
    label: "Full True Member capital requirement",
    help: "The application setting and fixed capital-ledger policy are shown together; neither is changed here.",
    kind: "number",
    unit: "PHP",
    fallback: 3000,
    enforced: FULL_SHARE_CAPITAL,
    editable: false,
    schema: positive,
  },
  {
    key: "membership.maximum_share_capital",
    category: "membership",
    group: "membership",
    label: "Maximum share capital",
    help: "Capital contributions also have a fixed backend limit. Changing only this setting would be inconsistent.",
    kind: "number",
    unit: "PHP",
    fallback: 15000,
    enforced: MAX_SHARE_CAPITAL,
    editable: false,
    schema: positive,
  },
  {
    key: "membership.share_capital_deadline_months",
    category: "membership",
    group: "membership",
    label: "Capital completion period",
    help: "Months used when assigning a capital completion deadline. Existing deadlines remain recorded as before.",
    kind: "number",
    unit: "months",
    fallback: 1,
    editable: true,
    schema: whole,
  },
  {
    key: "membership.orientation_required",
    category: "membership",
    group: "membership",
    label: "Include orientation in the checklist",
    help: "Adds an Orientation/Seminar checklist item to new applications. Pending orientation does not block payment or account approval.",
    kind: "boolean",
    fallback: true,
    editable: true,
    schema: z.boolean(),
  },
  {
    key: "membership.activation_token_hours",
    category: "membership",
    group: "membership",
    label: "Account activation link validity",
    help: "Hours allowed for newly issued activation links. Previously issued links keep their recorded expiry.",
    kind: "number",
    unit: "hours",
    fallback: 72,
    editable: true,
    schema: whole,
  },
  {
    key: "membership.terms_version",
    category: "membership",
    group: "membership",
    label: "Application terms version",
    help: "Version recorded for new applications that do not already supply a terms version. This does not edit the terms text.",
    kind: "text",
    fallback: "2026-07-24",
    editable: true,
    schema: z.string().trim().min(1).max(40),
  },
  {
    key: "referrals.reward_policy",
    category: "referrals",
    group: "Referrals",
    label: "Referral reward policy",
    help: "These are tracking credits, not automatic cash payouts or redemption obligations.",
    kind: "referral",
    fallback: {
      enabled: true,
      creditsPerSuccessfulReferral: 1,
      label: "Referral credits",
    },
    editable: true,
    schema: z
      .object({
        enabled: z.boolean(),
        creditsPerSuccessfulReferral: z.number().int().min(0).max(100),
        label: z.string().trim().min(1).max(80),
      })
      .strict(),
  },
  {
    key: "member_indicators.fallback_thresholds",
    category: "indicators",
    group: "member_indicators",
    label: "Activity and contribution thresholds",
    help: "Rows are evaluated in the configured order, using the first matching threshold. Changes apply on the next explicit recalculation.",
    kind: "thresholds",
    fallback: fallbackRfmConfiguration.thresholds,
    editable: true,
    schema: thresholds,
  },
  {
    key: "member_indicators.label_thresholds",
    category: "indicators",
    group: "member_indicators",
    label: "Classification score thresholds",
    help: "Active and Needs Monitoring use these minimum total scores. Members with zero qualifying participations in the scoring period and no qualifying activity within 365 days remain Inactive. These labels do not change official membership status.",
    kind: "labels",
    fallback: fallbackRfmConfiguration.labels,
    editable: true,
    schema: z
      .object({
        activeMin: z.number().int().min(3).max(15),
        needsMonitoringMin: z.number().int().min(3).max(15),
      })
      .partial()
      .strict(),
  },
  {
    key: "member_indicators.qualifying_participation_statuses",
    category: "indicators",
    group: "member_indicators",
    label: "Participation statuses that count",
    help: "Only participation records with one of these exact recorded status names count toward recency and frequency.",
    kind: "statuses",
    fallback: ["Participated"],
    editable: true,
    schema: z.array(z.string().trim().min(1).max(80)).min(1).max(32),
  },
  {
    key: "inventory.allow_negative_stock",
    category: "inventory",
    group: "inventory",
    label: "Negative stock restriction",
    help: "The inventory and sales workflows reject deductions above available stock directly in code. This historical setting is not connected to that safeguard.",
    kind: "boolean",
    fallback: false,
    enforced: false,
    editable: false,
    schema: z.boolean(),
  },
];
export const byKey = new Map(definitions.map((d) => [d.key, d]));
export function revision(key: string, raw: string | null, exists: boolean) {
  return createHash("sha256")
    .update(JSON.stringify([key, exists, raw]))
    .digest("hex");
}
export function parseStored(
  d: SettingDefinition,
  raw: string | null,
  mergeDefaults = true,
): SettingValue {
  if (raw === null) return d.fallback;
  const value =
    d.kind === "text"
      ? raw
      : d.kind === "number"
        ? Number(raw)
        : JSON.parse(raw);
  const result = d.schema.safeParse(value);
  if (!result.success) throw new Error("Invalid saved setting");
  let parsed = result.data as SettingValue;
  if (mergeDefaults && d.kind === "thresholds")
    parsed = {
      ...fallbackRfmConfiguration.thresholds,
      ...(parsed as object),
    } as SettingValue;
  if (mergeDefaults && d.kind === "labels")
    parsed = {
      ...fallbackRfmConfiguration.labels,
      ...(parsed as object),
    } as SettingValue;
  return parsed;
}
export function validateValue(
  d: SettingDefinition,
  value: unknown,
): SettingValue {
  if (!d.editable)
    throw new AppError(
      "This policy is view-only. It cannot be changed through Settings.",
      422,
      "SETTING_READ_ONLY",
    );
  const result = d.schema.safeParse(value);
  if (!result.success)
    throw new AppError(
      `Review ${d.label.toLowerCase()}.`,
      422,
      "INVALID_SETTING_VALUE",
      result.error.issues.map((i) => ({
        field: [d.key, ...i.path].join("."),
        message: i.message,
      })),
    );
  const checked = result.data as SettingValue;
  if (
    JSON.stringify(checked) !== safeText(JSON.stringify(checked), 10000) ||
    JSON.stringify(checked).match(
      /https?:\/\/|\b(?:sk_(?:test|live)_|whsec_|whsk_|re_|gh[opsu]_)[A-Za-z0-9_-]{12,}|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i,
    )
  )
    throw new AppError(
      "Do not put links, tokens or secret keys into setting labels.",
      422,
      "INVALID_SETTING_VALUE",
    );
  return checked;
}
export function validateRfmState(values: Map<string, string | null>) {
  configurationFromSettings(values);
}
export const encodeValue = (d: SettingDefinition, value: SettingValue) =>
  d.kind === "text" ? String(value) : JSON.stringify(value);
