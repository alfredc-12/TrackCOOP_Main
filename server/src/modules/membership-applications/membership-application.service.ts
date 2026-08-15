import crypto from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import PDFDocument from "pdfkit";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import {
  createMembershipApplicationRepository,
  type MembershipApplicationRepository,
} from "./membership-application.repository";
import type {
  ApprovalInput,
  ApprovalResult,
  ChairmanApplicationBeneficiary,
  ChairmanApplicationDetail,
  ChairmanApplicationDocument,
  ChairmanApplicationHistoryEntry,
  ChairmanApplicationListQuery,
  ChairmanApplicationListResult,
  ChairmanApplicationRequirement,
  ChairmanApplicationSummary,
  ChairmanMembershipApplicationInput,
  ChairmanMembershipApplicationUpdateInput,
  MembershipApplicationBeneficiaryInput,
  PublicApplicationStatus,
  PublicDocumentUploadInput,
  PublicMembershipApplicationInput,
  PublicSubmissionContext,
  PublicSubmissionResult,
  RequirementInput,
  RequirementUpdateInput,
  StatusTransitionInput,
  StoredMembershipApplicationDocument,
} from "./membership-application.types";
import type { AuthContext } from "../auth/auth.types";
import {
  generateApplicationTrackingToken,
  hashApplicationTrackingToken,
  requireApplicationBirthDateCredential,
  verifyApplicationBirthDate,
} from "./public-tracking-token";

const duplicateWarningMessage =
  "A recent application with matching applicant details already exists. The new application was still submitted for Chairman review.";

const allowedDocuments = new Map<
  string,
  { extensions: Set<string>; magic: (buffer: Buffer) => boolean }
>([
  [
    "application/pdf",
    {
      extensions: new Set([".pdf"]),
      magic: (buffer) => buffer.subarray(0, 4).toString("ascii") === "%PDF",
    },
  ],
  [
    "image/png",
    {
      extensions: new Set([".png"]),
      magic: (buffer) =>
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a,
    },
  ],
  [
    "image/jpeg",
    {
      extensions: new Set([".jpg", ".jpeg"]),
      magic: (buffer) =>
        buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    },
  ],
]);

const maxDocumentSizeBytes = 5 * 1024 * 1024;

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizeContact(value: string) {
  const trimmed = value.trim();
  const leadingPlus = trimmed.startsWith("+") ? "+" : "";
  return `${leadingPlus}${trimmed.replace(/[^\d]/g, "")}`;
}

function hashToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function generateActivationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function sanitizeOriginalFileName(fileName: string) {
  return path.basename(fileName).replace(/[^\w.\- ()]/g, "_").slice(0, 255);
}

function validateDocument(document: PublicDocumentUploadInput) {
  if (document.fileSizeBytes <= 0 || document.fileSizeBytes > maxDocumentSizeBytes) {
    throw new AppError(
      "Document file size is not allowed",
      400,
      "MEMBERSHIP_DOCUMENT_SIZE_INVALID",
    );
  }

  const extension = path.extname(document.originalFileName).toLowerCase();
  const allowed = allowedDocuments.get(document.mimeType);

  if (!allowed || !allowed.extensions.has(extension)) {
    throw new AppError(
      "Document file type is not allowed",
      400,
      "MEMBERSHIP_DOCUMENT_TYPE_INVALID",
    );
  }

  if (!allowed.magic(document.buffer)) {
    throw new AppError(
      "Document file content does not match the declared type",
      400,
      "MEMBERSHIP_DOCUMENT_CONTENT_INVALID",
    );
  }
}

