import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import crypto from "node:crypto";
import path from "node:path";
import { limitOffsetSql } from "../../db/pagination";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  ApprovalInput,
  ApprovalResult,
  ChairmanApplicationBeneficiary,
  ChairmanApplicationDetail,
  ChairmanApplicationDocument,
  ChairmanApplicationHistoryEntry,
  ChairmanApplicationListItem,
  ChairmanApplicationListQuery,
  ChairmanApplicationListResult,
  ChairmanApplicationRequirement,
  ChairmanApplicationSummary,
  ChairmanMembershipApplicationInput,
  ChairmanMembershipApplicationUpdateInput,
  MembershipApplicationBeneficiaryInput,
  MembershipApplicationStatus,
  MembershipSettings,
  PublicApplicationRecord,
  PublicDocumentUploadInput,
  PublicMembershipApplicationInput,
  PublicPaymentRequirement,
  PublicStatusRequirement,
  PublicSubmissionContext,
  PublicSubmissionResult,
  RequirementInput,
  RequirementStatus,
  RequirementType,
  RequirementUpdateInput,
  RequestedMembershipType,
  StatusTransitionInput,
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
  dateOfBirth: string | null;
  requestedMembershipType: RequestedMembershipType;
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

type PublicPaymentRequirementRow = RowDataPacket & {
  requirementType: PublicPaymentRequirement["requirementType"];
  requirementStatus: RequirementStatus;
  paymentPurpose: PublicPaymentRequirement["paymentPurpose"];
  paymentStatus: PublicPaymentRequirement["paymentStatus"];
  amount: string | number | null;
};

type CountRow = RowDataPacket & { total: number };

type ChairmanApplicationRow = RowDataPacket & {
  id: string;
  applicationCode: string;
  applicationSource: ChairmanApplicationListItem["applicationSource"];
  requestedMembershipType: RequestedMembershipType;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  fullName: string;
  email: string | null;
  contactNumber: string;
  civilStatus: ChairmanApplicationDetail["civilStatus"];
  placeOfBirth: string | null;
  dateOfBirth: string | null;
  currentAddress: string;
  barangay: string | null;
  municipality: string;
  province: string;
  fatherName: string | null;
  motherName: string | null;
  spouseName: string | null;
  occupation: string | null;
  orientationCommitmentAccepted: number;
  membershipFeeCommitmentAccepted: number;
  shareSubscriptionCommitmentAccepted: number;
  patronageRefundAcknowledged: number;
  bylawsAgreementAccepted: number;
  privacyConsentAccepted: number;
  termsVersion: string;
  applicantSignatureName: string;
  signedAt: Date;
  signedPlace: string;
  applicationStatus: MembershipApplicationStatus;
  submittedByUserId: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  boardMeetingDate: string | null;
  secretaryName: string | null;
  decisionReason: string | null;
  convertedMemberId: string | null;
  submittedIp: string | null;
  submittedUserAgent: string | null;
  submittedAt: Date;
};

type BeneficiaryRow = RowDataPacket & ChairmanApplicationBeneficiary;
type DocumentRow = RowDataPacket & ChairmanApplicationDocument & { storedFilePath?: string };
type RequirementRow = RowDataPacket & ChairmanApplicationRequirement;
type HistoryRow = RowDataPacket & ChairmanApplicationHistoryEntry;
type SummaryRow = RowDataPacket & {
  total: number;
  submitted: number;
  underReview: number;
  needsInformation: number;
  approved: number;
  rejected: number;
  withdrawn: number;
};

type PaymentAmountRow = RowDataPacket & { total: string | number | null };
type RoleRow = RowDataPacket & { roleId: number };
type ExistingIdRow = RowDataPacket & { id: string };

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

const applicantFullNameSql =
  "TRIM(CONCAT_WS(' ', a.first_name, NULLIF(a.middle_name, ''), a.last_name, NULLIF(a.suffix, '')))";

const listSortColumns: Record<ChairmanApplicationListQuery["sortBy"], string> = {
  submittedAt: "a.submitted_at",
  fullName: applicantFullNameSql,
  applicationStatus: "a.application_status",
  requestedMembershipType: "a.requested_membership_type",
};

const allowedTransitions: Record<MembershipApplicationStatus, MembershipApplicationStatus[]> = {
  Submitted: ["Under Review", "Needs Information", "Rejected", "Withdrawn"],
  "Under Review": ["Needs Information", "Rejected", "Withdrawn", "Approved"],
  "Needs Information": ["Under Review", "Withdrawn"],
  Approved: [],
  Rejected: [],
  Withdrawn: [],
};

function mysqlDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function mysqlDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10);
}

function dateMonthsFromNow(months: number) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + months);
  return mysqlDate(date);
}

