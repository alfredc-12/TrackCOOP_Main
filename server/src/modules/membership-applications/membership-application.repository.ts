import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import crypto from "node:crypto";
import path from "node:path";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import type {
  MembershipApplicationStatus,
  MembershipSettings,
  PublicApplicationRecord,
  PublicDocumentUploadInput,
  PublicMembershipApplicationInput,
  PublicStatusRequirement,
  PublicSubmissionContext,
  PublicSubmissionResult,
  RequirementType,
  StoredMembershipApplicationDocument,
} from "./membership-application.types";

type SettingRow = RowDataPacket & {
  settingKey: string;
  settingValue: string | null;
  valueType: "String" | "Number" | "Boolean" | "Date" | "JSON";
};

type DuplicateRow = RowDataPacket & { duplicateCount: number };

type PublicApplicationRow = RowDataPacket & {
  id: string;
  applicationCode: string;
  publicTrackingTokenHash: string;
  fullName: string;
  submittedAt: Date;
  applicationStatus: MembershipApplicationStatus;
  latestApplicantMessage: string | null;
};

type PublicRequirementRow = RowDataPacket & {
  requirementType: RequirementType;
  requirementStatus: PublicStatusRequirement["requirementStatus"];
  remarks: string | null;
};

const membershipSettingKeys = [
  "membership.associate_fee",
  "membership.initial_share_capital",
  "membership.true_member_required_capital",
  "membership.maximum_share_capital",
  "membership.share_capital_deadline_months",
  "membership.orientation_required",
  "membership.activation_token_hours",
  "membership.terms_version",
];

const defaultSettings: MembershipSettings = {
  associateFee: 200,
  initialShareCapital: 1500,
  trueMemberRequiredCapital: 3000,
  maximumShareCapital: 15000,
  shareCapitalDeadlineMonths: 12,
  orientationRequired: true,
  activationTokenHours: 72,
  termsVersion: "2026-07-24",
};

function mysqlDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function nullable(value: string | number | boolean | null | undefined) {
  return value ?? null;
}

function normalizeSetting(rows: SettingRow[]): MembershipSettings {
  const byKey = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
  const numberSetting = (key: string, fallback: number) => {
    const value = Number(byKey.get(key));
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    associateFee: numberSetting("membership.associate_fee", defaultSettings.associateFee),
    initialShareCapital: numberSetting(
      "membership.initial_share_capital",
      defaultSettings.initialShareCapital,
    ),
    trueMemberRequiredCapital: numberSetting(
      "membership.true_member_required_capital",
      defaultSettings.trueMemberRequiredCapital,
    ),
    maximumShareCapital: numberSetting(
      "membership.maximum_share_capital",
      defaultSettings.maximumShareCapital,
    ),
    shareCapitalDeadlineMonths: numberSetting(
      "membership.share_capital_deadline_months",
      defaultSettings.shareCapitalDeadlineMonths,
    ),
    orientationRequired:
      byKey.get("membership.orientation_required")?.toLowerCase() === "false"
        ? false
        : defaultSettings.orientationRequired,
    activationTokenHours: numberSetting(
      "membership.activation_token_hours",
      defaultSettings.activationTokenHours,
    ),
    termsVersion: byKey.get("membership.terms_version") ?? defaultSettings.termsVersion,
  };
}

function applicationCode(insertId: number) {
  return `MEM-APP-${new Date().getUTCFullYear()}-${String(insertId).padStart(6, "0")}`;
}

function initialRequirements(
  input: PublicMembershipApplicationInput,
  settings: MembershipSettings,
): RequirementType[] {
  const requirements: RequirementType[] = [
    "Associate Membership Fee",
    "Signed Application",
  ];

  if (settings.orientationRequired) {
    requirements.unshift("Orientation/Seminar");
  }

  if (input.requestedMembershipType === "True Member") {
    requirements.push("Initial Share Capital");
  }

  return requirements;
}

