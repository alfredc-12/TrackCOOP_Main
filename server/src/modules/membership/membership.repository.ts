import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { env } from "../../config/env";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { createCentralDocument } from "../../records/central-document";
import { createGeneratedPdfDocument } from "../../records/generated-pdf-document";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  AccountCreationInput,
  ApplicationStatus,
  MembershipApplicationInput,
  MembershipPaymentStatus,
  ReviewAction,
  UploadedApplicationDocument,
} from "./membership.types";
import { membershipRules, validStatusTransitions } from "./membership.types";

type ApplicationRow = RowDataPacket & {
  id: string;
  reference: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  fullName: string;
  contactNumber: string;
  email: string;
  preferredContactMethod: string;
  completeAddress: string;
  barangay: string;
  municipality: string;
  province: string;
  sector: string;
  livelihood: string;
  applicantClassification: string;
  primaryActivity: string;
  preferredMembershipType: string;
  approvedMembershipType: string | null;
  status: ApplicationStatus;
  paymentStatus: MembershipPaymentStatus;
  requiredPaymentType: string | null;
  requiredPaymentAmount: string | null;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  publicResponse: string | null;
  internalNote: string | null;
  possibleDuplicate: number;
  linkedMemberId: string | null;
  submittedAt: string;
  updatedAt: string;
  accountCreatedAt: string | null;
};

type PaymentRow = RowDataPacket & {
  id: string;
  applicationId: string;
  applicationReference: string;
  applicantName: string;
  memberId: string | null;
  approvedMembershipType: string;
  paymentReferenceId: string;
  referenceNumber: string;
  provider: string;
  amount: string;
  proofFilePath: string | null;
  paymentStatus: MembershipPaymentStatus;
  submittedAt: string;
  receiptNumber: string | null;
};

type CountRow = RowDataPacket & { total: number };
type IdRow = RowDataPacket & { id: string };

function normalizeContact(value: string) {
  return value.replace(/\D/g, "");
}

function applicationSelect() {
  return `SELECT CAST(a.membership_application_id AS CHAR) AS id,
                 a.application_reference AS reference,
                 a.first_name AS firstName,
                 a.middle_name AS middleName,
                 a.last_name AS lastName,
                 a.suffix,
                 TRIM(CONCAT(a.first_name, ' ', COALESCE(CONCAT(a.middle_name, ' '), ''), a.last_name, COALESCE(CONCAT(' ', a.suffix), ''))) AS fullName,
                 a.contact_number AS contactNumber,
                 a.email,
                 a.preferred_contact_method AS preferredContactMethod,
                 a.complete_address AS completeAddress,
                 a.barangay,
                 a.municipality,
                 a.province,
                 a.sector,
                 a.livelihood,
                 a.applicant_classification AS applicantClassification,
                 a.primary_activity AS primaryActivity,
                 a.preferred_membership_type AS preferredMembershipType,
                 a.approved_membership_type AS approvedMembershipType,
                 a.application_status AS status,
                 a.payment_status AS paymentStatus,
                 a.required_payment_type AS requiredPaymentType,
                 CAST(a.required_payment_amount AS CHAR) AS requiredPaymentAmount,
                 CAST(a.assigned_reviewer_id AS CHAR) AS assignedReviewerId,
                 reviewer.display_name AS assignedReviewerName,
                 a.public_response AS publicResponse,
                 a.internal_note AS internalNote,
                 a.possible_duplicate AS possibleDuplicate,
                 CAST(a.linked_member_id AS CHAR) AS linkedMemberId,
                 a.submitted_at AS submittedAt,
                 a.updated_at AS updatedAt,
                 a.account_created_at AS accountCreatedAt
            FROM membership_applications a
            LEFT JOIN users reviewer ON reviewer.user_id = a.assigned_reviewer_id`;
}

function paymentSelect() {
  return `SELECT CAST(mp.membership_application_payment_id AS CHAR) AS id,
                 CAST(a.membership_application_id AS CHAR) AS applicationId,
                 a.application_reference AS applicationReference,
                 TRIM(CONCAT(a.first_name, ' ', a.last_name)) AS applicantName,
                 CAST(a.linked_member_id AS CHAR) AS memberId,
                 a.approved_membership_type AS approvedMembershipType,
                 CAST(p.payment_reference_id AS CHAR) AS paymentReferenceId,
                 p.reference_number AS referenceNumber,
                 p.provider,
                 CAST(p.amount AS CHAR) AS amount,
                 p.proof_file_path AS proofFilePath,
                 mp.payment_status AS paymentStatus,
                 p.submitted_at AS submittedAt,
                 mp.receipt_number AS receiptNumber
            FROM membership_application_payments mp
            JOIN membership_applications a
              ON a.membership_application_id = mp.membership_application_id
            JOIN payment_references p
              ON p.payment_reference_id = mp.payment_reference_id`;
}

function assertTransition(current: ApplicationStatus, next: ApplicationStatus) {
  if (!validStatusTransitions[current].includes(next)) {
    throw new AppError(
      `Application cannot move from ${current} to ${next}`,
      409,
      "INVALID_MEMBERSHIP_STATUS_TRANSITION",
    );
  }
}

