import { AppError } from "../../utils/app-error";
import type {
  ChairmanApplicationRequirement,
  RequirementStatus,
  RequirementType,
} from "./membership-application.types";

export const paymentRequirementTypes = new Set<RequirementType>([
  "Associate Membership Fee",
  "Initial Share Capital",
]);

export function isPaymentRequirementType(requirementType: RequirementType) {
  return paymentRequirementTypes.has(requirementType);
}

export function isRequirementComplete(status: RequirementStatus) {
  return status === "Verified" || status === "Waived";
}

export function prePaymentRequirements(
  requirements: ChairmanApplicationRequirement[],
) {
  return requirements.filter(
    (requirement) =>
      !isPaymentRequirementType(requirement.requirementType)
      && requirement.requirementType !== "Orientation/Seminar",
  );
}

export function findIncompletePrePaymentRequirement(
  requirements: ChairmanApplicationRequirement[],
) {
  return prePaymentRequirements(requirements).find(
    (requirement) => !isRequirementComplete(requirement.requirementStatus),
  ) ?? null;
}

export function assertPrePaymentRequirementsComplete(
  requirements: ChairmanApplicationRequirement[],
) {
  const incomplete = findIncompletePrePaymentRequirement(requirements);
  if (!incomplete) return;

  throw new AppError(
    `The ${incomplete.requirementType} requirement must be verified or waived before payment can be approved`,
    409,
    "MEMBERSHIP_PRE_PAYMENT_REQUIREMENT_INCOMPLETE",
  );
}
