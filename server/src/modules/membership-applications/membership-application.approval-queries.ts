import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type {
  ApplicationRow,
  CountRow,
  RequirementRow,
} from "./membership-application.approval-support";

export type ValidatedReference = { id: string; amount: number };
type ValidatedReferenceRow = RowDataPacket & { id: string; amount: string | number };

export async function selectApprovalApplication(
  connection: PoolConnection,
  applicationId: string,
) {
  const [rows] = await connection.execute<ApplicationRow[]>(
    `SELECT CAST(a.membership_application_id AS CHAR) AS id,
            a.application_code AS applicationCode,
            a.requested_membership_type AS requestedMembershipType,
            a.first_name AS firstName,
            a.middle_name AS middleName,
            a.last_name AS lastName,
            a.suffix,
            TRIM(CONCAT_WS(' ', a.first_name, NULLIF(a.middle_name, ''),
                           a.last_name, NULLIF(a.suffix, ''))) AS fullName,
            a.email,
            a.contact_number AS contactNumber,
            a.current_address AS currentAddress,
            a.barangay,
            a.municipality,
            a.province,
            a.orientation_commitment_accepted AS orientationCommitmentAccepted,
            a.membership_fee_commitment_accepted AS membershipFeeCommitmentAccepted,
            a.share_subscription_commitment_accepted AS shareSubscriptionCommitmentAccepted,
            a.bylaws_agreement_accepted AS bylawsAgreementAccepted,
            a.privacy_consent_accepted AS privacyConsentAccepted,
            a.applicant_signature_name AS applicantSignatureName,
            a.signed_at AS signedAt,
            a.signed_place AS signedPlace,
            a.application_status AS applicationStatus,
            CAST(a.converted_member_id AS CHAR) AS convertedMemberId,
            a.submitted_at AS submittedAt
       FROM membership_applications a
      WHERE a.membership_application_id = ?
      LIMIT 1
      FOR UPDATE`,
    [applicationId],
  );
  return rows[0] ?? null;
}

export async function selectApprovalRequirements(
  connection: PoolConnection,
  applicationId: string,
) {
  const [rows] = await connection.execute<RequirementRow[]>(
    `SELECT CAST(membership_application_requirement_id AS CHAR) AS id,
            requirement_type AS requirementType,
            requirement_status AS requirementStatus,
            CAST(payment_reference_id AS CHAR) AS paymentReferenceId
       FROM membership_application_requirements
      WHERE membership_application_id = ?
      ORDER BY membership_application_requirement_id ASC
      FOR UPDATE`,
    [applicationId],
  );
  return rows;
}

export async function validatedApplicationReferences(
  connection: PoolConnection,
  applicationId: string,
  purpose: "Associate Membership Fee" | "Share Capital",
): Promise<ValidatedReference[]> {
  const [rows] = await connection.execute<ValidatedReferenceRow[]>(
    `SELECT CAST(payment_reference_id AS CHAR) AS id, amount
       FROM payment_references
      WHERE related_entity_type = 'membership_application'
        AND related_entity_id = ?
        AND payment_purpose = ?
        AND validation_status = 'Validated'
      ORDER BY payment_reference_id ASC
      FOR UPDATE`,
    [applicationId, purpose],
  );
  return rows.map((row) => ({ id: row.id, amount: Number(row.amount) }));
}

export async function assertNoDuplicateMember(
  connection: PoolConnection,
  application: ApplicationRow,
) {
  const [rows] = await connection.execute<CountRow[]>(
    `SELECT COUNT(*) AS total
       FROM member_profiles
      WHERE (email IS NOT NULL AND ? IS NOT NULL AND email = ?)
         OR (contact_number IS NOT NULL AND contact_number = ?
             AND LOWER(full_name) = LOWER(?))`,
    [application.email, application.email, application.contactNumber, application.fullName],
  );
  if (Number(rows[0]?.total ?? 0) > 0) {
    throw new AppError(
      "A matching member profile already exists",
      409,
      "MEMBERSHIP_APPLICATION_MEMBER_CONFLICT",
    );
  }
}
