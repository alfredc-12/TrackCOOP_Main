import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import express from "express";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";
import { createMembershipApplicationRouter } from "./membership-application.routes";
import { createMembershipApplicationService } from "./membership-application.service";
import type {
  MembershipApplicationRepository,
} from "./membership-application.repository";
import type {
  MembershipSettings,
  PublicApplicationRecord,
  PublicDocumentUploadInput,
  PublicMembershipApplicationInput,
  PublicStatusRequirement,
  PublicSubmissionContext,
  StoredMembershipApplicationDocument,
} from "./membership-application.types";

const protectedUploadRoot = path.resolve(
  process.cwd(),
  "storage",
  "protected",
  "membership-applications",
);

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

type CreatedApplication = {
  input: PublicMembershipApplicationInput;
  context: PublicSubmissionContext;
  hash: string;
  code: string;
  submittedAt: Date;
  requirements: PublicStatusRequirement[];
};

class FakeMembershipApplicationRepository implements MembershipApplicationRepository {
  duplicate = false;
  failDocumentStore = false;
  created: CreatedApplication | null = null;
  storedDocumentPath: string | null = null;

  async getMembershipSettings() {
    return defaultSettings;
  }

  async hasRecentDuplicate(input: PublicMembershipApplicationInput) {
    assert.equal(input.contactNumber, "09171234567");
    assert.equal(input.email, "applicant@example.test");
    return this.duplicate;
  }

  async createPublicApplication(input: {
    application: PublicMembershipApplicationInput;
    context: PublicSubmissionContext;
    publicTrackingTokenHash: string;
    settings: MembershipSettings;
    duplicateWarning: boolean;
    warnings: string[];
  }) {
    const code = "MEM-APP-2026-000001";
    const submittedAt = new Date("2026-07-24T08:00:00.000Z");
    this.created = {
      input: input.application,
      context: input.context,
      hash: input.publicTrackingTokenHash,
      code,
      submittedAt,
      requirements: [
        {
          requirementType: "Orientation/Seminar",
          requirementStatus: "Pending",
          remarks: null,
        },
        {
          requirementType: "Associate Membership Fee",
          requirementStatus: "Pending",
          remarks: null,
        },
      ],
    };

    return {
      applicationCode: code,
      duplicateWarning: input.duplicateWarning,
      warnings: input.warnings,
      submittedAt,
      nextStep: "Chairman review" as const,
    };
  }

  async findPublicApplicationByCode(applicationCode: string): Promise<PublicApplicationRecord | null> {
    if (!this.created || this.created.code !== applicationCode) return null;

    return {
      id: "1",
      applicationCode: this.created.code,
      publicTrackingTokenHash: this.created.hash,
      fullName: this.created.input.fullName,
      submittedAt: this.created.submittedAt,
      applicationStatus: "Submitted",
      latestApplicantMessage: "Your application was submitted and is waiting for Chairman review.",
      missingOrRejectedRequirements: this.created.requirements,
    };
  }

  async storePublicDocument(input: {
    applicationId: string;
    applicationCode: string;
    document: PublicDocumentUploadInput;
    checksumSha256: string;
    storedFilePath: string;
  }): Promise<StoredMembershipApplicationDocument> {
    assert.equal(input.applicationId, "1");
    assert.equal(input.applicationCode, "MEM-APP-2026-000001");
    this.storedDocumentPath = input.storedFilePath;

    if (this.failDocumentStore) {
      throw new AppError(
        "Document metadata could not be saved",
        503,
        "DOCUMENT_METADATA_SAVE_FAILED",
      );
    }

    return {
      documentType: input.document.documentType,
      originalFileName: input.document.originalFileName,
      mimeType: input.document.mimeType,
      fileSizeBytes: input.document.fileSizeBytes,
      checksumSha256: input.checksumSha256,
      uploadedAt: new Date("2026-07-24T08:05:00.000Z"),
    };
  }
}