async function selectPublicApplication(
  connection: Pool | PoolConnection,
  applicationCodeValue: string,
): Promise<PublicApplicationRecord | null> {
  const [applicationRows] = await connection.execute<PublicApplicationRow[]>(
    `SELECT CAST(a.membership_application_id AS CHAR) AS id,
            a.application_code AS applicationCode,
            a.public_tracking_token_hash AS publicTrackingTokenHash,
            a.full_name AS fullName,
            a.submitted_at AS submittedAt,
            a.application_status AS applicationStatus,
            (
              SELECT h.applicant_message
                FROM membership_application_status_history h
               WHERE h.membership_application_id = a.membership_application_id
                 AND h.applicant_message IS NOT NULL
               ORDER BY h.changed_at DESC, h.membership_application_status_history_id DESC
               LIMIT 1
            ) AS latestApplicantMessage
       FROM membership_applications a
      WHERE a.application_code = ?
      LIMIT 1`,
    [applicationCodeValue],
  );

  const application = applicationRows[0];
  if (!application) return null;

  const [requirementRows] = await connection.execute<PublicRequirementRow[]>(
    `SELECT requirement_type AS requirementType,
            requirement_status AS requirementStatus,
            remarks
       FROM membership_application_requirements
      WHERE membership_application_id = ?
        AND requirement_status IN ('Pending', 'Rejected')
      ORDER BY membership_application_requirement_id ASC`,
    [application.id],
  );

  return {
    ...application,
    missingOrRejectedRequirements: requirementRows,
  };
}

export interface MembershipApplicationRepository {
  getMembershipSettings(): Promise<MembershipSettings>;
  hasRecentDuplicate(input: PublicMembershipApplicationInput): Promise<boolean>;
  createPublicApplication(input: {
    application: PublicMembershipApplicationInput;
    context: PublicSubmissionContext;
    publicTrackingTokenHash: string;
    settings: MembershipSettings;
    duplicateWarning: boolean;
    warnings: string[];
  }): Promise<Omit<PublicSubmissionResult, "trackingToken">>;
  findPublicApplicationByCode(applicationCode: string): Promise<PublicApplicationRecord | null>;
  storePublicDocument(input: {
    applicationId: string;
    applicationCode: string;
    document: PublicDocumentUploadInput;
    checksumSha256: string;
    storedFilePath: string;
  }): Promise<StoredMembershipApplicationDocument>;
}

