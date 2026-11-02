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

/** Requirement type that is tracked but does not gate payment approval. */
export const orientationRequirementType: RequirementType = "Orientation/Seminar";
const completeRequirementStatuses: RequirementStatus[] = ["Verified", "Waived"];

export function isPaymentRequirementType(requirementType: RequirementType) {
  return paymentRequirementTypes.has(requirementType);
}

export function isRequirementComplete(status: RequirementStatus) {
  return completeRequirementStatuses.includes(status);
}

export function prePaymentRequirements(
  requirements: ChairmanApplicationRequirement[],
) {
  return requirements.filter(
    (requirement) =>
      !isPaymentRequirementType(requirement.requirementType)
      && requirement.requirementType !== orientationRequirementType,
  );
}

/** True when there is at least one pre-payment requirement and every one is Verified or Waived. */
export function isPrePaymentRequirementsComplete(requirements: ChairmanApplicationRequirement[]) {
  const gating = prePaymentRequirements(requirements);
  return gating.length > 0 && gating.every((requirement) => isRequirementComplete(requirement.requirementStatus));
}

const sqlList = (values: readonly string[]) => values.map((value) => `'${value.replace(/'/g, "''")}'`).join(", ");

/**
 * SQL predicate equivalent to {@link isPrePaymentRequirementsComplete} for application alias `alias`.
 * It is generated from the same constants so the server-side filter cannot drift from the rule that
 * gates payment approval. Applications with no pre-payment requirements are not complete.
 */
export function prePaymentRequirementsCompleteSql(alias = "a") {
  const gating = `r.membership_application_id = ${alias}.membership_application_id
        AND r.requirement_type NOT IN (${sqlList([...paymentRequirementTypes, orientationRequirementType])})`;
  return `(EXISTS (SELECT 1 FROM membership_application_requirements r WHERE ${gating})
      AND NOT EXISTS (SELECT 1 FROM membership_application_requirements r WHERE ${gating}
        AND r.requirement_status NOT IN (${sqlList(completeRequirementStatuses)})))`;
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
