import type { PoolConnection } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import {
  synchronizedInitialCapitalRequirementStatus,
} from "./membership-application.capital";
import type {
  ApprovalInput,
  MembershipSettings,
  RequirementType,
} from "./membership-application.types";
import type { ValidatedReference } from "./membership-application.approval-queries";
import {
  approvalMoney,
  type ApplicationRow,
  type RequirementRow,
} from "./membership-application.approval-support";

export function validateApplicationForApproval(
  application: ApplicationRow,
  approval: ApprovalInput,
) {
  if (application.applicationStatus !== "Under Review") {
    throw new AppError(
      "Only applications under review can be approved",
      409,
      "MEMBERSHIP_APPLICATION_APPROVAL_STATUS_INVALID",
    );
  }
  if (application.convertedMemberId) {
    throw new AppError(
      "This application has already been converted to a member profile",
      409,
      "MEMBERSHIP_APPLICATION_ALREADY_CONVERTED",
    );
  }

  const fields = [
    ["fullName", application.fullName],
    ["contactNumber", application.contactNumber],
    ["currentAddress", application.currentAddress],
    ["municipality", application.municipality],
    ["province", application.province],
    ["applicantSignatureName", application.applicantSignatureName],
    ["signedAt", application.signedAt],
    ["signedPlace", application.signedPlace],
    ["boardMeetingDate", approval.boardMeetingDate],
    ["secretaryName", approval.secretaryName],
    ["decisionReason", approval.decisionReason],
  ];
  const missing = fields.filter(
    ([, value]) => value === null || value === undefined || value === "",
  );
  if (missing.length) {
    throw new AppError(
      "The application is missing required approval fields",
      400,
      "MEMBERSHIP_APPLICATION_APPROVAL_INCOMPLETE",
      missing.map(([field]) => ({
        code: "REQUIRED",
        field: String(field),
        message: "This field is required",
      })),
    );
  }

  if (
    !application.orientationCommitmentAccepted
    || !application.membershipFeeCommitmentAccepted
    || !application.shareSubscriptionCommitmentAccepted
    || !application.bylawsAgreementAccepted
    || !application.privacyConsentAccepted
  ) {
    throw new AppError(
      "The application has unaccepted required commitments",
      400,
      "MEMBERSHIP_APPLICATION_COMMITMENTS_INCOMPLETE",
    );
  }
}

export async function synchronizeApprovalRequirements(input: {
  connection: PoolConnection;
  actorUserId: string;
  requirements: RequirementRow[];
  settings: MembershipSettings;
  feeReferences: ValidatedReference[];
  validatedCapitalAmount: number;
  latestCapitalReferenceId: string | null;
}) {
  const feeRequirement = input.requirements.find(
    (item) => item.requirementType === "Associate Membership Fee",
  );
  if (!feeRequirement) {
    throw new AppError(
      "The Associate Membership Fee requirement is incomplete",
      409,
      "MEMBERSHIP_APPLICATION_REQUIREMENT_INCOMPLETE",
    );
  }

  const feeTotal = approvalMoney(
    input.feeReferences.reduce((total, item) => total + item.amount, 0),
  );
  const latestFeeReferenceId = input.feeReferences.at(-1)?.id ?? null;
  if (
    feeRequirement.requirementStatus !== "Waived"
    && feeTotal >= approvalMoney(input.settings.associateFee)
  ) {
    await input.connection.execute(
      `UPDATE membership_application_requirements
          SET requirement_status = 'Verified',
              payment_reference_id = COALESCE(?, payment_reference_id),
              completion_date = COALESCE(completion_date, UTC_DATE()),
              verified_by = COALESCE(verified_by, ?),
              verified_at = COALESCE(verified_at, UTC_TIMESTAMP()),
              remarks = 'Validated application-related membership fee references satisfy the configured fee.'
        WHERE membership_application_requirement_id = ?`,
      [latestFeeReferenceId, input.actorUserId, feeRequirement.id],
    );
    feeRequirement.requirementStatus = "Verified";
    feeRequirement.paymentReferenceId = latestFeeReferenceId;
  }

  const capitalRequirement = input.requirements.find(
    (item) => item.requirementType === "Initial Share Capital",
  );
  if (capitalRequirement) {
    const nextStatus = synchronizedInitialCapitalRequirementStatus({
      currentStatus: capitalRequirement.requirementStatus,
      validatedCapitalAmount: input.validatedCapitalAmount,
      initialShareCapital: input.settings.initialShareCapital,
    });
    if (nextStatus === "Verified" && capitalRequirement.requirementStatus !== "Verified") {
      await input.connection.execute(
        `UPDATE membership_application_requirements
            SET requirement_status = 'Verified',
                payment_reference_id = COALESCE(?, payment_reference_id),
                completion_date = COALESCE(completion_date, UTC_DATE()),
                verified_by = COALESCE(verified_by, ?),
                verified_at = COALESCE(verified_at, UTC_TIMESTAMP()),
                remarks = 'Aggregate validated application-related Share Capital meets the configured initial requirement.'
          WHERE membership_application_requirement_id = ?`,
        [input.latestCapitalReferenceId, input.actorUserId, capitalRequirement.id],
      );
      capitalRequirement.requirementStatus = "Verified";
      capitalRequirement.paymentReferenceId = input.latestCapitalReferenceId;
    }
  }

  return feeTotal;
}

export function validateApprovalRequirements(
  application: ApplicationRow,
  requirements: RequirementRow[],
) {
  const byType = new Map(requirements.map((item) => [item.requirementType, item]));
  const requiredTypes: RequirementType[] = [
    "Orientation/Seminar",
    "Associate Membership Fee",
    "Signed Application",
  ];
  if (application.requestedMembershipType === "True Member") {
    requiredTypes.push("Initial Share Capital");
  }

  const incomplete = requiredTypes.find((type) => {
    const requirement = byType.get(type);
    return !requirement || !["Verified", "Waived"].includes(requirement.requirementStatus);
  });
  if (incomplete) {
    throw new AppError(
      `The ${incomplete} requirement is incomplete`,
      409,
      "MEMBERSHIP_APPLICATION_REQUIREMENT_INCOMPLETE",
    );
  }
  if (byType.get("Orientation/Seminar")?.requirementStatus !== "Verified") {
    throw new AppError(
      "Orientation must be verified before approval",
      409,
      "MEMBERSHIP_ORIENTATION_INCOMPLETE",
    );
  }
  return byType;
}