function checksum(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function storageExtension(documentType: string) {
  const allowed = allowedDocuments.get(documentType);
  return allowed ? [...allowed.extensions][0] : "";
}

function protectedStorageRoot() {
  return path.resolve(process.cwd(), "storage", "protected", "membership-applications");
}

async function storeDocumentBuffer(
  applicationCode: string,
  document: PublicDocumentUploadInput,
) {
  const applicationDirectory = path.join(protectedStorageRoot(), applicationCode);
  await mkdir(applicationDirectory, { recursive: true });

  const storedFileName = `${crypto.randomUUID()}${storageExtension(document.mimeType)}`;
  const storedFilePath = path.join(applicationDirectory, storedFileName);
  await writeFile(storedFilePath, document.buffer, { flag: "wx" });

  return path.relative(process.cwd(), storedFilePath);
}

function normalizeChairmanApplication(input: ChairmanMembershipApplicationInput) {
  return {
    ...input,
    email: normalizeEmail(input.email),
    contactNumber: normalizeContact(input.contactNumber),
    termsVersion: input.termsVersion ?? null,
  };
}

function activationUrl(rawToken: string) {
  return `${env.FRONTEND_URL.replace(/\/$/, "")}/activate?token=${encodeURIComponent(rawToken)}`;
}

function addPdfLine(document: PDFKit.PDFDocument, label: string, value: unknown) {
  document.font("Helvetica-Bold").text(`${label}: `, { continued: true });
  document.font("Helvetica").text(value === null || value === undefined || value === "" ? "N/A" : String(value));
}

async function buildPrintablePdf(detail: ChairmanApplicationDetail) {
  const document = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.font("Helvetica-Bold").fontSize(18).text("NFFAC Cooperative Membership Application", {
      align: "center",
    });
    document.moveDown();
    addPdfLine(document, "Application Code", detail.applicationCode);
    addPdfLine(document, "Application Date", detail.submittedAt.toISOString().slice(0, 10));
    addPdfLine(document, "Requested Membership Type", detail.requestedMembershipType);
    addPdfLine(document, "Current Status", detail.applicationStatus);
    document.moveDown();

    document.font("Helvetica-Bold").fontSize(14).text("Applicant Information");
    document.fontSize(11);
    addPdfLine(document, "Full Name", detail.fullName);
    addPdfLine(document, "Email", detail.email);
    addPdfLine(document, "Contact Number", detail.contactNumber);
    addPdfLine(document, "Civil Status", detail.civilStatus);
    addPdfLine(document, "Date of Birth", detail.dateOfBirth);
    addPdfLine(document, "Place of Birth", detail.placeOfBirth);
    addPdfLine(document, "Current Address", detail.currentAddress);
    addPdfLine(document, "Barangay", detail.barangay);
    addPdfLine(document, "Municipality", detail.municipality);
    addPdfLine(document, "Province", detail.province);
    addPdfLine(document, "Occupation", detail.occupation);
    document.moveDown();

    document.font("Helvetica-Bold").fontSize(14).text("Beneficiaries");
    document.font("Helvetica").fontSize(11);
    if (detail.beneficiaries.length === 0) document.text("No beneficiaries recorded.");
    for (const beneficiary of detail.beneficiaries) {
      document.text(`- ${beneficiary.fullName} (${beneficiary.relationship ?? "N/A"}), age ${beneficiary.ageAtApplication ?? "N/A"}`);
    }
    document.moveDown();

    document.font("Helvetica-Bold").fontSize(14).text("Commitments");
    document.font("Helvetica").fontSize(11);
    addPdfLine(document, "Orientation Commitment", detail.orientationCommitmentAccepted ? "Accepted" : "Not accepted");
    addPdfLine(document, "Membership Fee Commitment", detail.membershipFeeCommitmentAccepted ? "Accepted" : "Not accepted");
    addPdfLine(document, "Share Subscription Commitment", detail.shareSubscriptionCommitmentAccepted ? "Accepted" : "Not accepted");
    addPdfLine(document, "Bylaws Agreement", detail.bylawsAgreementAccepted ? "Accepted" : "Not accepted");
    addPdfLine(document, "Privacy Consent", detail.privacyConsentAccepted ? "Accepted" : "Not accepted");
    document.moveDown();

    document.font("Helvetica-Bold").fontSize(14).text("Requirements");
    document.font("Helvetica").fontSize(11);
    for (const requirement of detail.requirements) {
      document.text(`- ${requirement.requirementType}: ${requirement.requirementStatus}${requirement.remarks ? ` (${requirement.remarks})` : ""}`);
    }
    document.moveDown();

    document.font("Helvetica-Bold").fontSize(14).text("Signature and Board Decision");
    document.font("Helvetica").fontSize(11);
    addPdfLine(document, "Applicant Signature", detail.applicantSignatureName);
    addPdfLine(document, "Signed At", detail.signedAt);
    addPdfLine(document, "Signed Place", detail.signedPlace);
    addPdfLine(document, "Board Meeting Date", detail.boardMeetingDate);
    addPdfLine(document, "Secretary Name", detail.secretaryName);
    addPdfLine(document, "Decision Remarks", detail.decisionReason);
    addPdfLine(document, "Chairman/Reviewer User ID", detail.reviewedBy);
    document.moveDown();

    document.font("Helvetica-Bold").fontSize(14).text("Status History");
    document.font("Helvetica").fontSize(11);
    for (const entry of detail.history.slice(0, 12)) {
      document.text(`- ${entry.changedAt.toISOString().slice(0, 19)}: ${entry.oldStatus ?? "New"} -> ${entry.newStatus}`);
    }
    document.end();
  });
}

