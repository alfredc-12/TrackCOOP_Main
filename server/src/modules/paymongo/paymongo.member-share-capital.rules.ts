import { AppError } from "../../utils/app-error";
import type {
  PaymongoMemberShareCapitalProfile,
  PaymongoMemberShareCapitalSummary,
  PaymongoMembershipSettings,
  PaymongoMode,
} from "./paymongo.types";

export function memberCapitalMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function assertMemberShareCapitalProfileEligible(
  profile: PaymongoMemberShareCapitalProfile,
) {
  if (profile.approvalStatus !== "Approved") {
    throw new AppError(
      "Only approved members can contribute Share Capital",
      409,
      "MEMBER_SHARE_CAPITAL_APPROVAL_REQUIRED",
    );
  }
  if (profile.officialMemberStatus !== "Active") {
    throw new AppError(
      "Only active members can contribute Share Capital",
      409,
      "MEMBER_SHARE_CAPITAL_MEMBER_INACTIVE",
    );
  }
}

export function assertMemberShareCapitalAmount(amount: number) {
  if (!Number.isFinite(amount) || memberCapitalMoney(amount) <= 0) {
    throw new AppError(
      "Share Capital contribution amount must be positive",
      400,
      "MEMBER_SHARE_CAPITAL_AMOUNT_INVALID",
    );
  }
}

export function assertMemberShareCapitalCapacity(input: {
  validatedCapital: number;
  activePendingCapital: number;
  requestedAmount: number;
  maximumShareCapital: number;
}) {
  assertMemberShareCapitalAmount(input.requestedAmount);
  const projected = memberCapitalMoney(
    input.validatedCapital + input.activePendingCapital + input.requestedAmount,
  );
  if (projected > memberCapitalMoney(input.maximumShareCapital)) {
    throw new AppError(
      "Share Capital contribution would exceed PHP 15,000",
      409,
      "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
    );
  }
}

export function buildMemberShareCapitalSummary(input: {
  profile: PaymongoMemberShareCapitalProfile;
  settings: PaymongoMembershipSettings;
  validatedCapital: number;
  activePendingCapital: number;
  mode: PaymongoMode;
  history: PaymongoMemberShareCapitalSummary["history"];
  activeCheckout: PaymongoMemberShareCapitalSummary["activeCheckout"];
}): PaymongoMemberShareCapitalSummary {
  const validatedCapital = memberCapitalMoney(input.validatedCapital);
  const activePendingCapital = memberCapitalMoney(input.activePendingCapital);
  const maximumShareCapital = memberCapitalMoney(input.settings.maximumShareCapital);
  const remainingToTrueMember = memberCapitalMoney(
    Math.max(0, input.settings.trueMemberRequiredCapital - validatedCapital),
  );
  const availableCapacity = memberCapitalMoney(
    Math.max(0, maximumShareCapital - validatedCapital - activePendingCapital),
  );

  return {
    memberId: input.profile.id,
    memberCode: input.profile.memberCode,
    membershipType: input.profile.membershipType,
    officialMemberStatus: input.profile.officialMemberStatus,
    validatedCapital,
    activePendingCapital,
    remainingToTrueMember,
    maximumShareCapital,
    availableCapacity,
    mode: input.mode,
    eligible:
      input.profile.approvalStatus === "Approved"
      && input.profile.officialMemberStatus === "Active"
      && availableCapacity > 0,
    activeCheckout: input.activeCheckout,
    history: input.history,
  };
}