function validApplicationPayload() {
  return {
    requestedMembershipType: "True Member",
    fullName: "Maria Santos",
    email: "Applicant@Example.Test",
    contactNumber: "0917 123 4567",
    civilStatus: "Married",
    placeOfBirth: "Nasugbu, Batangas",
    dateOfBirth: "1990-01-15",
    currentAddress: "Barangay Lumbangan, Nasugbu, Batangas",
    barangay: "Lumbangan",
    municipality: "Nasugbu",
    province: "Batangas",
    fatherName: "Juan Santos",
    motherName: "Rosa Santos",
    spouseName: "Pedro Santos",
    occupation: "Farmer",
    orientationCommitmentAccepted: true,
    membershipFeeCommitmentAccepted: true,
    shareSubscriptionCommitmentAccepted: true,
    patronageRefundAcknowledged: true,
    bylawsAgreementAccepted: true,
    privacyConsentAccepted: true,
    applicantSignatureName: "Maria Santos",
    signedAt: "2026-07-24T08:00:00.000Z",
    signedPlace: "Nasugbu, Batangas",
    beneficiaries: [
      {
        fullName: "Ana Santos",
        relationship: "Child",
        ageAtApplication: 8,
      },
    ],
  };
}

function createTestApp(repository = new FakeMembershipApplicationRepository()) {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.requestId = "test-request";
    next();
  });
  app.use(
    "/api",
    createMembershipApplicationRouter(createMembershipApplicationService(repository)),
  );
  app.use(errorHandler);

  return { app, repository };
}

beforeEach(async () => {
  await rm(protectedUploadRoot, { recursive: true, force: true });
});

after(async () => {
  await rm(protectedUploadRoot, { recursive: true, force: true });
});

test("POST /api/membership-applications/public submits an application and returns the tracking secret once", async () => {
  const { app, repository } = createTestApp();

  const response = await request(app)
    .post("/api/membership-applications/public")
    .send(validApplicationPayload());

  assert.equal(response.status, 201);
  assert.equal(response.body.data.applicationCode, "MEM-APP-2026-000001");
  assert.equal(typeof response.body.data.trackingToken, "string");
  assert.equal(response.body.data.duplicateWarning, false);
  assert.equal(response.body.data.nextStep, "Chairman review");
  assert.equal(repository.created?.hash.length, 64);
  assert.notEqual(repository.created?.hash, response.body.data.trackingToken);
});

test("POST /api/membership-applications/public rejects missing required commitments", async () => {
  const { app, repository } = createTestApp();
  const payload = {
    ...validApplicationPayload(),
    orientationCommitmentAccepted: false,
  };

  const response = await request(app)
    .post("/api/membership-applications/public")
    .send(payload);

  assert.equal(response.status, 400);
  assert.equal(response.body.errors[0].code, "VALIDATION_ERROR");
  assert.equal(repository.created, null);
});

test("POST /api/membership-applications/public rejects invalid birth dates", async () => {
  const { app, repository } = createTestApp();
  const payload = {
    ...validApplicationPayload(),
    dateOfBirth: "2099-01-01",
  };

  const response = await request(app)
    .post("/api/membership-applications/public")
    .send(payload);

  assert.equal(response.status, 400);
  assert.equal(response.body.errors[0].field, "dateOfBirth");
  assert.equal(repository.created, null);
});

test("POST /api/membership-applications/public includes duplicate warnings without blocking submission", async () => {
  const repository = new FakeMembershipApplicationRepository();
  repository.duplicate = true;
  const { app } = createTestApp(repository);

  const response = await request(app)
    .post("/api/membership-applications/public")
    .send(validApplicationPayload());

  assert.equal(response.status, 201);
  assert.equal(response.body.data.duplicateWarning, true);
  assert.equal(response.body.data.warnings.length, 1);
  assert.equal(repository.created?.code, "MEM-APP-2026-000001");
});