export interface MembershipApplicationService {
  submitPublicApplication(
    input: PublicMembershipApplicationInput,
    context: PublicSubmissionContext,
  ): Promise<PublicSubmissionResult>;
  getPublicStatus(applicationCode: string, rawDateOfBirth: string | undefined): Promise<PublicApplicationStatus>;
  uploadPublicDocument(
    applicationCode: string,
    rawDateOfBirth: string | undefined,
    document: PublicDocumentUploadInput,
  ): Promise<StoredMembershipApplicationDocument>;
  summary(auth: AuthContext): Promise<ChairmanApplicationSummary>;
  list(query: ChairmanApplicationListQuery, auth: AuthContext): Promise<ChairmanApplicationListResult>;
  createChairmanApplication(
    input: ChairmanMembershipApplicationInput,
    auth: AuthContext,
  ): Promise<ChairmanApplicationDetail>;
  getChairmanApplication(applicationId: string, auth: AuthContext): Promise<ChairmanApplicationDetail>;
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
  uploadChairmanDocument(
    applicationId: string,
    document: PublicDocumentUploadInput,
    auth: AuthContext,
  ): Promise<ChairmanApplicationDocument>;
  deleteDocument(documentId: string, auth: AuthContext): Promise<void>;
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
  history(applicationId: string, auth: AuthContext): Promise<ChairmanApplicationHistoryEntry[]>;
  startReview(applicationId: string, input: StatusTransitionInput, auth: AuthContext): Promise<ChairmanApplicationDetail>;
  requestInformation(applicationId: string, input: StatusTransitionInput, auth: AuthContext): Promise<ChairmanApplicationDetail>;
  reject(applicationId: string, input: StatusTransitionInput, auth: AuthContext): Promise<ChairmanApplicationDetail>;
  withdraw(applicationId: string, input: StatusTransitionInput, auth: AuthContext): Promise<ChairmanApplicationDetail>;
  approve(applicationId: string, input: ApprovalInput, auth: AuthContext): Promise<ApprovalResult>;
  printablePdf(applicationId: string, auth: AuthContext): Promise<Buffer>;
}

