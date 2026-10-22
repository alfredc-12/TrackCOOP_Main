import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export const REFERRAL_REWARD_POLICY_SETTING_KEY = "referrals.reward_policy";

export type ReferralRewardPolicy = {
  enabled: boolean;
  creditsPerSuccessfulReferral: number;
  label: string;
};

export const DEFAULT_REFERRAL_REWARD_POLICY: ReferralRewardPolicy = {
  enabled: true,
  creditsPerSuccessfulReferral: 1,
  label: "Referral credits",
};

type SettingRow = RowDataPacket & { settingValue: string | null };

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return fallback;
}

function asNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeReferralRewardPolicy(value: unknown): ReferralRewardPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_REFERRAL_REWARD_POLICY };
  }

  const input = value as Record<string, unknown>;
  const creditsPerSuccessfulReferral = Math.min(
    100,
    Math.max(0, Math.round(asNumber(input.creditsPerSuccessfulReferral, DEFAULT_REFERRAL_REWARD_POLICY.creditsPerSuccessfulReferral))),
  );
  const label = typeof input.label === "string" && input.label.trim()
    ? input.label.trim().slice(0, 80)
    : DEFAULT_REFERRAL_REWARD_POLICY.label;

  return {
    enabled: asBoolean(input.enabled, DEFAULT_REFERRAL_REWARD_POLICY.enabled),
    creditsPerSuccessfulReferral,
    label,
  };
}

export function calculateReferralRewardCredits(successfulReferrals: number, policy: ReferralRewardPolicy) {
  if (!policy.enabled) return 0;
  return Math.max(0, Math.floor(Number(successfulReferrals) || 0)) * policy.creditsPerSuccessfulReferral;
}

export async function loadReferralRewardPolicy(connection: Pool | PoolConnection): Promise<ReferralRewardPolicy> {
  try {
    const [rows] = await connection.execute<SettingRow[]>(
      `SELECT setting_value AS settingValue
         FROM system_settings
        WHERE setting_key = ?
        LIMIT 1`,
      [REFERRAL_REWARD_POLICY_SETTING_KEY],
    );
    const rawValue = rows[0]?.settingValue;
    if (!rawValue) return { ...DEFAULT_REFERRAL_REWARD_POLICY };
    return normalizeReferralRewardPolicy(JSON.parse(rawValue) as unknown);
  } catch {
    return { ...DEFAULT_REFERRAL_REWARD_POLICY };
  }
}