test("GET /api/membership-applications/public/:applicationCode/status returns only safe public status with the correct token", async () => {
  const { app } = createTestApp();
  const submission = await request(app)
    .post("/api/membership-applications/public")
    .send(validApplicationPayload());
  const token = submission.body.data.trackingToken as string;

  const response = await request(app)
    .get("/api/membership-applications/public/MEM-APP-2026-000001/status")
    .set("X-Application-Tracking-Token", token);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.applicationCode, "MEM-APP-2026-000001");
  assert.equal(response.body.data.fullName, "Maria Santos");
  assert.equal(response.body.data.applicationStatus, "Submitted");
  assert.equal(response.body.data.publicTrackingTokenHash, undefined);
  assert.equal(response.body.data.id, undefined);
  assert.equal(response.body.data.missingOrRejectedRequirements.length, 2);
});

test("GET /api/membership-applications/public/:applicationCode/status rejects the wrong tracking token", async () => {
  const { app } = createTestApp();
  await request(app)
    .post("/api/membership-applications/public")
    .send(validApplicationPayload());

  const response = await request(app)
    .get("/api/membership-applications/public/MEM-APP-2026-000001/status")
    .set("X-Application-Tracking-Token", "wrong-token");

  assert.equal(response.status, 403);
  assert.equal(response.body.errors[0].code, "APPLICATION_TRACKING_TOKEN_INVALID");
});

test("POST /api/membership-applications/public/:applicationCode/documents stores a protected document without exposing its path", async () => {
  const { app, repository } = createTestApp();
  const submission = await request(app)
    .post("/api/membership-applications/public")
    .send(validApplicationPayload());
  const token = submission.body.data.trackingToken as string;

  const response = await request(app)
    .post("/api/membership-applications/public/MEM-APP-2026-000001/documents")
    .set("X-Application-Tracking-Token", token)
    .field("documentType", "Valid ID")
    .attach("document", Buffer.from("%PDF-1.4\n%test\n"), {
      filename: "valid-id.pdf",
      contentType: "application/pdf",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.documentType, "Valid ID");
  assert.equal(response.body.data.originalFileName, "valid-id.pdf");
  assert.equal(response.body.data.storedFilePath, undefined);
  assert.match(
    (repository.storedDocumentPath ?? "").replace(/\\/g, "/"),
    /storage\/protected\/membership-applications/,
  );
});

test("POST /api/membership-applications/public/:applicationCode/documents rejects unsupported file types", async () => {
  const { app } = createTestApp();
  const submission = await request(app)
    .post("/api/membership-applications/public")
    .send(validApplicationPayload());
  const token = submission.body.data.trackingToken as string;

  const response = await request(app)
    .post("/api/membership-applications/public/MEM-APP-2026-000001/documents")
    .set("X-Application-Tracking-Token", token)
    .field("documentType", "Valid ID")
    .attach("document", Buffer.from("hello"), {
      filename: "valid-id.txt",
      contentType: "text/plain",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.errors[0].code, "MEMBERSHIP_DOCUMENT_TYPE_INVALID");
});

test("POST /api/membership-applications/public/:applicationCode/documents removes the protected file if metadata persistence fails", async () => {
  const repository = new FakeMembershipApplicationRepository();
  repository.failDocumentStore = true;
  const { app } = createTestApp(repository);
  const submission = await request(app)
    .post("/api/membership-applications/public")
    .send(validApplicationPayload());
  const token = submission.body.data.trackingToken as string;

  const response = await request(app)
    .post("/api/membership-applications/public/MEM-APP-2026-000001/documents")
    .set("X-Application-Tracking-Token", token)
    .field("documentType", "Valid ID")
    .attach("document", Buffer.from("%PDF-1.4\n%test\n"), {
      filename: "valid-id.pdf",
      contentType: "application/pdf",
    });

  assert.equal(response.status, 503);
  assert.equal(response.body.errors[0].code, "DOCUMENT_METADATA_SAVE_FAILED");
  await assert.rejects(
    stat(path.resolve(process.cwd(), repository.storedDocumentPath ?? "")),
  );
});
