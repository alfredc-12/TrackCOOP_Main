import crypto from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../utils/app-error";
import {
  createMembershipApplicationRepository,
  type MembershipApplicationRepository,
} from "./membership-application.repository";
import type {
  PublicApplicationStatus,
  PublicDocumentUploadInput,
  PublicMembershipApplicationInput,
  PublicSubmissionContext,
  PublicSubmissionResult,
  StoredMembershipApplicationDocument,
} from "./membership-application.types";

type PublicSubmissionWithSecret = PublicSubmissionResult & {
  trackingToken: string;
};

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

function timingSafeHashEquals(expectedHash: string, rawToken: string) {
  const actualHash = hashToken(rawToken);
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}

function generateTrackingToken() {
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

function requireTrackingToken(rawToken: string | undefined) {
  if (!rawToken) {
    throw new AppError(
      "Application tracking token is required",
      401,
      "APPLICATION_TRACKING_TOKEN_REQUIRED",
    );
  }
  return rawToken;
}

export interface MembershipApplicationService {
  submitPublicApplication(
    input: PublicMembershipApplicationInput,
    context: PublicSubmissionContext,
  ): Promise<PublicSubmissionWithSecret>;
  getPublicStatus(applicationCode: string, rawTrackingToken: string | undefined): Promise<PublicApplicationStatus>;
  uploadPublicDocument(
    applicationCode: string,
    rawTrackingToken: string | undefined,
    document: PublicDocumentUploadInput,
  ): Promise<StoredMembershipApplicationDocument>;
}

export function createMembershipApplicationService(
  repository: MembershipApplicationRepository = createMembershipApplicationRepository(),
): MembershipApplicationService {
  async function findVerifiedApplication(applicationCode: string, rawTrackingToken: string | undefined) {
    const application = await repository.findPublicApplicationByCode(applicationCode);
    if (!application) {
      throw new AppError(
        "Membership application was not found",
        404,
        "MEMBERSHIP_APPLICATION_NOT_FOUND",
      );
    }

    if (!timingSafeHashEquals(application.publicTrackingTokenHash, requireTrackingToken(rawTrackingToken))) {
      throw new AppError(
        "Application tracking token is invalid",
        403,
        "APPLICATION_TRACKING_TOKEN_INVALID",
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
      const trackingToken = generateTrackingToken();

      const result = await repository.createPublicApplication({
        application: normalizedInput,
        context,
        publicTrackingTokenHash: hashToken(trackingToken),
        settings,
        duplicateWarning,
        warnings,
      });

      return {
        ...result,
        trackingToken,
      };
    },

    async getPublicStatus(applicationCode, rawTrackingToken) {
      const application = await findVerifiedApplication(applicationCode, rawTrackingToken);

      return {
        applicationCode: application.applicationCode,
        fullName: application.fullName,
        submittedAt: application.submittedAt,
        applicationStatus: application.applicationStatus,
        latestApplicantMessage: application.latestApplicantMessage,
        missingOrRejectedRequirements: application.missingOrRejectedRequirements,
      };
    },

    async uploadPublicDocument(applicationCode, rawTrackingToken, document) {
      const application = await findVerifiedApplication(applicationCode, rawTrackingToken);
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
  };
}

export function isAllowedMembershipDocumentMimeType(mimeType: string) {
  return allowedDocuments.has(mimeType);
}

export function isAllowedMembershipDocumentExtension(fileName: string, mimeType: string) {
  const allowed = allowedDocuments.get(mimeType);
  return Boolean(allowed?.extensions.has(path.extname(fileName).toLowerCase()));
}