function applicantFullName(input: Pick<PublicMembershipApplicationInput, "firstName" | "middleName" | "lastName" | "suffix">) {
  return [input.firstName, input.middleName, input.lastName, input.suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
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

function memberCode(insertId: number) {
  return `NFFAC-${new Date().getUTCFullYear()}-${String(insertId).padStart(6, "0")}`;
}

function applicationSelect() {
  return `SELECT CAST(a.membership_application_id AS CHAR) AS id,
                 a.application_code AS applicationCode,
                 a.application_source AS applicationSource,
                 a.requested_membership_type AS requestedMembershipType,
                 a.first_name AS firstName,
                 a.middle_name AS middleName,
                 a.last_name AS lastName,
                 a.suffix,
                 ${applicantFullNameSql} AS fullName,
                 a.email,
                 a.contact_number AS contactNumber,
                 a.civil_status AS civilStatus,
                 a.place_of_birth AS placeOfBirth,
                 CAST(a.date_of_birth AS CHAR) AS dateOfBirth,
                 a.current_address AS currentAddress,
                 a.barangay,
                 a.municipality,
                 a.province,
                 a.father_name AS fatherName,
                 a.mother_name AS motherName,
                 a.spouse_name AS spouseName,
                 a.occupation,
                 a.orientation_commitment_accepted AS orientationCommitmentAccepted,
                 a.membership_fee_commitment_accepted AS membershipFeeCommitmentAccepted,
                 a.share_subscription_commitment_accepted AS shareSubscriptionCommitmentAccepted,
                 a.patronage_refund_acknowledged AS patronageRefundAcknowledged,
                 a.bylaws_agreement_accepted AS bylawsAgreementAccepted,
                 a.privacy_consent_accepted AS privacyConsentAccepted,
                 a.terms_version AS termsVersion,
                 a.applicant_signature_name AS applicantSignatureName,
                 a.signed_at AS signedAt,
                 a.signed_place AS signedPlace,
                 a.application_status AS applicationStatus,
                 CAST(a.submitted_by_user_id AS CHAR) AS submittedByUserId,
                 CAST(a.reviewed_by AS CHAR) AS reviewedBy,
                 a.reviewed_at AS reviewedAt,
                 CAST(a.board_meeting_date AS CHAR) AS boardMeetingDate,
                 a.secretary_name AS secretaryName,
                 a.decision_reason AS decisionReason,
                 CAST(a.converted_member_id AS CHAR) AS convertedMemberId,
                 a.submitted_ip AS submittedIp,
                 a.submitted_user_agent AS submittedUserAgent,
                 a.submitted_at AS submittedAt
            FROM membership_applications a`;
}

function mapApplicationListItem(row: ChairmanApplicationRow): ChairmanApplicationListItem {
  return {
    id: row.id,
    applicationCode: row.applicationCode,
    applicationSource: row.applicationSource,
    requestedMembershipType: row.requestedMembershipType,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    suffix: row.suffix,
    fullName: row.fullName,
    email: row.email,
    contactNumber: row.contactNumber,
    barangay: row.barangay,
    applicationStatus: row.applicationStatus,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    convertedMemberId: row.convertedMemberId,
  };
}

function mapApplicationDetail(
  row: ChairmanApplicationRow,
  beneficiaries: ChairmanApplicationBeneficiary[],
  documents: ChairmanApplicationDocument[],
  requirements: ChairmanApplicationRequirement[],
  history: ChairmanApplicationHistoryEntry[],
): ChairmanApplicationDetail {
  return {
    ...mapApplicationListItem(row),
    civilStatus: row.civilStatus,
    placeOfBirth: row.placeOfBirth,
    dateOfBirth: row.dateOfBirth,
    currentAddress: row.currentAddress,
    municipality: row.municipality,
    province: row.province,
    fatherName: row.fatherName,
    motherName: row.motherName,
    spouseName: row.spouseName,
    occupation: row.occupation,
    orientationCommitmentAccepted: Boolean(row.orientationCommitmentAccepted),
    membershipFeeCommitmentAccepted: Boolean(row.membershipFeeCommitmentAccepted),
    shareSubscriptionCommitmentAccepted: Boolean(row.shareSubscriptionCommitmentAccepted),
    patronageRefundAcknowledged: Boolean(row.patronageRefundAcknowledged),
    bylawsAgreementAccepted: Boolean(row.bylawsAgreementAccepted),
    privacyConsentAccepted: Boolean(row.privacyConsentAccepted),
    applicantSignatureName: row.applicantSignatureName,
    signedAt: row.signedAt.toISOString(),
    signedPlace: row.signedPlace,
    termsVersion: row.termsVersion,
    submittedByUserId: row.submittedByUserId,
    reviewedBy: row.reviewedBy,
    boardMeetingDate: row.boardMeetingDate,
    secretaryName: row.secretaryName,
    decisionReason: row.decisionReason,
    submittedIp: row.submittedIp,
    submittedUserAgent: row.submittedUserAgent,
    beneficiaries,
    documents,
    requirements,
    history,
  };
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
            CAST(a.date_of_birth AS CHAR) AS dateOfBirth,
            a.requested_membership_type AS requestedMembershipType,
            ${applicantFullNameSql} AS fullName,
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

  const [paymentRows] = await connection.execute<PublicPaymentRequirementRow[]>(
    `SELECT r.requirement_type AS requirementType,
            r.requirement_status AS requirementStatus,
            CASE
              WHEN r.requirement_type = 'Initial Share Capital' THEN 'Share Capital'
              ELSE 'Associate Membership Fee'
            END AS paymentPurpose,
            CASE WHEN pr.validation_status = 'Validated' THEN 'Confirmed' ELSE 'Waiting' END AS paymentStatus,
            pr.amount
       FROM membership_application_requirements r
       LEFT JOIN payment_references pr ON pr.payment_reference_id = r.payment_reference_id
      WHERE r.membership_application_id = ?
        AND r.requirement_type IN ('Associate Membership Fee', 'Initial Share Capital')
      ORDER BY r.membership_application_requirement_id ASC`,
    [application.id],
  );

  return {
    ...application,
    missingOrRejectedRequirements: requirementRows,
    paymentRequirements: paymentRows.map((row) => ({
      ...row,
      amount: row.amount === null ? null : Number(row.amount),
    })),
  };
}

async function selectBeneficiaries(
  connection: Pool | PoolConnection,
  applicationId: string,
) {
  const [rows] = await connection.execute<BeneficiaryRow[]>(
    `SELECT CAST(membership_application_beneficiary_id AS CHAR) AS id,
            CAST(membership_application_id AS CHAR) AS applicationId,
            full_name AS fullName,
            relationship,
            age_at_application AS ageAtApplication,
            CAST(birth_date AS CHAR) AS birthDate,
            display_order AS displayOrder
       FROM membership_application_beneficiaries
      WHERE membership_application_id = ?
      ORDER BY display_order ASC, membership_application_beneficiary_id ASC`,
    [applicationId],
  );
  return rows;
}

async function selectDocuments(
  connection: Pool | PoolConnection,
  applicationId: string,
) {
  const [rows] = await connection.execute<DocumentRow[]>(
    `SELECT CAST(membership_application_document_id AS CHAR) AS id,
            CAST(membership_application_id AS CHAR) AS applicationId,
            document_type AS documentType,
            original_file_name AS originalFileName,
            mime_type AS mimeType,
            file_size_bytes AS fileSizeBytes,
            checksum_sha256 AS checksumSha256,
            CAST(uploaded_by_user_id AS CHAR) AS uploadedByUserId,
            uploaded_at AS uploadedAt
       FROM membership_application_documents
      WHERE membership_application_id = ?
      ORDER BY uploaded_at DESC, membership_application_document_id DESC`,
    [applicationId],
  );
  return rows;
}

async function selectRequirements(
  connection: Pool | PoolConnection,
  applicationId: string,
) {
  const [rows] = await connection.execute<RequirementRow[]>(
    `SELECT CAST(membership_application_requirement_id AS CHAR) AS id,
            CAST(membership_application_id AS CHAR) AS applicationId,
            requirement_type AS requirementType,
            requirement_status AS requirementStatus,
            CAST(payment_reference_id AS CHAR) AS paymentReferenceId,
            CAST(membership_application_document_id AS CHAR) AS documentId,
            CAST(completion_date AS CHAR) AS completionDate,
            CAST(verified_by AS CHAR) AS verifiedBy,
            verified_at AS verifiedAt,
            remarks
       FROM membership_application_requirements
      WHERE membership_application_id = ?
      ORDER BY membership_application_requirement_id ASC`,
    [applicationId],
  );
  return rows;
}

async function selectHistory(
  connection: Pool | PoolConnection,
  applicationId: string,
) {
  const [rows] = await connection.execute<HistoryRow[]>(
    `SELECT CAST(membership_application_status_history_id AS CHAR) AS id,
            CAST(membership_application_id AS CHAR) AS applicationId,
            old_status AS oldStatus,
            new_status AS newStatus,
            internal_note AS internalNote,
            applicant_message AS applicantMessage,
            CAST(changed_by AS CHAR) AS changedBy,
            changed_at AS changedAt
       FROM membership_application_status_history
      WHERE membership_application_id = ?
      ORDER BY changed_at DESC, membership_application_status_history_id DESC`,
    [applicationId],
  );
  return rows;
}

async function selectApplicationDetail(
  connection: Pool | PoolConnection,
  applicationId: string,
) {
  const [rows] = await connection.execute<ChairmanApplicationRow[]>(
    `${applicationSelect()} WHERE a.membership_application_id = ? LIMIT 1`,
    [applicationId],
  );
  const row = rows[0];
  if (!row) return null;

  const [beneficiaries, documents, requirements, history] = await Promise.all([
    selectBeneficiaries(connection, applicationId),
    selectDocuments(connection, applicationId),
    selectRequirements(connection, applicationId),
    selectHistory(connection, applicationId),
  ]);

  return mapApplicationDetail(row, beneficiaries, documents, requirements, history);
}

function requiredReason(
  nextStatus: MembershipApplicationStatus,
  input: StatusTransitionInput,
) {
  return input.reason ?? input.applicantMessage ?? input.internalNote ?? null;
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
  }): Promise<PublicSubmissionResult>;
  findPublicApplicationByCode(applicationCode: string): Promise<PublicApplicationRecord | null>;
  storePublicDocument(input: {
    applicationId: string;
    applicationCode: string;
    document: PublicDocumentUploadInput;
    checksumSha256: string;
    storedFilePath: string;
  }): Promise<StoredMembershipApplicationDocument>;
  summary(): Promise<ChairmanApplicationSummary>;
  list(query: ChairmanApplicationListQuery): Promise<ChairmanApplicationListResult>;
  createChairmanApplication(input: {
    application: ChairmanMembershipApplicationInput;
    publicTrackingTokenHash: string;
    settings: MembershipSettings;
    auth: AuthContext;
  }): Promise<ChairmanApplicationDetail>;
  findChairmanApplicationById(applicationId: string): Promise<ChairmanApplicationDetail | null>;
  updateApplication(
    applicationId: string,
    input: ChairmanMembershipApplicationUpdateInput,
    auth: AuthContext,
  ): Promise<ChairmanApplicationDetail>;
  createBeneficiary(
    applicationId: string,
    input: MembershipApplicationBeneficiaryInput & { displayOrder?: number },
    auth: AuthContext,
  ): Promise<ChairmanApplicationBeneficiary>;
  updateBeneficiary(
    beneficiaryId: string,
    input: Partial<MembershipApplicationBeneficiaryInput> & { displayOrder?: number },
    auth: AuthContext,
  ): Promise<ChairmanApplicationBeneficiary>;
  deleteBeneficiary(beneficiaryId: string, auth: AuthContext): Promise<void>;
  storeChairmanDocument(input: {
    applicationId: string;
    document: PublicDocumentUploadInput;
    checksumSha256: string;
    storedFilePath: string;
    auth: AuthContext;
  }): Promise<ChairmanApplicationDocument>;
  deleteDocument(documentId: string, auth: AuthContext): Promise<string>;
  createRequirement(
    applicationId: string,
    input: RequirementInput,
    auth: AuthContext,
  ): Promise<ChairmanApplicationRequirement>;
  updateRequirement(
    requirementId: string,
    input: RequirementUpdateInput,
    auth: AuthContext,
  ): Promise<ChairmanApplicationRequirement>;
  history(applicationId: string): Promise<ChairmanApplicationHistoryEntry[]>;
  transitionStatus(
    applicationId: string,
    nextStatus: MembershipApplicationStatus,
    input: StatusTransitionInput,
    auth: AuthContext,
  ): Promise<ChairmanApplicationDetail>;
  approveApplication(input: {
    applicationId: string;
    approval: ApprovalInput;
    auth: AuthContext;
    settings: MembershipSettings;
    activationTokenHash: string | null;
    activationTokenExpiresAt: Date | null;
    unusablePasswordHash: string | null;
  }): Promise<Omit<ApprovalResult, "activationUrl">>;
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
          WHERE LOWER(TRIM(CONCAT_WS(' ', first_name, NULLIF(middle_name, ''), last_name, NULLIF(suffix, '')))) = LOWER(?)
            AND date_of_birth <=> ?
            AND submitted_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)
            AND (
              contact_number = ?
              OR (? IS NOT NULL AND email = ?)
            )`,
        [
          applicantFullName(input),
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
              requested_membership_type, first_name, middle_name, last_name, suffix, email, contact_number, civil_status,
              place_of_birth, date_of_birth, current_address, barangay, municipality, province,
              father_name, mother_name, spouse_name, occupation,
              orientation_commitment_accepted, membership_fee_commitment_accepted,
              membership_fee_amount, share_subscription_commitment_accepted,
              subscribed_shares, initial_share_capital_amount, target_share_capital_amount,
              share_capital_deadline_months, annual_interest_rate, patronage_refund_acknowledged,
              bylaws_agreement_accepted, privacy_consent_accepted, terms_version,
              applicant_signature_name, signed_at, signed_place, submitted_ip, submitted_user_agent)
           VALUES (?, ?, 'Public Website', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            placeholderCode,
            input.publicTrackingTokenHash,
            application.requestedMembershipType,
            application.firstName,
            nullable(application.middleName),
            application.lastName,
            nullable(application.suffix),
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
                   'A public membership application was submitted.', ?, ?, ?)`,
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
                   ?)`,
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

    async summary() {
      const [rows] = await databasePool().execute<SummaryRow[]>(
        `SELECT COUNT(*) AS total,
                SUM(application_status = 'Submitted') AS submitted,
                SUM(application_status = 'Under Review') AS underReview,
                SUM(application_status = 'Needs Information') AS needsInformation,
                SUM(application_status = 'Approved') AS approved,
                SUM(application_status = 'Rejected') AS rejected,
                SUM(application_status = 'Withdrawn') AS withdrawn
           FROM membership_applications`,
      );
      const row = rows[0];
      return {
        total: Number(row?.total ?? 0),
        submitted: Number(row?.submitted ?? 0),
        underReview: Number(row?.underReview ?? 0),
        needsInformation: Number(row?.needsInformation ?? 0),
        approved: Number(row?.approved ?? 0),
        rejected: Number(row?.rejected ?? 0),
        withdrawn: Number(row?.withdrawn ?? 0),
      };
    },

    async list(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];

      if (query.search) {
        where.push(
          `(a.application_code LIKE ?
            OR ${applicantFullNameSql} LIKE ?
            OR a.first_name LIKE ?
            OR a.middle_name LIKE ?
            OR a.last_name LIKE ?
            OR a.suffix LIKE ?
            OR a.email LIKE ?
            OR a.contact_number LIKE ?)`,
        );
        const search = `%${query.search}%`;
        values.push(search, search, search, search, search, search, search, search);
      }
      if (query.status) {
        where.push("a.application_status = ?");
        values.push(query.status);
      }
      if (query.requestedMembershipType) {
        where.push("a.requested_membership_type = ?");
        values.push(query.requestedMembershipType);
      }
      if (query.applicationSource) {
        where.push("a.application_source = ?");
        values.push(query.applicationSource);
      }
      if (query.barangay) {
        where.push("a.barangay = ?");
        values.push(query.barangay);
      }

      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const orderBy = listSortColumns[query.sortBy];
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<ChairmanApplicationRow[]>(
        `${applicationSelect()}
         ${whereSql}
         ORDER BY ${orderBy} ${orderDirection}, a.membership_application_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM membership_applications a${whereSql}`,
        values,
      );

      return {
        applications: rows.map(mapApplicationListItem),
        total: Number(countRows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async createChairmanApplication(input) {
      return withTransaction(async (connection) => {
        const placeholderCode = `MEM-APP-PENDING-${crypto.randomUUID()}`;
        const application = input.application;
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO membership_applications
             (application_code, public_tracking_token_hash, application_source,
              requested_membership_type, first_name, middle_name, last_name, suffix, email, contact_number, civil_status,
              place_of_birth, date_of_birth, current_address, barangay, municipality, province,
              father_name, mother_name, spouse_name, occupation,
              orientation_commitment_accepted, membership_fee_commitment_accepted,
              membership_fee_amount, share_subscription_commitment_accepted,
              subscribed_shares, initial_share_capital_amount, target_share_capital_amount,
              share_capital_deadline_months, annual_interest_rate, patronage_refund_acknowledged,
              bylaws_agreement_accepted, privacy_consent_accepted, terms_version,
              applicant_signature_name, signed_at, signed_place, submitted_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            placeholderCode,
            input.publicTrackingTokenHash,
            application.applicationSource,
            application.requestedMembershipType,
            application.firstName,
            nullable(application.middleName),
            application.lastName,
            nullable(application.suffix),
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
            input.auth.user.id,
          ],
        );
        const applicationId = String(result.insertId);
        const code = applicationCode(result.insertId);

        await connection.execute(
          `UPDATE membership_applications SET application_code = ? WHERE membership_application_id = ?`,
          [code, applicationId],
        );

        for (const [index, beneficiary] of application.beneficiaries.entries()) {
          await connection.execute(
            `INSERT INTO membership_application_beneficiaries
               (membership_application_id, full_name, relationship, age_at_application, birth_date, display_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              applicationId,
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
            [applicationId, requirementType],
          );
        }

        await connection.execute(
          `INSERT INTO membership_application_status_history
             (membership_application_id, old_status, new_status, internal_note, changed_by)
           VALUES (?, NULL, 'Submitted', 'Application was encoded by the Chairman.', ?)`,
          [applicationId, input.auth.user.id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'membership_application.created', 'membership_applications', ?,
                   'A membership application was encoded by the Chairman.', ?)`,
          [
            input.auth.user.id,
            applicationId,
            JSON.stringify({
              applicationCode: code,
              applicationSource: application.applicationSource,
              requestedMembershipType: application.requestedMembershipType,
            }),
          ],
        );

        const detail = await selectApplicationDetail(connection, applicationId);
        if (!detail) {
          throw new AppError("Membership application was not found", 404, "MEMBERSHIP_APPLICATION_NOT_FOUND");
        }
        return detail;
      }, databasePool());
    },

    findChairmanApplicationById(applicationId) {
      return selectApplicationDetail(databasePool(), applicationId);
    },

    async updateApplication(applicationId, input, auth) {
      const fields: Array<[string, string | number | boolean | null]> = [];
      const fieldMap: Array<
        [
          keyof ChairmanMembershipApplicationUpdateInput,
          string,
          (value: unknown) => string | number | boolean | null,
        ]
      > = [
        ["requestedMembershipType", "requested_membership_type", (value) => value as string],
        ["firstName", "first_name", (value) => value as string],
        ["middleName", "middle_name", (value) => nullable(value as string | null)],
        ["lastName", "last_name", (value) => value as string],
        ["suffix", "suffix", (value) => nullable(value as string | null)],
        ["email", "email", (value) => nullable(value as string | null)],
        ["contactNumber", "contact_number", (value) => value as string],
        ["civilStatus", "civil_status", (value) => nullable(value as string | null)],
        ["placeOfBirth", "place_of_birth", (value) => nullable(value as string | null)],
        ["dateOfBirth", "date_of_birth", (value) => nullable(value as string | null)],
        ["currentAddress", "current_address", (value) => value as string],
        ["barangay", "barangay", (value) => nullable(value as string | null)],
        ["municipality", "municipality", (value) => value as string],
        ["province", "province", (value) => value as string],
        ["fatherName", "father_name", (value) => nullable(value as string | null)],
        ["motherName", "mother_name", (value) => nullable(value as string | null)],
        ["spouseName", "spouse_name", (value) => nullable(value as string | null)],
        ["occupation", "occupation", (value) => nullable(value as string | null)],
        ["orientationCommitmentAccepted", "orientation_commitment_accepted", (value) => Boolean(value)],
        ["membershipFeeCommitmentAccepted", "membership_fee_commitment_accepted", (value) => Boolean(value)],
        ["shareSubscriptionCommitmentAccepted", "share_subscription_commitment_accepted", (value) => Boolean(value)],
        ["patronageRefundAcknowledged", "patronage_refund_acknowledged", (value) => Boolean(value)],
        ["bylawsAgreementAccepted", "bylaws_agreement_accepted", (value) => Boolean(value)],
        ["privacyConsentAccepted", "privacy_consent_accepted", (value) => Boolean(value)],
        ["applicantSignatureName", "applicant_signature_name", (value) => value as string],
        ["signedAt", "signed_at", (value) => mysqlDateTime(value as string)],
        ["signedPlace", "signed_place", (value) => value as string],
        ["boardMeetingDate", "board_meeting_date", (value) => nullable(value as string | null)],
        ["secretaryName", "secretary_name", (value) => nullable(value as string | null)],
        ["decisionReason", "decision_reason", (value) => nullable(value as string | null)],
      ];

      for (const [key, column, mapper] of fieldMap) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
          fields.push([column, mapper(input[key])]);
        }
      }

      return withTransaction(async (connection) => {
        const [existingRows] = await connection.execute<ChairmanApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? LIMIT 1 FOR UPDATE`,
          [applicationId],
        );
        if (!existingRows[0]) {
          throw new AppError("Membership application was not found", 404, "MEMBERSHIP_APPLICATION_NOT_FOUND");
        }

        if (fields.length > 0) {
          await connection.execute(
            `UPDATE membership_applications
                SET ${fields.map(([column]) => `${column} = ?`).join(", ")}
              WHERE membership_application_id = ?`,
            [...fields.map(([, value]) => value), applicationId],
          );
        }

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'membership_application.updated', 'membership_applications', ?,
                   'A membership application was updated.', ?)`,
          [
            auth.user.id,
            applicationId,
            JSON.stringify({ fields: fields.map(([column]) => column) }),
          ],
        );

        const detail = await selectApplicationDetail(connection, applicationId);
        if (!detail) throw new AppError("Membership application was not found", 404, "MEMBERSHIP_APPLICATION_NOT_FOUND");
        return detail;
      }, databasePool());
    },

    async createBeneficiary(applicationId, input, auth) {
      return withTransaction(async (connection) => {
        const [appRows] = await connection.execute<ExistingIdRow[]>(
          `SELECT CAST(membership_application_id AS CHAR) AS id
             FROM membership_applications
            WHERE membership_application_id = ?
            LIMIT 1`,
          [applicationId],
        );
        if (!appRows[0]) throw new AppError("Membership application was not found", 404, "MEMBERSHIP_APPLICATION_NOT_FOUND");

        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO membership_application_beneficiaries
             (membership_application_id, full_name, relationship, age_at_application, birth_date, display_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            applicationId,
            input.fullName,
            nullable(input.relationship),
            nullable(input.ageAtApplication),
            nullable(input.birthDate),
            input.displayOrder ?? 0,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'membership_application.beneficiary_added',
                   'membership_application_beneficiaries', ?,
                   'A membership application beneficiary was added.', ?)`,
          [auth.user.id, String(result.insertId), JSON.stringify({ applicationId })],
        );
        const rows = await selectBeneficiaries(connection, applicationId);
        return rows.find((row) => row.id === String(result.insertId))!;
      }, databasePool());
    },

    async updateBeneficiary(beneficiaryId, input, auth) {
      const fields: Array<[string, string | number | null]> = [];
      const addField = (key: keyof typeof input, column: string, value: string | number | null | undefined) => {
        if (Object.prototype.hasOwnProperty.call(input, key)) fields.push([column, value ?? null]);
      };
      addField("fullName", "full_name", input.fullName);
      addField("relationship", "relationship", input.relationship ?? null);
      addField("ageAtApplication", "age_at_application", input.ageAtApplication ?? null);
      addField("birthDate", "birth_date", input.birthDate ?? null);
      addField("displayOrder", "display_order", input.displayOrder);

      return withTransaction(async (connection) => {
        const [existingRows] = await connection.execute<(RowDataPacket & { applicationId: string })[]>(
          `SELECT CAST(membership_application_id AS CHAR) AS applicationId
             FROM membership_application_beneficiaries
            WHERE membership_application_beneficiary_id = ?
            LIMIT 1`,
          [beneficiaryId],
        );
        const existing = existingRows[0];
        if (!existing) throw new AppError("Beneficiary was not found", 404, "MEMBERSHIP_BENEFICIARY_NOT_FOUND");

        if (fields.length > 0) {
          await connection.execute(
            `UPDATE membership_application_beneficiaries
                SET ${fields.map(([column]) => `${column} = ?`).join(", ")}
              WHERE membership_application_beneficiary_id = ?`,
            [...fields.map(([, value]) => value), beneficiaryId],
          );
        }
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'membership_application.beneficiary_updated',
                   'membership_application_beneficiaries', ?,
                   'A membership application beneficiary was updated.', ?)`,
          [auth.user.id, beneficiaryId, JSON.stringify({ fields: fields.map(([column]) => column) })],
        );
        const rows = await selectBeneficiaries(connection, existing.applicationId);
        return rows.find((row) => row.id === beneficiaryId)!;
      }, databasePool());
    },

    async deleteBeneficiary(beneficiaryId, auth) {
      return withTransaction(async (connection) => {
        const [existingRows] = await connection.execute<ExistingIdRow[]>(
          `SELECT CAST(membership_application_beneficiary_id AS CHAR) AS id
             FROM membership_application_beneficiaries
            WHERE membership_application_beneficiary_id = ?
            LIMIT 1`,
          [beneficiaryId],
        );
        if (!existingRows[0]) throw new AppError("Beneficiary was not found", 404, "MEMBERSHIP_BENEFICIARY_NOT_FOUND");
        await connection.execute(
          `DELETE FROM membership_application_beneficiaries WHERE membership_application_beneficiary_id = ?`,
          [beneficiaryId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description)
           VALUES (?, 'membership_application.beneficiary_removed',
                   'membership_application_beneficiaries', ?,
                   'A membership application beneficiary was removed.')`,
          [auth.user.id, beneficiaryId],
        );
      }, databasePool());
    },

    async storeChairmanDocument(input) {
      return withTransaction(async (connection) => {
        const [appRows] = await connection.execute<ExistingIdRow[]>(
          `SELECT CAST(membership_application_id AS CHAR) AS id
             FROM membership_applications
            WHERE membership_application_id = ?
            LIMIT 1`,
          [input.applicationId],
        );
        if (!appRows[0]) throw new AppError("Membership application was not found", 404, "MEMBERSHIP_APPLICATION_NOT_FOUND");

        const storedPath = path.normalize(input.storedFilePath).replace(/\\/g, "/");
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO membership_application_documents
             (membership_application_id, document_type, original_file_name, stored_file_path,
              mime_type, file_size_bytes, checksum_sha256, uploaded_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.applicationId,
            input.document.documentType,
            input.document.originalFileName,
            storedPath,
            input.document.mimeType,
            input.document.fileSizeBytes,
            input.checksumSha256,
            input.auth.user.id,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'membership_application.document_uploaded',
                   'membership_application_documents', ?,
                   'A Chairman uploaded a membership application document.',
                   ?)`,
          [
            input.auth.user.id,
            String(result.insertId),
            JSON.stringify({
              applicationId: input.applicationId,
              documentType: input.document.documentType,
              originalFileName: input.document.originalFileName,
              fileSizeBytes: input.document.fileSizeBytes,
              checksumSha256: input.checksumSha256,
            }),
          ],
        );
        const documents = await selectDocuments(connection, input.applicationId);
        return documents.find((document) => document.id === String(result.insertId))!;
      }, databasePool());
    },

    async deleteDocument(documentId, auth) {
      return withTransaction(async (connection) => {
        const [rows] = await connection.execute<DocumentRow[]>(
          `SELECT CAST(d.membership_application_document_id AS CHAR) AS id,
                  CAST(d.membership_application_id AS CHAR) AS applicationId,
                  d.document_type AS documentType,
                  d.original_file_name AS originalFileName,
                  d.stored_file_path AS storedFilePath,
                  d.mime_type AS mimeType,
                  d.file_size_bytes AS fileSizeBytes,
                  d.checksum_sha256 AS checksumSha256,
                  CAST(d.uploaded_by_user_id AS CHAR) AS uploadedByUserId,
                  d.uploaded_at AS uploadedAt
             FROM membership_application_documents d
            WHERE d.membership_application_document_id = ?
            LIMIT 1
            FOR UPDATE`,
          [documentId],
        );
        const document = rows[0];
        if (!document?.storedFilePath) throw new AppError("Document was not found", 404, "MEMBERSHIP_DOCUMENT_NOT_FOUND");

        const [referenceRows] = await connection.execute<CountRow[]>(
          `SELECT COUNT(*) AS total
             FROM membership_application_requirements
            WHERE membership_application_document_id = ?
              AND requirement_status = 'Verified'`,
          [documentId],
        );
        if (Number(referenceRows[0]?.total ?? 0) > 0) {
          throw new AppError(
            "Verified requirement documents cannot be deleted",
            409,
            "MEMBERSHIP_DOCUMENT_REFERENCED",
          );
        }

        await connection.execute(
          `DELETE FROM membership_application_documents WHERE membership_application_document_id = ?`,
          [documentId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'membership_application.document_removed',
                   'membership_application_documents', ?,
                   'A membership application document was removed.', ?)`,
          [
            auth.user.id,
            documentId,
            JSON.stringify({
              applicationId: document.applicationId,
              documentType: document.documentType,
              originalFileName: document.originalFileName,
            }),
          ],
        );
        return document.storedFilePath;
      }, databasePool());
    },

    async createRequirement(applicationId, input, auth) {
      return withTransaction(async (connection) => {
        const [appRows] = await connection.execute<ExistingIdRow[]>(
          `SELECT CAST(membership_application_id AS CHAR) AS id
             FROM membership_applications
            WHERE membership_application_id = ?
            LIMIT 1`,
          [applicationId],
        );
        if (!appRows[0]) throw new AppError("Membership application was not found", 404, "MEMBERSHIP_APPLICATION_NOT_FOUND");

        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO membership_application_requirements
             (membership_application_id, requirement_type, requirement_status,
              payment_reference_id, membership_application_document_id,
              completion_date, verified_by, verified_at, remarks)
           VALUES (?, ?, ?, ?, ?, ?,
                   CASE WHEN ? = 'Verified' OR ? = 'Waived' THEN ? ELSE NULL END,
                   CASE WHEN ? = 'Verified' OR ? = 'Waived' THEN UTC_TIMESTAMP() ELSE NULL END,
                   ?)`,
          [
            applicationId,
            input.requirementType,
            input.requirementStatus ?? "Pending",
            nullable(input.paymentReferenceId),
            nullable(input.documentId),
            nullable(input.completionDate),
            input.requirementStatus ?? "Pending",
            input.requirementStatus ?? "Pending",
            auth.user.id,
            input.requirementStatus ?? "Pending",
            input.requirementStatus ?? "Pending",
            nullable(input.remarks),
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'membership_application.requirement_added',
                   'membership_application_requirements', ?,
                   'A membership application requirement was added.', ?)`,
          [auth.user.id, String(result.insertId), JSON.stringify({ applicationId, requirementType: input.requirementType })],
        );
        const requirements = await selectRequirements(connection, applicationId);
        return requirements.find((requirement) => requirement.id === String(result.insertId))!;
      }, databasePool());
    },

    async updateRequirement(requirementId, input, auth) {
      const fields: Array<[string, string | number | null]> = [];
      const has = (key: keyof RequirementUpdateInput) =>
        Object.prototype.hasOwnProperty.call(input, key);
      if (has("requirementStatus")) fields.push(["requirement_status", input.requirementStatus ?? null]);
      if (has("paymentReferenceId")) fields.push(["payment_reference_id", input.paymentReferenceId ?? null]);
      if (has("documentId")) fields.push(["membership_application_document_id", input.documentId ?? null]);
      if (has("completionDate")) fields.push(["completion_date", input.completionDate ?? null]);
      if (has("remarks")) fields.push(["remarks", input.remarks ?? null]);

      return withTransaction(async (connection) => {
        const [existingRows] = await connection.execute<(RowDataPacket & { applicationId: string; status: RequirementStatus })[]>(
          `SELECT CAST(membership_application_id AS CHAR) AS applicationId,
                  requirement_status AS status
             FROM membership_application_requirements
            WHERE membership_application_requirement_id = ?
            LIMIT 1
            FOR UPDATE`,
          [requirementId],
        );
        const existing = existingRows[0];
        if (!existing) throw new AppError("Requirement was not found", 404, "MEMBERSHIP_REQUIREMENT_NOT_FOUND");

        if (fields.length > 0) {
          const statusValue = input.requirementStatus ?? existing.status;
          await connection.execute(
            `UPDATE membership_application_requirements
                SET ${fields.map(([column]) => `${column} = ?`).join(", ")},
                    verified_by = CASE WHEN ? IN ('Verified', 'Waived') THEN ? ELSE verified_by END,
                    verified_at = CASE WHEN ? IN ('Verified', 'Waived') THEN UTC_TIMESTAMP() ELSE verified_at END
              WHERE membership_application_requirement_id = ?`,
            [
              ...fields.map(([, value]) => value),
              statusValue,
              auth.user.id,
              statusValue,
              requirementId,
            ],
          );
        }
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'membership_application.requirement_updated',
                   'membership_application_requirements', ?,
                   'A membership application requirement was updated.',
                   JSON_OBJECT('requirementStatus', ?), ?)`,
          [
            auth.user.id,
            requirementId,
            existing.status,
            JSON.stringify({
              fields: fields.map(([column]) => column),
              requirementStatus: input.requirementStatus,
            }),
          ],
        );
        const requirements = await selectRequirements(connection, existing.applicationId);
        return requirements.find((requirement) => requirement.id === requirementId)!;
      }, databasePool());
    },

    history(applicationId) {
      return selectHistory(databasePool(), applicationId);
    },

    async transitionStatus(applicationId, nextStatus, input, auth) {
      return withTransaction(async (connection) => {
        const [rows] = await connection.execute<ChairmanApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? LIMIT 1 FOR UPDATE`,
          [applicationId],
        );
        const application = rows[0];
        if (!application) throw new AppError("Membership application was not found", 404, "MEMBERSHIP_APPLICATION_NOT_FOUND");

        const allowed = allowedTransitions[application.applicationStatus] ?? [];
        if (!allowed.includes(nextStatus)) {
          throw new AppError(
            "This membership application status transition is not allowed",
            409,
            "MEMBERSHIP_APPLICATION_STATUS_INVALID",
          );
        }
        if (
          ["Needs Information", "Rejected", "Withdrawn"].includes(nextStatus) &&
          !requiredReason(nextStatus, input)
        ) {
          throw new AppError(
            "A reason is required for this status change",
            400,
            "MEMBERSHIP_APPLICATION_REASON_REQUIRED",
          );
        }

        await connection.execute(
          `UPDATE membership_applications
              SET application_status = ?,
                  reviewed_by = ?,
                  reviewed_at = UTC_TIMESTAMP()
            WHERE membership_application_id = ?`,
          [nextStatus, auth.user.id, applicationId],
        );
        await connection.execute(
          `INSERT INTO membership_application_status_history
             (membership_application_id, old_status, new_status, internal_note, applicant_message, changed_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            applicationId,
            application.applicationStatus,
            nextStatus,
            input.internalNote ?? input.reason ?? null,
            input.applicantMessage ?? null,
            auth.user.id,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'membership_application.status_changed',
                   'membership_applications', ?,
                   'A membership application status was changed.',
                   JSON_OBJECT('applicationStatus', ?),
                   JSON_OBJECT('applicationStatus', ?))`,
          [auth.user.id, applicationId, application.applicationStatus, nextStatus],
        );

        const detail = await selectApplicationDetail(connection, applicationId);
        if (!detail) throw new AppError("Membership application was not found", 404, "MEMBERSHIP_APPLICATION_NOT_FOUND");
        return detail;
      }, databasePool());
    },

    async approveApplication(input) {
      return withTransaction(async (connection) => {
        const [rows] = await connection.execute<ChairmanApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? LIMIT 1 FOR UPDATE`,
          [input.applicationId],
        );
        const application = rows[0];
        if (!application) throw new AppError("Membership application was not found", 404, "MEMBERSHIP_APPLICATION_NOT_FOUND");
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

        const missingFields = [
          ["fullName", application.fullName],
          ["contactNumber", application.contactNumber],
          ["currentAddress", application.currentAddress],
          ["municipality", application.municipality],
          ["province", application.province],
          ["applicantSignatureName", application.applicantSignatureName],
          ["signedAt", application.signedAt],
          ["signedPlace", application.signedPlace],
          ["boardMeetingDate", input.approval.boardMeetingDate],
          ["secretaryName", input.approval.secretaryName],
          ["decisionReason", input.approval.decisionReason],
        ].filter(([, value]) => value === null || value === undefined || value === "");
        if (missingFields.length > 0) {
          throw new AppError(
            "The application is missing required approval fields",
            400,
            "MEMBERSHIP_APPLICATION_APPROVAL_INCOMPLETE",
            missingFields.map(([field]) => ({ code: "REQUIRED", field: String(field), message: "This field is required" })),
          );
        }
        const missingCommitments = [
          ["orientationCommitmentAccepted", application.orientationCommitmentAccepted],
          ["membershipFeeCommitmentAccepted", application.membershipFeeCommitmentAccepted],
          ["shareSubscriptionCommitmentAccepted", application.shareSubscriptionCommitmentAccepted],
          ["bylawsAgreementAccepted", application.bylawsAgreementAccepted],
          ["privacyConsentAccepted", application.privacyConsentAccepted],
        ].filter(([, value]) => !value);
        if (missingCommitments.length > 0) {
          throw new AppError(
            "The application has unaccepted required commitments",
            400,
            "MEMBERSHIP_APPLICATION_COMMITMENTS_INCOMPLETE",
          );
        }

        const requirements = await selectRequirements(connection, input.applicationId);
        const requirementByType = new Map(requirements.map((requirement) => [requirement.requirementType, requirement]));
        const requiredTypes: RequirementType[] = [
          "Orientation/Seminar",
          "Associate Membership Fee",
          "Signed Application",
        ];
        if (application.requestedMembershipType === "True Member") {
          requiredTypes.push("Initial Share Capital");
        }
        const incompleteRequirement = requiredTypes.find((requirementType) => {
          const requirement = requirementByType.get(requirementType);
          return !requirement || !["Verified", "Waived"].includes(requirement.requirementStatus);
        });
        if (incompleteRequirement) {
          throw new AppError(
            `The ${incompleteRequirement} requirement is incomplete`,
            409,
            "MEMBERSHIP_APPLICATION_REQUIREMENT_INCOMPLETE",
          );
        }
        if (requirementByType.get("Orientation/Seminar")?.requirementStatus !== "Verified") {
          throw new AppError(
            "Orientation must be verified before approval",
            409,
            "MEMBERSHIP_ORIENTATION_INCOMPLETE",
          );
        }

        const feeRequirement = requirementByType.get("Associate Membership Fee");
        if (feeRequirement?.requirementStatus !== "Waived") {
          const [feeRows] = await connection.execute<PaymentAmountRow[]>(
            `SELECT COALESCE(SUM(pr.amount), 0) AS total
               FROM membership_application_requirements r
               JOIN payment_references pr ON pr.payment_reference_id = r.payment_reference_id
              WHERE r.membership_application_id = ?
                AND r.requirement_type = 'Associate Membership Fee'
                AND r.requirement_status = 'Verified'
                AND pr.payment_purpose = 'Associate Membership Fee'
                AND pr.validation_status = 'Validated'`,
            [input.applicationId],
          );
          const feeTotal = Number(feeRows[0]?.total ?? 0);
          if (feeTotal < input.settings.associateFee) {
            throw new AppError(
              "The PHP 200 associate membership fee has not been validated",
              409,
              "MEMBERSHIP_FEE_INCOMPLETE",
            );
          }
        }

        const [capitalRows] = await connection.execute<PaymentAmountRow[]>(
          `SELECT COALESCE(SUM(pr.amount), 0) AS total
             FROM membership_application_requirements r
             JOIN payment_references pr ON pr.payment_reference_id = r.payment_reference_id
            WHERE r.membership_application_id = ?
              AND r.requirement_type = 'Initial Share Capital'
              AND r.requirement_status = 'Verified'
              AND pr.payment_purpose = 'Share Capital'
              AND pr.validation_status = 'Validated'`,
          [input.applicationId],
        );
        const validatedCapital = Number(capitalRows[0]?.total ?? 0);
        if (validatedCapital > input.settings.maximumShareCapital) {
          throw new AppError(
            "Validated share capital cannot exceed PHP 15,000",
            409,
            "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
          );
        }

        let membershipType: RequestedMembershipType = "Associate";
        let shareCapitalDeadline: string | null = null;
        let trueMemberSince: string | null = null;
        if (application.requestedMembershipType === "True Member") {
          if (validatedCapital < input.settings.initialShareCapital) {
            throw new AppError(
              "At least PHP 1,500 validated initial share capital is required",
              409,
              "INITIAL_SHARE_CAPITAL_INCOMPLETE",
            );
          }
          if (validatedCapital >= input.settings.trueMemberRequiredCapital) {
            membershipType = "True Member";
            trueMemberSince = mysqlDate(new Date());
          } else {
            shareCapitalDeadline = dateMonthsFromNow(input.settings.shareCapitalDeadlineMonths);
          }
        }

        const [duplicateMembers] = await connection.execute<CountRow[]>(
          `SELECT COUNT(*) AS total
             FROM member_profiles
            WHERE (email IS NOT NULL AND ? IS NOT NULL AND email = ?)
               OR (contact_number IS NOT NULL AND contact_number = ? AND LOWER(full_name) = LOWER(?))`,
          [
            nullable(application.email),
            nullable(application.email),
            application.contactNumber,
            application.fullName,
          ],
        );
        if (Number(duplicateMembers[0]?.total ?? 0) > 0) {
          throw new AppError(
            "A matching member profile already exists",
            409,
            "MEMBERSHIP_APPLICATION_MEMBER_CONFLICT",
          );
        }

        let userId: string | null = null;
        let activationTokenExpiresAt: Date | null = null;
        const accountEmail = input.approval.accountEmail ?? application.email;
        if (input.approval.createMemberPortalAccount) {
          if (!accountEmail) {
            throw new AppError(
              "An email address is required to create a member portal account",
              400,
              "MEMBERSHIP_ACCOUNT_EMAIL_REQUIRED",
            );
          }
          const [roleRows] = await connection.execute<RoleRow[]>(
            `SELECT role_id AS roleId FROM roles WHERE role_slug = 'member' AND is_active = 1 LIMIT 1`,
            [],
          );
          const role = roleRows[0];
          if (!role) throw new AppError("The member role is not available", 400, "ROLE_NOT_AVAILABLE");

          const [existingUsers] = await connection.execute<ExistingIdRow[]>(
            `SELECT CAST(user_id AS CHAR) AS id FROM users WHERE email = ? OR (? IS NOT NULL AND username = ?) LIMIT 1`,
            [accountEmail, nullable(input.approval.username), nullable(input.approval.username)],
          );
          if (existingUsers[0]) {
            throw new AppError(
              "A conflicting user account already exists",
              409,
              "MEMBERSHIP_ACCOUNT_CONFLICT",
            );
          }
          if (!input.unusablePasswordHash || !input.activationTokenHash || !input.activationTokenExpiresAt) {
            throw new AppError("Activation token generation failed", 500, "ACTIVATION_TOKEN_FAILED");
          }
          const [userResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO users
               (role_id, username, email, password_hash, display_name, account_status, email_verified_at, created_by)
             VALUES (?, ?, ?, ?, ?, 'Pending', NULL, ?)`,
            [
              role.roleId,
              nullable(input.approval.username),
              accountEmail,
              input.unusablePasswordHash,
              application.fullName,
              input.auth.user.id,
            ],
          );
          userId = String(userResult.insertId);
          activationTokenExpiresAt = input.activationTokenExpiresAt;
          await connection.execute(
            `INSERT INTO user_activation_tokens
               (user_id, token_hash, expires_at, created_by)
             VALUES (?, ?, ?, ?)`,
            [
              userId,
              input.activationTokenHash,
              mysqlDateTime(input.activationTokenExpiresAt),
              input.auth.user.id,
            ],
          );
          await connection.execute(
            `INSERT INTO audit_logs
               (user_id, action, entity_table, record_id, description, new_values)
             VALUES (?, 'activation_token.issued', 'user_activation_tokens', ?,
                     'A member activation token was issued.', ?)`,
            [
              input.auth.user.id,
              userId,
              JSON.stringify({ userId, expiresAt: input.activationTokenExpiresAt.toISOString() }),
            ],
          );
        }

        const [memberResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO member_profiles
             (user_id, member_code, full_name, contact_number, email, barangay, municipality, province,
              membership_type, approval_status, official_member_status, application_date, approved_by,
              approved_at, true_member_since, share_capital_deadline, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved', 'Active', DATE(?), ?,
                   UTC_TIMESTAMP(), ?, ?, ?)`,
          [
            userId,
            `NFFAC-PENDING-${crypto.randomUUID()}`,
            application.fullName,
            application.contactNumber,
            nullable(application.email),
            nullable(application.barangay),
            application.municipality,
            application.province,
            membershipType,
            application.submittedAt,
            input.auth.user.id,
            trueMemberSince,
            shareCapitalDeadline,
            `Converted from membership application ${application.applicationCode}.` +
              (shareCapitalDeadline ? " Pursuing True Member status." : ""),
          ],
        );
        const memberId = String(memberResult.insertId);
        const code = memberCode(memberResult.insertId);
        await connection.execute(
          `UPDATE member_profiles SET member_code = ? WHERE member_id = ?`,
          [code, memberId],
        );
        await connection.execute(
          `INSERT INTO member_status_history
             (member_id, old_membership_type, new_membership_type,
              old_official_status, new_official_status, reason, changed_by)
           VALUES (?, NULL, ?, NULL, 'Active', ?, ?)`,
          [memberId, membershipType, input.approval.decisionReason, input.auth.user.id],
        );
        await connection.execute(
          `UPDATE membership_applications
              SET application_status = 'Approved',
                  reviewed_by = ?,
                  reviewed_at = UTC_TIMESTAMP(),
                  board_meeting_date = ?,
                  secretary_name = ?,
                  decision_reason = ?,
                  converted_member_id = ?
            WHERE membership_application_id = ?`,
          [
            input.auth.user.id,
            input.approval.boardMeetingDate,
            input.approval.secretaryName,
            input.approval.decisionReason,
            memberId,
            input.applicationId,
          ],
        );
        await connection.execute(
          `INSERT INTO membership_application_status_history
             (membership_application_id, old_status, new_status, internal_note, applicant_message, changed_by)
           VALUES (?, 'Under Review', 'Approved', ?, 'Your membership application was approved.', ?)`,
          [input.applicationId, input.approval.decisionReason, input.auth.user.id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'membership_application.approved', 'membership_applications', ?,
                   'A membership application was approved and converted to a member profile.',
                   ?)`,
          [
            input.auth.user.id,
            input.applicationId,
            JSON.stringify({
              applicationCode: application.applicationCode,
              memberId,
              memberCode: code,
              membershipType,
              createMemberPortalAccount: input.approval.createMemberPortalAccount,
            }),
          ],
        );

        return {
          applicationId: input.applicationId,
          applicationCode: application.applicationCode,
          memberId,
          memberCode: code,
          membershipType,
          shareCapitalDeadline,
          activationTokenExpiresAt,
        };
      }, databasePool());
    },
  };
}