export function createMembershipApplicationService(
  repository: MembershipApplicationRepository = createMembershipApplicationRepository(),
): MembershipApplicationService {
  async function findVerifiedApplication(applicationCode: string, rawDateOfBirth: string | undefined) {
    const application = await repository.findPublicApplicationByCode(applicationCode);
    if (!application) {
      throw new AppError(
        "Membership application was not found",
        404,
        "MEMBERSHIP_APPLICATION_NOT_FOUND",
      );
    }

    const dateOfBirth = requireApplicationBirthDateCredential(rawDateOfBirth);
    if (!verifyApplicationBirthDate(application.dateOfBirth, dateOfBirth)) {
      throw new AppError(
        "Applicant date of birth does not match this application",
        403,
        "APPLICATION_BIRTH_DATE_INVALID",
      );
    }

    return application;
  }

  return {
    async submitPublicApplication(input, context) {
      const normalizedInput = {
        ...input,
        email: normalizeEmail(input.email),
        contactNumber: normalizeContact(input.contactNumber),
        termsVersion: input.termsVersion ?? null,
      };
      const settings = await repository.getMembershipSettings();
      const duplicateWarning = await repository.hasRecentDuplicate(normalizedInput);
      const warnings = duplicateWarning ? [duplicateWarningMessage] : [];
      const trackingToken = generateApplicationTrackingToken();

      const result = await repository.createPublicApplication({
        application: normalizedInput,
        context,
        publicTrackingTokenHash: hashApplicationTrackingToken(trackingToken),
        settings,
        duplicateWarning,
        warnings,
      });

      return result;
    },

    async getPublicStatus(applicationCode, rawDateOfBirth) {
      const application = await findVerifiedApplication(applicationCode, rawDateOfBirth);

      return {
        applicationCode: application.applicationCode,
        requestedMembershipType: application.requestedMembershipType,
        fullName: application.fullName,
        submittedAt: application.submittedAt,
        applicationStatus: application.applicationStatus,
        latestApplicantMessage: application.latestApplicantMessage,
        missingOrRejectedRequirements: application.missingOrRejectedRequirements,
        paymentRequirements: application.paymentRequirements,
      };
    },

    async uploadPublicDocument(applicationCode, rawDateOfBirth, document) {
      const application = await findVerifiedApplication(applicationCode, rawDateOfBirth);
      const originalFileName = sanitizeOriginalFileName(document.originalFileName);
      const normalizedDocument: PublicDocumentUploadInput = {
        ...document,
        originalFileName,
      };

      validateDocument(normalizedDocument);
      const checksumSha256 = checksum(normalizedDocument.buffer);
      const storedFilePath = await storeDocumentBuffer(
        application.applicationCode,
        normalizedDocument,
      );
      try {
        return await repository.storePublicDocument({
          applicationId: application.id,
          applicationCode: application.applicationCode,
          document: normalizedDocument,
          checksumSha256,
          storedFilePath,
        });
      } catch (error) {
        await unlink(path.resolve(process.cwd(), storedFilePath)).catch(() => undefined);
        throw error;
      }
    },

    summary() {
      return repository.summary();
    },

    list(query) {
      return repository.list(query);
    },

    async createChairmanApplication(input, auth) {
      const settings = await repository.getMembershipSettings();
      return repository.createChairmanApplication({
        application: normalizeChairmanApplication(input),
        publicTrackingTokenHash: hashApplicationTrackingToken(generateApplicationTrackingToken()),
        settings,
        auth,
      });
    },

    async getChairmanApplication(applicationId) {
      const application = await repository.findChairmanApplicationById(applicationId);
      if (!application) {
        throw new AppError(
          "Membership application was not found",
          404,
          "MEMBERSHIP_APPLICATION_NOT_FOUND",
        );
      }
      return application;
    },

    updateApplication(applicationId, input, auth) {
      return repository.updateApplication(applicationId, {
        ...input,
        email: Object.prototype.hasOwnProperty.call(input, "email")
          ? normalizeEmail(input.email)
          : undefined,
        contactNumber: input.contactNumber ? normalizeContact(input.contactNumber) : undefined,
      }, auth);
    },

    createBeneficiary(applicationId, input, auth) {
      return repository.createBeneficiary(applicationId, input, auth);
    },

    updateBeneficiary(beneficiaryId, input, auth) {
      return repository.updateBeneficiary(beneficiaryId, input, auth);
    },

    deleteBeneficiary(beneficiaryId, auth) {
      return repository.deleteBeneficiary(beneficiaryId, auth);
    },

    async uploadChairmanDocument(applicationId, document, auth) {
      const application = await repository.findChairmanApplicationById(applicationId);
      if (!application) {
        throw new AppError(
          "Membership application was not found",
          404,
          "MEMBERSHIP_APPLICATION_NOT_FOUND",
        );
      }
      const originalFileName = sanitizeOriginalFileName(document.originalFileName);
      const normalizedDocument: PublicDocumentUploadInput = {
        ...document,
        originalFileName,
      };
      validateDocument(normalizedDocument);
      const checksumSha256 = checksum(normalizedDocument.buffer);
      const storedFilePath = await storeDocumentBuffer(
        application.applicationCode,
        normalizedDocument,
      );
      try {
        return await repository.storeChairmanDocument({
          applicationId,
          document: normalizedDocument,
          checksumSha256,
          storedFilePath,
          auth,
        });
      } catch (error) {
        await unlink(path.resolve(process.cwd(), storedFilePath)).catch(() => undefined);
        throw error;
      }
    },

    async deleteDocument(documentId, auth) {
      const storedFilePath = await repository.deleteDocument(documentId, auth);
      await unlink(path.resolve(process.cwd(), storedFilePath)).catch(() => undefined);
    },

    createRequirement(applicationId, input, auth) {
      return repository.createRequirement(applicationId, input, auth);
    },

    updateRequirement(requirementId, input, auth) {
      return repository.updateRequirement(requirementId, input, auth);
    },

    history(applicationId) {
      return repository.history(applicationId);
    },

    startReview(applicationId, input, auth) {
      return repository.transitionStatus(applicationId, "Under Review", input, auth);
    },

    requestInformation(applicationId, input, auth) {
      return repository.transitionStatus(applicationId, "Needs Information", input, auth);
    },

    reject(applicationId, input, auth) {
      return repository.transitionStatus(applicationId, "Rejected", input, auth);
    },

    withdraw(applicationId, input, auth) {
      return repository.transitionStatus(applicationId, "Withdrawn", input, auth);
    },

    async approve(applicationId, input, auth) {
      const settings = await repository.getMembershipSettings();
      const normalizedApproval: ApprovalInput = {
        ...input,
        accountEmail: normalizeEmail(input.accountEmail),
        username: input.username?.trim() || null,
      };
      const rawActivationToken = normalizedApproval.createMemberPortalAccount
        ? generateActivationToken()
        : null;
      const activationTokenHash = rawActivationToken ? hashToken(rawActivationToken) : null;
      const activationTokenExpiresAt = rawActivationToken
        ? new Date(Date.now() + settings.activationTokenHours * 60 * 60_000)
        : null;
      const unusablePasswordHash = rawActivationToken
        ? await hash(generateActivationToken(), env.BCRYPT_ROUNDS)
        : null;

      const result = await repository.approveApplication({
        applicationId,
        approval: normalizedApproval,
        auth,
        settings,
        activationTokenHash,
        activationTokenExpiresAt,
        unusablePasswordHash,
      });

      return {
        ...result,
        activationUrl: rawActivationToken ? activationUrl(rawActivationToken) : null,
      };
    },

    async printablePdf(applicationId) {
      const detail = await repository.findChairmanApplicationById(applicationId);
      if (!detail) {
        throw new AppError(
          "Membership application was not found",
          404,
          "MEMBERSHIP_APPLICATION_NOT_FOUND",
        );
      }
      return buildPrintablePdf(detail);
    },
  };
}

export function isAllowedMembershipDocumentMimeType(mimeType: string) {
  return allowedDocuments.has(mimeType);
}

export function isAllowedMembershipDocumentExtension(fileName: string, mimeType: string) {
  const allowed = allowedDocuments.get(mimeType);
  return Boolean(allowed?.extensions.has(path.extname(fileName).toLowerCase()));
}