export function createMembershipApplicationRepository(
  pool?: Pool,
): MembershipApplicationRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async getMembershipSettings() {
      const [rows] = await databasePool().execute<SettingRow[]>(
        `SELECT setting_key AS settingKey,
                setting_value AS settingValue,
                value_type AS valueType
           FROM system_settings
          WHERE setting_key IN (${membershipSettingKeys.map(() => "?").join(", ")})`,
        membershipSettingKeys,
      );

      return normalizeSetting(rows);
    },

    async hasRecentDuplicate(input) {
      const [rows] = await databasePool().execute<DuplicateRow[]>(
        `SELECT COUNT(*) AS duplicateCount
           FROM membership_applications
          WHERE LOWER(full_name) = LOWER(?)
            AND date_of_birth <=> ?
            AND submitted_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)
            AND (
              contact_number = ?
              OR (? IS NOT NULL AND email = ?)
            )`,
        [
          input.fullName,
          nullable(input.dateOfBirth),
          input.contactNumber,
          nullable(input.email),
          nullable(input.email),
        ],
      );

      return Number(rows[0]?.duplicateCount ?? 0) > 0;
    },

    async createPublicApplication(input) {
      return withTransaction(async (connection) => {
        const placeholderCode = `MEM-APP-PENDING-${crypto.randomUUID()}`;
        const application = input.application;

        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO membership_applications
             (application_code, public_tracking_token_hash, application_source,
              requested_membership_type, full_name, email, contact_number, civil_status,
              place_of_birth, date_of_birth, current_address, barangay, municipality, province,
              father_name, mother_name, spouse_name, occupation,
              orientation_commitment_accepted, membership_fee_commitment_accepted,
              membership_fee_amount, share_subscription_commitment_accepted,
              subscribed_shares, initial_share_capital_amount, target_share_capital_amount,
              share_capital_deadline_months, annual_interest_rate, patronage_refund_acknowledged,
              bylaws_agreement_accepted, privacy_consent_accepted, terms_version,
              applicant_signature_name, signed_at, signed_place, submitted_ip, submitted_user_agent)
           VALUES (?, ?, 'Public Website', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            placeholderCode,
            input.publicTrackingTokenHash,
            application.requestedMembershipType,
            application.fullName,
            nullable(application.email),
            application.contactNumber,
            nullable(application.civilStatus),
            nullable(application.placeOfBirth),
            nullable(application.dateOfBirth),
            application.currentAddress,
            nullable(application.barangay),
            application.municipality,
            application.province,
            nullable(application.fatherName),
            nullable(application.motherName),
            nullable(application.spouseName),
            nullable(application.occupation),
            application.orientationCommitmentAccepted,
            application.membershipFeeCommitmentAccepted,
            input.settings.associateFee,
            application.shareSubscriptionCommitmentAccepted,
            input.settings.initialShareCapital,
            input.settings.trueMemberRequiredCapital,
            input.settings.shareCapitalDeadlineMonths,
            application.patronageRefundAcknowledged,
            application.bylawsAgreementAccepted,
            application.privacyConsentAccepted,
            application.termsVersion ?? input.settings.termsVersion,
            application.applicantSignatureName,
            mysqlDateTime(application.signedAt),
            application.signedPlace,
            nullable(input.context.ipAddress),
            nullable(input.context.userAgent),
          ],
        );

        const membershipApplicationId = String(result.insertId);
        const code = applicationCode(result.insertId);

        await connection.execute(
          `UPDATE membership_applications
              SET application_code = ?
            WHERE membership_application_id = ?`,
          [code, membershipApplicationId],
        );

        for (const [index, beneficiary] of application.beneficiaries.entries()) {
          await connection.execute(
            `INSERT INTO membership_application_beneficiaries
               (membership_application_id, full_name, relationship, age_at_application, birth_date, display_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              membershipApplicationId,
              beneficiary.fullName,
              nullable(beneficiary.relationship),
              nullable(beneficiary.ageAtApplication),
              nullable(beneficiary.birthDate),
              index,
            ],
          );
        }

        for (const requirementType of initialRequirements(application, input.settings)) {
          await connection.execute(
            `INSERT INTO membership_application_requirements
               (membership_application_id, requirement_type, requirement_status)
             VALUES (?, ?, 'Pending')`,
            [membershipApplicationId, requirementType],
          );
        }

        await connection.execute(
          `INSERT INTO membership_application_status_history
             (membership_application_id, old_status, new_status, applicant_message, changed_by)
           VALUES (?, NULL, 'Submitted', 'Your application was submitted and is waiting for Chairman review.', NULL)`,
          [membershipApplicationId],
        );

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values, ip_address, user_agent)
           VALUES (NULL, 'membership_application.created', 'membership_applications', ?,
                   'A public membership application was submitted.', CAST(? AS JSON), ?, ?)`,
          [
            membershipApplicationId,
            JSON.stringify({
              applicationCode: code,
              applicationSource: "Public Website",
              requestedMembershipType: application.requestedMembershipType,
              duplicateWarning: input.duplicateWarning,
            }),
            nullable(input.context.ipAddress),
            nullable(input.context.userAgent),
          ],
        );

        const [createdRows] = await connection.execute<PublicApplicationRow[]>(
          `SELECT submitted_at AS submittedAt
             FROM membership_applications
            WHERE membership_application_id = ?
            LIMIT 1`,
          [membershipApplicationId],
        );

        return {
          applicationCode: code,
          duplicateWarning: input.duplicateWarning,
          warnings: input.warnings,
          submittedAt: createdRows[0]?.submittedAt ?? new Date(),
          nextStep: "Chairman review" as const,
        };
      }, databasePool());
    },

    findPublicApplicationByCode(applicationCodeValue) {
      return selectPublicApplication(databasePool(), applicationCodeValue);
    },

    async storePublicDocument(input) {
      return withTransaction(async (connection) => {
        const storedPath = path.normalize(input.storedFilePath).replace(/\\/g, "/");
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO membership_application_documents
             (membership_application_id, document_type, original_file_name, stored_file_path,
              mime_type, file_size_bytes, checksum_sha256, uploaded_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            input.applicationId,
            input.document.documentType,
            input.document.originalFileName,
            storedPath,
            input.document.mimeType,
            input.document.fileSizeBytes,
            input.checksumSha256,
          ],
        );

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (NULL, 'membership_application.document_uploaded',
                   'membership_application_documents', ?,
                   'A public applicant uploaded a membership application document.',
                   CAST(? AS JSON))`,
          [
            String(result.insertId),
            JSON.stringify({
              applicationCode: input.applicationCode,
              documentType: input.document.documentType,
              originalFileName: input.document.originalFileName,
              fileSizeBytes: input.document.fileSizeBytes,
              checksumSha256: input.checksumSha256,
            }),
          ],
        );

        return {
          documentType: input.document.documentType,
          originalFileName: input.document.originalFileName,
          mimeType: input.document.mimeType,
          fileSizeBytes: input.document.fileSizeBytes,
          checksumSha256: input.checksumSha256,
          uploadedAt: new Date(),
        };
      }, databasePool());
    },
  };
}
