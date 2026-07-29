import { AppError } from "../../utils/app-error";
import type {
  MembershipSettings,
  RequestedMembershipType,
  RequirementStatus,
} from "./membership-application.types";
import type {
  ApprovalMembershipDecision,
  ApplicationCapitalReference,
  CapitalConversionPlan,
} from "./membership-application.capital.types";

export function capitalMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildCapitalConversionPlan(input: {
  references: ApplicationCapitalReference[];
  existingPaymentReferenceIds?: Iterable<string>;
  maximumShareCapital: number;
}): CapitalConversionPlan {
  const validatedReferences = input.references.filter(
    (reference) => reference.validationStatus === "Validated",
  );

  for (const reference of validatedReferences) {
    if (!Number.isFinite(reference.amount) || reference.amount <= 0) {
      throw new AppError(
        "Validated Share Capital contains an invalid amount",
        409,
        "SHARE_CAPITAL_VALIDATED_AMOUNT_INVALID",
      );
    }
  }

  const validatedTotal = capitalMoney(
    validatedReferences.reduce((total, reference) => total + reference.amount, 0),
  );
  if (validatedTotal > capitalMoney(input.maximumShareCapital)) {
    throw new AppError(
      "Validated share capital cannot exceed PHP 15,000",
      409,
      "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
    );
  }

  const existing = new Set(input.existingPaymentReferenceIds ?? []);
  return {
    validatedReferences,
    missingReferences: validatedReferences.filter(
      (reference) => !existing.has(reference.paymentReferenceId),
    ),
    validatedTotal,
  };
}

export function decideApprovalMembership(input: {
  requestedMembershipType: RequestedMembershipType;
  validatedCapitalAmount: number;
  settings: Pick<
    MembershipSettings,
    "initialShareCapital" | "trueMemberRequiredCapital" | "maximumShareCapital"
  >;
}): ApprovalMembershipDecision {
  const validatedCapital = capitalMoney(input.validatedCapitalAmount);
  if (validatedCapital > capitalMoney(input.settings.maximumShareCapital)) {
    throw new AppError(
      "Validated share capital cannot exceed PHP 15,000",
      409,
      "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
    );
  }

  if (input.requestedMembershipType === "Associate") {
    return {
      membershipType: "Associate",
      trueMemberEligible: false,
      needsShareCapitalDeadline: false,
    };
  }

  if (validatedCapital < capitalMoney(input.settings.initialShareCapital)) {
    throw new AppError(
      "At least PHP 1,500 validated initial share capital is required",
      409,
      "INITIAL_SHARE_CAPITAL_INCOMPLETE",
    );
  }

  const trueMemberEligible =
    validatedCapital >= capitalMoney(input.settings.trueMemberRequiredCapital);
  return {
    membershipType: trueMemberEligible ? "True Member" : "Associate",
    trueMemberEligible,
    needsShareCapitalDeadline: !trueMemberEligible,
  };
}

export function synchronizedInitialCapitalRequirementStatus(input: {
  currentStatus: RequirementStatus;
  validatedCapitalAmount: number;
  initialShareCapital: number;
}): RequirementStatus {
  if (input.currentStatus === "Waived") return "Waived";
  return capitalMoney(input.validatedCapitalAmount)
    >= capitalMoney(input.initialShareCapital)
    ? "Verified"
    : input.currentStatus;
}