async function addHistory(
  connection: PoolConnection,
  applicationId: string,
  oldStatus: ApplicationStatus | null,
  newStatus: ApplicationStatus,
  actorId: string | null,
  publicMessage?: string | null,
  internalReason?: string | null,
) {
  await connection.execute(
    `INSERT INTO membership_application_status_history
       (membership_application_id, old_status, new_status, public_message, internal_reason, changed_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      applicationId,
      oldStatus,
      newStatus,
      publicMessage ?? null,
      internalReason ?? null,
      actorId,
    ],
  );
}

async function addAudit(
  connection: PoolConnection,
  actorId: string | null,
  action: string,
  recordId: string,
  description: string,
  values?: Record<string, unknown>,
) {
  await connection.execute(
    `INSERT INTO audit_logs
       (user_id, action, entity_table, record_id, description, new_values)
     VALUES (?, ?, 'membership_applications', ?, ?, ?)`,
    [
      actorId,
      action,
      recordId,
      description,
      values ? JSON.stringify(values) : null,
    ],
  );
}

async function notifyRole(
  connection: PoolConnection,
  role: "chairman" | "bookkeeper",
  title: string,
  message: string,
  applicationId: string,
) {
  await connection.execute(
    `INSERT INTO notifications
       (user_id, notification_type, title, message, related_entity_type, related_entity_id)
     SELECT u.user_id, 'System', ?, ?, 'membership_application', ?
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug = ? AND u.account_status = 'Active'`,
    [title, message, applicationId, role],
  );
}

export interface MembershipRepository {
  submit(
    input: MembershipApplicationInput,
    documents: UploadedApplicationDocument[],
  ): Promise<ApplicationRow>;
  lookup(
    reference: string,
    contactNumber: string,
  ): Promise<Record<string, unknown> | null>;
  submitAdditionalInformation(
    reference: string,
    contactNumber: string,
    information: string,
    documents: UploadedApplicationDocument[],
  ): Promise<ApplicationRow>;
  list(status?: ApplicationStatus, search?: string): Promise<ApplicationRow[]>;
  detail(id: string): Promise<Record<string, unknown> | null>;
  getApplicationDocument(
    applicationId: string,
    documentId: string,
  ): Promise<{ filePath: string; fileName: string; mimeType: string } | null>;
  review(
    id: string,
    input: ReviewAction,
    auth: AuthContext,
  ): Promise<ApplicationRow>;
  submitPayment(
    reference: string,
    contactNumber: string,
    payment: {
      provider: string;
      referenceNumber: string;
      amount: number;
      proofFilePath: string;
      notes?: string;
    },
  ): Promise<PaymentRow>;
  listPayments(): Promise<PaymentRow[]>;
  getPaymentProof(
    paymentId: string,
  ): Promise<{ filePath: string; fileName: string; mimeType: string } | null>;
  validatePayment(
    id: string,
    decision: "VERIFIED" | "REJECTED" | "NEEDS_CLARIFICATION",
    note: string,
    auth: AuthContext,
  ): Promise<PaymentRow>;
  createAccount(
    applicationId: string,
    input: AccountCreationInput,
    auth: AuthContext,
  ): Promise<{
    application: ApplicationRow;
    activationToken: string;
    expiresAt: string;
  }>;
  activate(token: string, password: string): Promise<void>;
}

export function createMembershipRepository(
  databasePool: Pool = getPool(),
): MembershipRepository {
  async function findApplicationById(id: string) {
    const [rows] = await databasePool.execute<ApplicationRow[]>(
      `${applicationSelect()} WHERE a.membership_application_id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  return {
    async submit(input, documents) {
      return withTransaction(async (connection) => {
        const contact = normalizeContact(input.contactNumber);
        const [duplicateApplications] = await connection.execute<CountRow[]>(
          `SELECT COUNT(*) AS total
             FROM membership_applications
            WHERE archived_at IS NULL
              AND application_status NOT IN ('REJECTED', 'WITHDRAWN', 'CANCELLED')
              AND (contact_number_normalized = ? OR email = ?)`,
          [contact, input.email],
        );
        const [duplicateMembers] = await connection.execute<CountRow[]>(
          `SELECT COUNT(*) AS total
             FROM member_profiles
            WHERE REPLACE(REPLACE(REPLACE(REPLACE(contact_number, '+', ''), '-', ''), ' ', ''), '(', '') LIKE ?
               OR email = ?`,
          [`%${contact.slice(-10)}`, input.email],
        );
        const possibleDuplicate =
          Number(duplicateApplications[0]?.total ?? 0) > 0 ||
          Number(duplicateMembers[0]?.total ?? 0) > 0;
        const temporaryReference = input.idempotencyKey;

        let result: ResultSetHeader;
        try {
          [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO membership_applications
               (application_reference, idempotency_key, first_name, middle_name, last_name, suffix,
                contact_number, contact_number_normalized, email, preferred_contact_method,
                complete_address, barangay, municipality, province, sector, livelihood,
                applicant_classification, primary_activity, preferred_membership_type,
                possible_duplicate, consent_accepted, consent_accepted_at, privacy_notice_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, UTC_TIMESTAMP(), ?)`,
            [
              temporaryReference,
              input.idempotencyKey,
              input.firstName,
              input.middleName ?? null,
              input.lastName,
              input.suffix ?? null,
              input.contactNumber,
              contact,
              input.email.toLowerCase(),
              input.preferredContactMethod,
              input.completeAddress,
              input.barangay,
              input.municipality,
              input.province,
              input.sector,
              input.livelihood,
              input.applicantClassification,
              input.primaryActivity,
              input.preferredMembershipType,
              possibleDuplicate ? 1 : 0,
              input.privacyNoticeVersion,
            ],
          );
        } catch (error) {
          if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ER_DUP_ENTRY"
          ) {
            const [existing] = await connection.execute<ApplicationRow[]>(
              `${applicationSelect()} WHERE a.idempotency_key = ? LIMIT 1`,
              [input.idempotencyKey],
            );
            if (existing[0]) return existing[0];
          }
          throw error;
        }

        const applicationId = String(result.insertId);
        const year = new Date().getUTCFullYear();
        const reference = `MEM-APP-${year}-${applicationId.padStart(4, "0")}`;
        await connection.execute(
          `UPDATE membership_applications
              SET application_reference = ?
            WHERE membership_application_id = ?`,
          [reference, applicationId],
        );

        for (const document of documents) {
          await connection.execute(
            `INSERT INTO membership_application_documents
               (membership_application_id, document_type, original_file_name, stored_file_path,
                mime_type, file_size_bytes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              applicationId,
              document.documentType,
              document.originalFileName,
              document.storedFilePath,
              document.mimeType,
              document.fileSizeBytes,
            ],
          );
          await createCentralDocument(connection, {
            uploadedBy: null,
            title: `${reference} – ${document.documentType}`,
            description: "Protected attachment submitted with a membership application.",
            category: "MEMBERSHIP",
            documentType: "Other",
            accessLevel: "Admin-only",
            storagePath: document.storedFilePath,
            originalFileName: document.originalFileName,
            mimeType: document.mimeType,
            fileSizeBytes: document.fileSizeBytes,
            relatedModule: "MEMBERSHIP_APPLICATION",
            relatedRecordId: applicationId,
            relatedRecordReference: reference,
            relationshipType: "APPLICATION_ATTACHMENT",
          });
        }

        await addHistory(connection, applicationId, null, "SUBMITTED", null);
        await addAudit(
          connection,
          null,
          "membership.application_submitted",
          applicationId,
          "A public membership application was submitted.",
          { reference, possibleDuplicate },
        );
        await notifyRole(
          connection,
          "chairman",
          "New membership application",
          `${reference} is ready for review.`,
          applicationId,
        );

        const [rows] = await connection.execute<ApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? LIMIT 1`,
          [applicationId],
        );
        return rows[0];
      }, databasePool);
    },

    async lookup(reference, contactNumber) {
      const [rows] = await databasePool.execute<ApplicationRow[]>(
        `${applicationSelect()}
          WHERE a.application_reference = ?
            AND a.contact_number_normalized = ?
          LIMIT 1`,
        [reference, normalizeContact(contactNumber)],
      );
      const application = rows[0];
      if (!application) return null;
      const maskedName = `${application.firstName.slice(0, 1)}${"*".repeat(
        Math.max(1, application.firstName.length - 1),
      )} ${application.lastName.slice(0, 1)}.`;
      return {
        reference: application.reference,
        applicantName: maskedName,
        submittedAt: application.submittedAt,
        status: application.status,
        preferredMembershipType: application.preferredMembershipType,
        approvedMembershipType: application.approvedMembershipType,
        publicResponse: application.publicResponse,
        paymentStatus: application.paymentStatus,
        requiredPaymentType: application.requiredPaymentType,
        requiredPaymentAmount: application.requiredPaymentAmount,
        updatedAt: application.updatedAt,
      };
    },

    async submitAdditionalInformation(
      reference,
      contactNumber,
      information,
      documents,
    ) {
      return withTransaction(async (connection) => {
        const [rows] = await connection.execute<ApplicationRow[]>(
          `${applicationSelect()}
            WHERE a.application_reference = ?
              AND a.contact_number_normalized = ?
            FOR UPDATE`,
          [reference, normalizeContact(contactNumber)],
        );
        const application = rows[0];
        if (!application) {
          throw new AppError(
            "Application verification failed",
            404,
            "APPLICATION_NOT_FOUND",
          );
        }
        if (application.status !== "NEEDS_INFORMATION") {
          throw new AppError(
            "This application is not accepting additional information",
            409,
            "ADDITIONAL_INFORMATION_NOT_ALLOWED",
          );
        }
        await connection.execute(
          `INSERT INTO membership_application_notes
             (membership_application_id, note_type, note_text)
           VALUES (?, 'ADDITIONAL_INFORMATION', ?)`,
          [application.id, information],
        );
        for (const document of documents) {
          await connection.execute(
            `INSERT INTO membership_application_documents
               (membership_application_id, document_type, original_file_name, stored_file_path,
                mime_type, file_size_bytes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              application.id,
              document.documentType,
              document.originalFileName,
              document.storedFilePath,
              document.mimeType,
              document.fileSizeBytes,
            ],
          );
          await createCentralDocument(connection, {
            uploadedBy: null,
            title: `${application.reference} – ${document.documentType}`,
            description: "Protected additional-information attachment submitted for membership review.",
            category: "MEMBERSHIP",
            documentType: "Other",
            accessLevel: "Admin-only",
            storagePath: document.storedFilePath,
            originalFileName: document.originalFileName,
            mimeType: document.mimeType,
            fileSizeBytes: document.fileSizeBytes,
            relatedModule: "MEMBERSHIP_APPLICATION",
            relatedRecordId: application.id,
            relatedRecordReference: application.reference,
            relationshipType: "ADDITIONAL_INFORMATION_ATTACHMENT",
          });
        }
        assertTransition(application.status, "UNDER_REVIEW");
        await connection.execute(
          `UPDATE membership_applications
              SET application_status = 'UNDER_REVIEW'
            WHERE membership_application_id = ?`,
          [application.id],
        );
        await addHistory(
          connection,
          application.id,
          application.status,
          "UNDER_REVIEW",
          null,
          "Additional information submitted.",
        );
        await addAudit(
          connection,
          null,
          "membership.additional_information_submitted",
          application.id,
          "The applicant submitted requested information.",
        );
        await notifyRole(
          connection,
          "chairman",
          "Membership information received",
          `${application.reference} returned to review.`,
          application.id,
        );
        const [updated] = await connection.execute<ApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? LIMIT 1`,
          [application.id],
        );
        return updated[0];
      }, databasePool);
    },

    async list(status, search) {
      const where: string[] = ["a.archived_at IS NULL"];
      const values: string[] = [];
      if (status) {
        where.push("a.application_status = ?");
        values.push(status);
      }
      if (search) {
        where.push(
          "(a.application_reference LIKE ? OR a.first_name LIKE ? OR a.last_name LIKE ? OR a.contact_number LIKE ?)",
        );
        const pattern = `%${search}%`;
        values.push(pattern, pattern, pattern, pattern);
      }
      const [rows] = await databasePool.execute<ApplicationRow[]>(
        `${applicationSelect()}
          WHERE ${where.join(" AND ")}
          ORDER BY a.submitted_at DESC`,
        values,
      );
      return rows;
    },

    async detail(id) {
      const application = await findApplicationById(id);
      if (!application) return null;
      const [documents] = await databasePool.execute<RowDataPacket[]>(
        `SELECT CAST(membership_application_document_id AS CHAR) AS id,
                document_type AS documentType,
                original_file_name AS originalFileName,
                mime_type AS mimeType,
                file_size_bytes AS fileSizeBytes,
                verification_status AS verificationStatus,
                reviewer_note AS reviewerNote,
                uploaded_at AS uploadedAt
           FROM membership_application_documents
          WHERE membership_application_id = ?
          ORDER BY uploaded_at`,
        [id],
      );
      const [history] = await databasePool.execute<RowDataPacket[]>(
        `SELECT old_status AS oldStatus, new_status AS newStatus,
                public_message AS publicMessage, internal_reason AS internalReason,
                changed_at AS changedAt
           FROM membership_application_status_history
          WHERE membership_application_id = ?
          ORDER BY changed_at`,
        [id],
      );
      const [notes] = await databasePool.execute<RowDataPacket[]>(
        `SELECT note_type AS noteType, note_text AS noteText, created_at AS createdAt
           FROM membership_application_notes
          WHERE membership_application_id = ?
          ORDER BY created_at`,
        [id],
      );
      return { ...application, documents, history, notes };
    },

    async getApplicationDocument(applicationId, documentId) {
      const [rows] = await databasePool.execute<
        (RowDataPacket & {
          filePath: string;
          fileName: string;
          mimeType: string;
        })[]
      >(
        `SELECT stored_file_path AS filePath,
                original_file_name AS fileName,
                mime_type AS mimeType
           FROM membership_application_documents
          WHERE membership_application_id = ?
            AND membership_application_document_id = ?
          LIMIT 1`,
        [applicationId, documentId],
      );
      return rows[0] ?? null;
    },

    async review(id, input, auth) {
      return withTransaction(async (connection) => {
        const [rows] = await connection.execute<ApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? FOR UPDATE`,
          [id],
        );
        const application = rows[0];
        if (!application) {
          throw new AppError(
            "Membership application was not found",
            404,
            "APPLICATION_NOT_FOUND",
          );
        }

        let nextStatus: ApplicationStatus;
        let requiredPaymentType: string | null =
          application.requiredPaymentType;
        let requiredPaymentAmount: number | null =
          application.requiredPaymentAmount
            ? Number(application.requiredPaymentAmount)
            : null;
        let approvedMembershipType = application.approvedMembershipType;

        switch (input.action) {
          case "START_REVIEW":
            nextStatus = "UNDER_REVIEW";
            break;
          case "REQUEST_INFORMATION":
            nextStatus = "NEEDS_INFORMATION";
            break;
          case "PLACE_ON_HOLD":
            nextStatus = "ON_HOLD";
            break;
          case "APPROVE":
            nextStatus = "APPROVED_PENDING_PAYMENT";
            approvedMembershipType = input.approvedMembershipType;
            requiredPaymentType =
              input.approvedMembershipType === "ASSOCIATE"
                ? "Associate Membership Fee"
                : "Initial Share Capital";
            requiredPaymentAmount =
              input.approvedMembershipType === "ASSOCIATE"
                ? membershipRules.associateFee
                : membershipRules.trueMemberInitialPayment;
            break;
          case "REJECT":
            nextStatus = "REJECTED";
            break;
        }
        assertTransition(application.status, nextStatus);
        const publicMessage = input.publicMessage ?? application.publicResponse;
        const internalNote = input.internalNote ?? application.internalNote;

        await connection.execute(
          `UPDATE membership_applications
              SET application_status = ?,
                  assigned_reviewer_id = COALESCE(assigned_reviewer_id, ?),
                  reviewed_at = COALESCE(reviewed_at, UTC_TIMESTAMP()),
                  approved_membership_type = ?,
                  required_payment_type = ?,
                  required_payment_amount = ?,
                  public_response = ?,
                  internal_note = ?,
                  approved_by = CASE WHEN ? = 'APPROVE' THEN ? ELSE approved_by END,
                  approved_at = CASE WHEN ? = 'APPROVE' THEN UTC_TIMESTAMP() ELSE approved_at END,
                  rejected_by = CASE WHEN ? = 'REJECT' THEN ? ELSE rejected_by END,
                  rejected_at = CASE WHEN ? = 'REJECT' THEN UTC_TIMESTAMP() ELSE rejected_at END
            WHERE membership_application_id = ?`,
          [
            nextStatus,
            auth.user.id,
            approvedMembershipType,
            requiredPaymentType,
            requiredPaymentAmount,
            publicMessage,
            internalNote,
            input.action,
            auth.user.id,
            input.action,
            input.action,
            auth.user.id,
            input.action,
            id,
          ],
        );
        if (publicMessage) {
          await connection.execute(
            `INSERT INTO membership_application_notes
               (membership_application_id, note_type, note_text, created_by)
             VALUES (?, 'PUBLIC_RESPONSE', ?, ?)`,
            [id, publicMessage, auth.user.id],
          );
        }
        if (internalNote) {
          await connection.execute(
            `INSERT INTO membership_application_notes
               (membership_application_id, note_type, note_text, created_by)
             VALUES (?, 'INTERNAL_NOTE', ?, ?)`,
            [id, internalNote, auth.user.id],
          );
        }
        await addHistory(
          connection,
          id,
          application.status,
          nextStatus,
          auth.user.id,
          publicMessage,
          internalNote,
        );
        await addAudit(
          connection,
          auth.user.id,
          `membership.${input.action.toLowerCase()}`,
          id,
          `Membership review action ${input.action} was completed.`,
          { from: application.status, to: nextStatus, approvedMembershipType },
        );
        if (input.action === "APPROVE") {
          await notifyRole(
            connection,
            "bookkeeper",
            "Membership payment required",
            `${application.reference} is approved pending payment.`,
            id,
          );
        }
        const [updated] = await connection.execute<ApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? LIMIT 1`,
          [id],
        );
        return updated[0];
      }, databasePool);
    },

    async submitPayment(reference, contactNumber, payment) {
      return withTransaction(async (connection) => {
        const [applications] = await connection.execute<ApplicationRow[]>(
          `${applicationSelect()}
            WHERE a.application_reference = ?
              AND a.contact_number_normalized = ?
            FOR UPDATE`,
          [reference, normalizeContact(contactNumber)],
        );
        const application = applications[0];
        if (!application) {
          throw new AppError(
            "Application verification failed",
            404,
            "APPLICATION_NOT_FOUND",
          );
        }
        if (
          !["APPROVED_PENDING_PAYMENT", "PAYMENT_UNDER_REVIEW"].includes(
            application.status,
          )
        ) {
          throw new AppError(
            "Payment is not currently requested",
            409,
            "PAYMENT_NOT_ALLOWED",
          );
        }
        if (application.paymentStatus === "VERIFIED") {
          throw new AppError(
            "Payment has already been verified",
            409,
            "PAYMENT_ALREADY_VERIFIED",
          );
        }
        if (Number(application.requiredPaymentAmount) !== payment.amount) {
          throw new AppError(
            `The required payment amount is ${application.requiredPaymentAmount}`,
            422,
            "INCORRECT_PAYMENT_AMOUNT",
          );
        }
        const purpose =
          application.approvedMembershipType === "ASSOCIATE"
            ? "Associate Membership Fee"
            : "Share Capital";
        const [paymentResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO payment_references
             (payer_name, payer_email, payer_contact, provider, reference_number,
              payment_purpose, related_entity_type, related_entity_id, amount,
              proof_file_path, notes)
           VALUES (?, ?, ?, ?, ?, ?, 'membership_application', ?, ?, ?, ?)`,
          [
            application.fullName,
            application.email,
            application.contactNumber,
            payment.provider,
            payment.referenceNumber,
            purpose,
            application.id,
            payment.amount,
            payment.proofFilePath,
            payment.notes ?? null,
          ],
        );
        const paymentReferenceId = String(paymentResult.insertId);
        await createCentralDocument(connection, {
          uploadedBy: null,
          title: `${application.reference} – Payment Proof`,
          description: "Protected payment proof submitted for membership validation.",
          category: "FINANCIAL",
          documentType: "Financial Document",
          accessLevel: "Bookkeeper-only",
          storagePath: payment.proofFilePath,
          relatedModule: "PAYMENT",
          relatedRecordId: paymentReferenceId,
          relatedRecordReference: application.reference,
          relationshipType: "PAYMENT_PROOF",
        });
        const [linkResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO membership_application_payments
             (membership_application_id, payment_reference_id, payment_status)
           VALUES (?, ?, 'PENDING')`,
          [application.id, paymentReferenceId],
        );
        assertTransition(application.status, "PAYMENT_UNDER_REVIEW");
        await connection.execute(
          `UPDATE membership_applications
              SET application_status = 'PAYMENT_UNDER_REVIEW',
                  payment_status = 'PENDING'
            WHERE membership_application_id = ?`,
          [application.id],
        );
        await addHistory(
          connection,
          application.id,
          application.status,
          "PAYMENT_UNDER_REVIEW",
          null,
          "Payment proof submitted.",
        );
        await addAudit(
          connection,
          null,
          "membership.payment_proof_submitted",
          application.id,
          "The applicant submitted payment proof.",
          { paymentReferenceId },
        );
        await notifyRole(
          connection,
          "bookkeeper",
          "Membership payment proof submitted",
          `${application.reference} has payment proof ready for validation.`,
          application.id,
        );
        const [payments] = await connection.execute<PaymentRow[]>(
          `${paymentSelect()} WHERE mp.membership_application_payment_id = ?`,
          [String(linkResult.insertId)],
        );
        return payments[0];
      }, databasePool);
    },

    async listPayments() {
      const [rows] = await databasePool.execute<PaymentRow[]>(
        `${paymentSelect()} ORDER BY p.submitted_at DESC`,
      );
      return rows;
    },

    async getPaymentProof(paymentId) {
      const [rows] = await databasePool.execute<
        (RowDataPacket & {
          filePath: string;
          fileName: string;
          mimeType: string;
        })[]
      >(
        `SELECT p.proof_file_path AS filePath,
                CONCAT('membership-payment-', mp.membership_application_payment_id) AS fileName,
                CASE
                  WHEN p.proof_file_path LIKE '%.pdf' THEN 'application/pdf'
                  WHEN p.proof_file_path LIKE '%.png' THEN 'image/png'
                  ELSE 'image/jpeg'
                END AS mimeType
           FROM membership_application_payments mp
           JOIN payment_references p ON p.payment_reference_id = mp.payment_reference_id
          WHERE mp.membership_application_payment_id = ?
            AND p.proof_file_path IS NOT NULL
          LIMIT 1`,
        [paymentId],
      );
      return rows[0] ?? null;
    },

    async validatePayment(id, decision, note, auth) {
      return withTransaction(async (connection) => {
        const [rows] = await connection.execute<PaymentRow[]>(
          `${paymentSelect()} WHERE mp.membership_application_payment_id = ? FOR UPDATE`,
          [id],
        );
        const payment = rows[0];
        if (!payment) {
          throw new AppError(
            "Membership payment was not found",
            404,
            "PAYMENT_NOT_FOUND",
          );
        }
        if (payment.paymentStatus === "VERIFIED") {
          throw new AppError(
            "Payment has already been verified",
            409,
            "PAYMENT_ALREADY_VERIFIED",
          );
        }
        const nextApplicationStatus: ApplicationStatus =
          decision === "VERIFIED" ? "APPROVED" : "APPROVED_PENDING_PAYMENT";
        const receiptNumber =
          decision === "VERIFIED"
            ? `MEM-RCP-${new Date().getUTCFullYear()}-${payment.paymentReferenceId.padStart(6, "0")}`
            : null;
        await connection.execute(
          `UPDATE membership_application_payments
              SET payment_status = ?,
                  receipt_number = CASE WHEN ? = 'VERIFIED' THEN COALESCE(receipt_number, ?) ELSE receipt_number END,
                  validated_by = ?,
                  validated_at = UTC_TIMESTAMP()
            WHERE membership_application_payment_id = ?`,
          [decision, decision, receiptNumber, auth.user.id, id],
        );
        const referenceStatus =
          decision === "VERIFIED"
            ? "Validated"
            : decision === "REJECTED"
              ? "Rejected"
              : "Needs Clarification";
        await connection.execute(
          `UPDATE payment_references
              SET validation_status = ?, validated_by = ?, validated_at = UTC_TIMESTAMP(),
                  rejection_reason = CASE WHEN ? <> 'Validated' THEN ? ELSE NULL END
            WHERE payment_reference_id = ?`,
          [
            referenceStatus,
            auth.user.id,
            referenceStatus,
            note,
            payment.paymentReferenceId,
          ],
        );
        const [applications] = await connection.execute<ApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? FOR UPDATE`,
          [payment.applicationId],
        );
        const application = applications[0];
        assertTransition(application.status, nextApplicationStatus);
        await connection.execute(
          `UPDATE membership_applications
              SET application_status = ?, payment_status = ?
            WHERE membership_application_id = ?`,
          [nextApplicationStatus, decision, payment.applicationId],
        );
        if (decision === "VERIFIED") {
          const [categories] = await connection.execute<IdRow[]>(
            `SELECT CAST(financial_category_id AS CHAR) AS id
               FROM financial_categories
              WHERE category_code IN ('membership_fee', 'share_capital')
              ORDER BY category_code = 'membership_fee' DESC
              LIMIT 1`,
          );
          if (categories[0]) {
            await connection.execute(
              `INSERT IGNORE INTO financial_records
                 (record_number, payment_reference_id, financial_category_id, recorded_by,
                  approved_by, record_type, source_module, source_record_id, amount,
                  record_date, remarks)
               VALUES (?, ?, ?, ?, ?, 'Income', 'Membership', ?, ?, UTC_DATE(), ?)`,
              [
                `MEM-FIN-${payment.paymentReferenceId}`,
                payment.paymentReferenceId,
                categories[0].id,
                auth.user.id,
                auth.user.id,
                payment.paymentReferenceId,
                payment.amount,
                `Membership payment ${receiptNumber}`,
              ],
            );
          }
          await createGeneratedPdfDocument(connection, {
            uploadedBy: auth.user.id,
            uploaderRole: auth.user.role,
            memberId: payment.memberId,
            title: `Membership Receipt ${receiptNumber}`,
            description:
              "System-generated receipt for a validated membership payment.",
            category: "RECEIPT",
            documentType: "Receipt",
            accessLevel: payment.memberId ? "Member-only" : "Bookkeeper-only",
            relatedModule: "PAYMENT",
            relatedRecordId: payment.paymentReferenceId,
            relatedRecordReference: receiptNumber,
            relationshipType: "SYSTEM_RECEIPT",
            fileBaseName: receiptNumber ?? `membership-receipt-${id}`,
            heading: "Membership Payment Receipt",
            lines: [
              { label: "Receipt number", value: receiptNumber },
              { label: "Application", value: payment.applicationReference },
              { label: "Applicant", value: payment.applicantName },
              {
                label: "Membership type",
                value: payment.approvedMembershipType,
              },
              { label: "Amount paid", value: `PHP ${payment.amount}` },
              { label: "Payment provider", value: payment.provider },
              { label: "Payment reference", value: payment.referenceNumber },
              { label: "Validation status", value: "Validated" },
            ],
          });
        }
        await addHistory(
          connection,
          payment.applicationId,
          application.status,
          nextApplicationStatus,
          auth.user.id,
          decision === "VERIFIED" ? "Payment verified." : note,
          note,
        );
        await addAudit(
          connection,
          auth.user.id,
          `membership.payment_${decision.toLowerCase()}`,
          payment.applicationId,
          `Membership payment was marked ${decision}.`,
          { paymentId: id, receiptNumber },
        );
        await notifyRole(
          connection,
          "chairman",
          "Membership payment updated",
          `${payment.applicationReference} payment was marked ${decision}.`,
          payment.applicationId,
        );
        const [updated] = await connection.execute<PaymentRow[]>(
          `${paymentSelect()} WHERE mp.membership_application_payment_id = ?`,
          [id],
        );
        return updated[0];
      }, databasePool);
    },

    async createAccount(applicationId, input, auth) {
      const activationToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256")
        .update(activationToken)
        .digest("hex");
      const temporaryPassword = randomBytes(48).toString("base64url");
      const passwordHash = await bcrypt.hash(
        temporaryPassword,
        env.BCRYPT_ROUNDS,
      );
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      const application = await withTransaction(async (connection) => {
        const [rows] = await connection.execute<ApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? FOR UPDATE`,
          [applicationId],
        );
        const current = rows[0];
        if (!current) {
          throw new AppError(
            "Membership application was not found",
            404,
            "APPLICATION_NOT_FOUND",
          );
        }
        if (
          current.status !== "APPROVED" ||
          current.paymentStatus !== "VERIFIED"
        ) {
          throw new AppError(
            "Account creation requires an approved application and verified payment",
            409,
            "ACCOUNT_NOT_ELIGIBLE",
          );
        }
        if (current.linkedMemberId || current.accountCreatedAt) {
          throw new AppError(
            "A member account was already created",
            409,
            "ACCOUNT_ALREADY_CREATED",
          );
        }

        const [existingUsers] = await connection.execute<IdRow[]>(
          `SELECT CAST(user_id AS CHAR) AS id FROM users WHERE email = ? LIMIT 1`,
          [current.email],
        );
        if (existingUsers[0]) {
          throw new AppError(
            "An account already uses this email; resolve the duplicate before continuing",
            409,
            "DUPLICATE_USER",
          );
        }

        let memberId = input.linkedMemberId ?? null;
        if (input.duplicateResolution === "LINK_EXISTING") {
          const [members] = await connection.execute<IdRow[]>(
            `SELECT CAST(member_id AS CHAR) AS id
               FROM member_profiles
              WHERE member_id = ?
              FOR UPDATE`,
            [memberId],
          );
          if (!members[0]) {
            throw new AppError(
              "The selected member was not found",
              404,
              "MEMBER_NOT_FOUND",
            );
          }
        } else {
          const [memberResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO member_profiles
               (member_code, full_name, contact_number, email, barangay, municipality,
                province, sector, membership_type, approval_status,
                official_member_status, application_date, approved_by, approved_at,
                true_member_since, share_capital_deadline, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved', 'Pending', DATE(?), ?,
                     UTC_TIMESTAMP(), ?, ?, ?)`,
            [
              `PENDING-${applicationId}`,
              current.fullName,
              current.contactNumber,
              current.email,
              current.barangay,
              current.municipality,
              current.province,
              current.sector,
              current.approvedMembershipType === "TRUE_MEMBER"
                ? "True Member"
                : "Associate",
              current.submittedAt,
              auth.user.id,
              current.approvedMembershipType === "TRUE_MEMBER"
                ? new Date().toISOString().slice(0, 10)
                : null,
              current.approvedMembershipType === "TRUE_MEMBER"
                ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .slice(0, 10)
                : null,
              `Created from ${current.reference}. Override reason: ${input.overrideReason}`,
            ],
          );
          memberId = String(memberResult.insertId);
          await connection.execute(
            `UPDATE member_profiles SET member_code = ? WHERE member_id = ?`,
            [
              `NFFAC-${new Date().getUTCFullYear()}-${memberId.padStart(6, "0")}`,
              memberId,
            ],
          );
        }

        const [roles] = await connection.execute<IdRow[]>(
          `SELECT CAST(role_id AS CHAR) AS id
             FROM roles
            WHERE role_slug = 'member' AND is_active = 1
            LIMIT 1`,
        );
        if (!roles[0]) {
          throw new AppError(
            "The Member role is unavailable",
            409,
            "MEMBER_ROLE_UNAVAILABLE",
          );
        }
        const [userResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO users
             (role_id, email, password_hash, display_name, account_status, created_by)
           VALUES (?, ?, ?, ?, 'Pending', ?)`,
          [
            roles[0].id,
            current.email,
            passwordHash,
            current.fullName,
            auth.user.id,
          ],
        );
        const userId = String(userResult.insertId);
        await connection.execute(
          `UPDATE member_profiles
              SET user_id = ?, official_member_status = 'Pending'
            WHERE member_id = ?`,
          [userId, memberId],
        );
        await connection.execute(
          `UPDATE payment_references p
             JOIN membership_application_payments mp
               ON mp.payment_reference_id = p.payment_reference_id
              SET p.member_id = ?
            WHERE mp.membership_application_id = ?`,
          [memberId, applicationId],
        );
        if (current.approvedMembershipType === "TRUE_MEMBER") {
          await connection.execute(
            `INSERT INTO share_capital_payments
               (member_id, payment_reference_id, amount, payment_date, payment_status,
                verified_by, verified_at, remarks)
             SELECT ?, mp.payment_reference_id, p.amount, DATE(p.validated_at), 'Validated',
                    p.validated_by, p.validated_at, ?
               FROM membership_application_payments mp
               JOIN payment_references p ON p.payment_reference_id = mp.payment_reference_id
              WHERE mp.membership_application_id = ? AND mp.payment_status = 'VERIFIED'
              LIMIT 1`,
            [
              memberId,
              `Initial share capital from ${current.reference}`,
              applicationId,
            ],
          );
        }
        await connection.execute(
          `INSERT INTO membership_account_activations
             (membership_application_id, user_id, token_hash, expires_at, created_by)
           VALUES (?, ?, ?, ?, ?)`,
          [applicationId, userId, tokenHash, expiresAt, auth.user.id],
        );
        assertTransition(current.status, "ACCOUNT_PENDING_ACTIVATION");
        await connection.execute(
          `UPDATE membership_applications
              SET linked_member_id = ?, application_status = 'ACCOUNT_PENDING_ACTIVATION',
                  account_created_at = UTC_TIMESTAMP()
            WHERE membership_application_id = ?`,
          [memberId, applicationId],
        );
        await addHistory(
          connection,
          applicationId,
          current.status,
          "ACCOUNT_PENDING_ACTIVATION",
          auth.user.id,
          "Your member account is ready for secure activation.",
          input.overrideReason,
        );
        await addAudit(
          connection,
          auth.user.id,
          "membership.account_created",
          applicationId,
          "A pending Member account and secure activation were created.",
          { memberId, userId, duplicateResolution: input.duplicateResolution },
        );
        const [updated] = await connection.execute<ApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? LIMIT 1`,
          [applicationId],
        );
        return updated[0];
      }, databasePool);

      return {
        application,
        activationToken,
        expiresAt: expiresAt.toISOString(),
      };
    },

    async activate(token, password) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
      await withTransaction(async (connection) => {
        const [activations] = await connection.execute<
          (RowDataPacket & {
            id: string;
            userId: string;
            applicationId: string;
          })[]
        >(
          `SELECT CAST(membership_account_activation_id AS CHAR) AS id,
                  CAST(user_id AS CHAR) AS userId,
                  CAST(membership_application_id AS CHAR) AS applicationId
             FROM membership_account_activations
            WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
            FOR UPDATE`,
          [tokenHash],
        );
        const activation = activations[0];
        if (!activation) {
          throw new AppError(
            "Activation link is invalid or expired",
            410,
            "ACTIVATION_INVALID",
          );
        }
        await connection.execute(
          `UPDATE users
              SET password_hash = ?, account_status = 'Active',
                  email_verified_at = UTC_TIMESTAMP(), failed_login_count = 0,
                  locked_until = NULL
            WHERE user_id = ?`,
          [passwordHash, activation.userId],
        );
        await connection.execute(
          `UPDATE member_profiles
              SET official_member_status = 'Active'
            WHERE user_id = ?`,
          [activation.userId],
        );
        await connection.execute(
          `UPDATE membership_account_activations
              SET used_at = UTC_TIMESTAMP()
            WHERE membership_account_activation_id = ?`,
          [activation.id],
        );
        const [applications] = await connection.execute<ApplicationRow[]>(
          `${applicationSelect()} WHERE a.membership_application_id = ? FOR UPDATE`,
          [activation.applicationId],
        );
        const application = applications[0];
        assertTransition(application.status, "ACCOUNT_CREATED");
        await connection.execute(
          `UPDATE membership_applications
              SET application_status = 'ACCOUNT_CREATED'
            WHERE membership_application_id = ?`,
          [activation.applicationId],
        );
        await addHistory(
          connection,
          activation.applicationId,
          application.status,
          "ACCOUNT_CREATED",
          activation.userId,
          "Member account activated.",
        );
        await addAudit(
          connection,
          activation.userId,
          "membership.account_activated",
          activation.applicationId,
          "The member activated the account using a one-time token.",
        );
        const [members] = await connection.execute<
          (RowDataPacket & {
            id: string;
            memberCode: string;
            fullName: string;
            membershipType: string;
            approvedAt: string | null;
          })[]
        >(
          `SELECT CAST(member_id AS CHAR) AS id, member_code AS memberCode,
                  full_name AS fullName, membership_type AS membershipType,
                  CAST(approved_at AS CHAR) AS approvedAt
             FROM member_profiles
            WHERE user_id = ?
            LIMIT 1`,
          [activation.userId],
        );
        const member = members[0];
        if (member) {
          const certificate = await createGeneratedPdfDocument(connection, {
            uploadedBy: activation.userId,
            uploaderRole: "member",
            memberId: member.id,
            title: `Membership Certificate ${member.memberCode}`,
            description:
              "System-generated membership certificate issued after account activation.",
            category: "CERTIFICATE",
            documentType: "Certificate",
            accessLevel: "Member-only",
            relatedModule: "MEMBER_PROFILE",
            relatedRecordId: member.id,
            relatedRecordReference: member.memberCode,
            relationshipType: "MEMBERSHIP_CERTIFICATE",
            fileBaseName: `membership-certificate-${member.memberCode}`,
            heading: "Membership Certificate",
            lines: [
              { label: "Member code", value: member.memberCode },
              { label: "Member name", value: member.fullName },
              { label: "Membership type", value: member.membershipType },
              { label: "Approval date", value: member.approvedAt },
              { label: "Account status", value: "Active" },
            ],
            notice:
              "This TrackCOOP-generated certificate reflects the approved membership record. It is not a substitute for any separately required statutory certificate.",
          });
          await connection.execute(
            `INSERT INTO notifications
               (user_id, notification_type, title, message, related_entity_type, related_entity_id)
             VALUES (?, 'Document', 'Membership certificate available',
                     'Your membership certificate is available in Documents.',
                     'Document', ?)`,
            [activation.userId, certificate.documentId],
          );
        }
      }, databasePool);
    },
  };
}
