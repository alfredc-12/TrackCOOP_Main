import crypto from "node:crypto";
import { hash } from "bcryptjs";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  ApprovalInput,
  MembershipSettings,
  RequestedMembershipType,
  RequirementStatus,
  RequirementType,
} from "./membership-application.types";

export type SettingRow = RowDataPacket & {
  settingKey: string;
  settingValue: string | null;
};
export type CountRow = RowDataPacket & { total: string | number | null };
export type RequirementRow = RowDataPacket & {
  id: string;
  requirementType: RequirementType;
  requirementStatus: RequirementStatus;
  paymentReferenceId: string | null;
};
export type ApplicationRow = RowDataPacket & {
  id: string;
  applicationCode: string;
  requestedMembershipType: RequestedMembershipType;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  fullName: string;
  email: string | null;
  contactNumber: string;
  currentAddress: string;
  barangay: string | null;
  municipality: string;
  province: string;
  orientationCommitmentAccepted: number;
  membershipFeeCommitmentAccepted: number;
  shareSubscriptionCommitmentAccepted: number;
  bylawsAgreementAccepted: number;
  privacyConsentAccepted: number;
  applicantSignatureName: string;
  signedAt: Date;
  signedPlace: string;
  applicationStatus: string;
  convertedMemberId: string | null;
  submittedAt: Date;
};
export type PreparedActivation = {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
  unusablePasswordHash: string;
} | null;

const settingKeys = [
  "membership.associate_fee",
  "membership.initial_share_capital",
  "membership.true_member_required_capital",
  "membership.maximum_share_capital",
  "membership.share_capital_deadline_months",
  "membership.orientation_required",
  "membership.activation_token_hours",
  "membership.terms_version",
];
const defaults: MembershipSettings = {
  associateFee: 200,
  initialShareCapital: 1500,
  trueMemberRequiredCapital: 3000,
  maximumShareCapital: 15000,
  shareCapitalDeadlineMonths: 12,
  orientationRequired: true,
  activationTokenHours: 72,
  termsVersion: "2026-07-24",
};

export function approvalMoney(value: number) {
  return Math.round(value * 100) / 100;
}
export function mysqlDateTime(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}
export function mysqlDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10);
}
export function dateMonthsFromNow(months: number) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + months);
  return mysqlDate(date);
}
export function nullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}
export function normalizeApprovalEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}
export function approvalActivationUrl(rawToken: string) {
  const base = env.FRONTEND_URL.replace(/\/$/, "");
  return `${base}/activate?token=${encodeURIComponent(rawToken)}`;
}
export function generatedMemberCode(insertId: number) {
  return `NFFAC-${new Date().getUTCFullYear()}-${String(insertId).padStart(6, "0")}`;
}
export function assertChairman(auth: AuthContext) {
  if (auth.user.role !== "chairman") {
    throw new AppError("Chairman access is required", 403, "ROLE_FORBIDDEN");
  }
}

function normalizeSettings(rows: SettingRow[]): MembershipSettings {
  const values = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
  const numberSetting = (key: string, fallback: number) => {
    const value = Number(values.get(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    associateFee: numberSetting("membership.associate_fee", defaults.associateFee),
    initialShareCapital: numberSetting(
      "membership.initial_share_capital",
      defaults.initialShareCapital,
    ),
    trueMemberRequiredCapital: numberSetting(
      "membership.true_member_required_capital",
      defaults.trueMemberRequiredCapital,
    ),
    maximumShareCapital: numberSetting(
      "membership.maximum_share_capital",
      defaults.maximumShareCapital,
    ),
    shareCapitalDeadlineMonths: numberSetting(
      "membership.share_capital_deadline_months",
      defaults.shareCapitalDeadlineMonths,
    ),
    orientationRequired:
      values.get("membership.orientation_required")?.toLowerCase() === "false"
        ? false
        : defaults.orientationRequired,
    activationTokenHours: numberSetting(
      "membership.activation_token_hours",
      defaults.activationTokenHours,
    ),
    termsVersion: values.get("membership.terms_version") ?? defaults.termsVersion,
  };
}

export async function loadApprovalSettings(connection: Pool | PoolConnection) {
  const [rows] = await connection.execute<SettingRow[]>(
    `SELECT setting_key AS settingKey, setting_value AS settingValue
       FROM system_settings
      WHERE setting_key IN (${settingKeys.map(() => "?").join(", ")})`,
    settingKeys,
  );
  return normalizeSettings(rows);
}

function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}
function hashToken(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
export async function prepareApprovalActivation(
  approval: ApprovalInput,
  settings: MembershipSettings,
): Promise<PreparedActivation> {
  if (!approval.createMemberPortalAccount) return null;
  const rawToken = generateToken();
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + settings.activationTokenHours * 60 * 60_000),
    unusablePasswordHash: await hash(generateToken(), env.BCRYPT_ROUNDS),
  };
}
