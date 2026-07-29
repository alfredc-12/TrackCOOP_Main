import { AppError } from "../../utils/app-error";
import type {
  PaymongoMembershipApplicationRecord,
  PaymongoMembershipCheckoutPurpose,
  PaymongoMembershipSettings,
} from "./paymongo.types";

const terminalApplicationStatuses = new Set(["Approved", "Rejected", "Withdrawn"]);

export type MembershipRequirementStatus =
  | "Pending"
  | "Submitted"
  | "Verified"
  | "Rejected"
  | "Waived";

export type PublicMembershipPaymentState =
  | "Not Required"
  | "Required"
  | "Pending"
  | "Confirmed"
  | "Unavailable";

export type PublicMembershipFeeSummary = {
  requiredAmount: number;
  validatedAmount: number;
  pendingAmount: number;
  remainingAmount: number;
  status: PublicMembershipPaymentState;
  canStartCheckout: boolean;
};

export type PublicShareCapitalSummary = {
  validatedAmount: number;
  pendingAmount: number;
  targetAmount: number;
  maximumAmount: number;
  remainingToTarget: number;
  remainingToMaximum: number;
  installmentCount: number;
  minimumNextAmount: number;
  canStartCheckout: boolean;
};

export type PublicLatestCheckoutState = {
  paymentPurpose: PaymongoMembershipCheckoutPurpose;
  referenceNumber: string;
  amount: number;
  gatewayStatus: string;
  createdAt: Date;
  reusableUntil: Date;
  isReusable: boolean;
} | null;

export type PublicMembershipPaymentSummary = {
  paymongoMode: "test" | "live";
  membershipFee: PublicMembershipFeeSummary;
  shareCapital: PublicShareCapitalSummary;
  latestCheckout: PublicLatestCheckoutState;
  paymentRequirements: Array<{
    requirementType: "Associate Membership Fee" | "Initial Share Capital";
    requirementStatus: MembershipRequirementStatus;
    paymentPurpose: PaymongoMembershipCheckoutPurpose;
    paymentStatus: "Waiting" | "Confirmed";
    amount: number | null;
  }>;
};

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatApplicationCapitalReference(
  applicationCode: string,
  sequence: number,
) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) {
    throw new AppError(
      "Share capital installment sequence is invalid",
      409,
      "SHARE_CAPITAL_SEQUENCE_INVALID",
    );
  }
  return `${applicationCode}-CAP-${String(sequence).padStart(3, "0")}`;
}

export function validateApplicationShareCapitalAmount(input: {
  requestedAmount: number;
  validatedAmount: number;
  otherActivePendingAmount: number;
  initialShareCapital: number;
  maximumShareCapital: number;
}) {
  const requested = roundMoney(input.requestedAmount);
  const validated = roundMoney(input.validatedAmount);
  const pending = roundMoney(input.otherActivePendingAmount);
  const minimum = validated + pending > 0
    ? 0.01
    : roundMoney(input.initialShareCapital);

  if (!Number.isFinite(requested) || requested <= 0) {
    throw new AppError(
      "Share capital contribution must be greater than zero",
      400,
      "SHARE_CAPITAL_AMOUNT_INVALID",
    );
  }
  if (requested < minimum) {
    throw new AppError(
      `Initial share capital payment must be at least PHP ${minimum.toLocaleString("en-US")}`,
      400,
      "SHARE_CAPITAL_AMOUNT_BELOW_MINIMUM",
    );
  }
  if (roundMoney(validated + pending + requested) > roundMoney(input.maximumShareCapital)) {
    throw new AppError(
      "Share capital payment would exceed the maximum allowed amount",
      409,
      "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
    );
  }

  return { requestedAmount: requested, minimumAmount: minimum };
}

export function buildPublicMembershipPaymentSummary(input: {
  mode: "test" | "live";
  gatewayEnabled: boolean;
  applicationStatus: string;
  requestedMembershipType: PaymongoMembershipApplicationRecord["requestedMembershipType"];
  settings: PaymongoMembershipSettings;
  feeValidatedAmount: number;
  feePendingAmount: number;
  capitalValidatedAmount: number;
  capitalPendingAmount: number;
  installmentCount: number;
  latestCheckout: PublicLatestCheckoutState;
  feeRequirementStatus: MembershipRequirementStatus;
  capitalRequirementStatus: MembershipRequirementStatus | null;
}): PublicMembershipPaymentSummary {
  const eligibleApplication = !terminalApplicationStatuses.has(input.applicationStatus);
  const feeRequired = roundMoney(input.settings.associateFee);
  const feeValidated = roundMoney(input.feeValidatedAmount);
  const feePending = roundMoney(input.feePendingAmount);
  const feeRemaining = Math.max(0, roundMoney(feeRequired - feeValidated - feePending));
  const feeConfirmed = feeValidated >= feeRequired;
  const feeStatus: PublicMembershipPaymentState = !eligibleApplication && !feeConfirmed
    ? "Unavailable"
    : feeConfirmed
      ? "Confirmed"
      : feePending > 0
        ? "Pending"
        : "Required";

  const capitalRequired = input.requestedMembershipType === "True Member";
  const capitalValidated = roundMoney(input.capitalValidatedAmount);
  const capitalPending = roundMoney(input.capitalPendingAmount);
  const committedCapital = roundMoney(capitalValidated + capitalPending);
  const remainingToTarget = Math.max(
    0,
    roundMoney(input.settings.trueMemberRequiredCapital - committedCapital),
  );
  const remainingToMaximum = Math.max(
    0,
    roundMoney(input.settings.maximumShareCapital - committedCapital),
  );
  const minimumNextAmount = committedCapital > 0
    ? 0.01
    : roundMoney(input.settings.initialShareCapital);

  return {
    paymongoMode: input.mode,
    membershipFee: {
      requiredAmount: feeRequired,
      validatedAmount: feeValidated,
      pendingAmount: feePending,
      remainingAmount: feeRemaining,
      status: feeStatus,
      canStartCheckout: input.gatewayEnabled && eligibleApplication && !feeConfirmed,
    },
    shareCapital: {
      validatedAmount: capitalValidated,
      pendingAmount: capitalPending,
      targetAmount: roundMoney(input.settings.trueMemberRequiredCapital),
      maximumAmount: roundMoney(input.settings.maximumShareCapital),
      remainingToTarget,
      remainingToMaximum,
      installmentCount: Math.max(0, Math.trunc(input.installmentCount)),
      minimumNextAmount,
      canStartCheckout: input.gatewayEnabled
        && eligibleApplication
        && capitalRequired
        && remainingToMaximum >= minimumNextAmount,
    },
    latestCheckout: input.latestCheckout,
    paymentRequirements: [
      {
        requirementType: "Associate Membership Fee",
        requirementStatus: input.feeRequirementStatus,
        paymentPurpose: "Associate Membership Fee",
        paymentStatus: feeConfirmed ? "Confirmed" : "Waiting",
        amount: feeRequired,
      },
      ...(capitalRequired && input.capitalRequirementStatus
        ? [{
            requirementType: "Initial Share Capital" as const,
            requirementStatus: input.capitalRequirementStatus,
            paymentPurpose: "Share Capital" as const,
            paymentStatus: capitalValidated >= input.settings.initialShareCapital
              ? "Confirmed" as const
              : "Waiting" as const,
            amount: committedCapital || null,
          }]
        : []),
    ],
  };
}
