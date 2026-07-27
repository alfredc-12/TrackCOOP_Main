import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, AuthUser, RoleSlug } from "../auth/auth.types";
import { createMembershipApplicationRouter } from "./membership-application.routes";
import { createMembershipApplicationService, type MembershipApplicationService } from "./membership-application.service";
import type {
  MembershipApplicationRepository,
} from "./membership-application.repository";
import type {
  ApprovalInput,
  ChairmanApplicationDetail,
  ChairmanApplicationListQuery,
  ChairmanMembershipApplicationUpdateInput,
  MembershipApplicationBeneficiaryInput,
  MembershipApplicationStatus,
  MembershipSettings,
  PublicApplicationRecord,
  PublicDocumentUploadInput,
  PublicMembershipApplicationInput,
  PublicStatusRequirement,
  PublicSubmissionContext,
  RequirementInput,
  RequirementUpdateInput,
  StatusTransitionInput,
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

const chairmanUser: AuthUser = {
  id: "1",
  displayName: "Chair Person",
  email: "chair@example.test",
  username: "chair",
  role: "chairman",
};

function createAuthService(role: RoleSlug): AuthService {
  const auth: AuthContext = {
    sessionId: "1",
    tokenHash: "hash",
    user: { ...chairmanUser, role },
  };

  return {
    async login() {
      throw new Error("not used");
    },
    async authenticate(rawToken) {
      if (!rawToken) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      return auth;
    },
    async logout() {},
    async listSessions() {
      return [];
    },
    async revokeSession() {},
  };
}

type CreatedApplication = {
  input: PublicMembershipApplicationInput;
  context: PublicSubmissionContext;
  hash: string;
  code: string;
  submittedAt: Date;
  requirements: PublicStatusRequirement[];
};

class FakeMembershipApplicationRepository {
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
      requestedMembershipType: this.created.input.requestedMembershipType,
      fullName: applicationFullName(this.created.input),
      submittedAt: this.created.submittedAt,
      applicationStatus: "Submitted",
      latestApplicantMessage: "Your application was submitted and is waiting for Chairman review.",
      missingOrRejectedRequirements: this.created.requirements,
      paymentRequirements: [
        {
          requirementType: "Associate Membership Fee",
          requirementStatus: "Pending",
          paymentPurpose: "Associate Membership Fee",
          paymentStatus: "Waiting",
          amount: null,
        },
      ],
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
    firstName: "Maria",
    middleName: "",
    lastName: "Santos",
    suffix: "",
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
  app.use(cookieParser());
  app.use(express.json());
  app.use((request, _response, next) => {
    request.requestId = "test-request";
    next();
  });
  app.use(
    "/api",
    createMembershipApplicationRouter(
      createAuthService("chairman"),
      createMembershipApplicationService(repository as unknown as MembershipApplicationRepository),
    ),
  );
  app.use(errorHandler);

  return { app, repository };
}

function applicationFullName(input: { firstName: string; middleName?: string | null; lastName: string; suffix?: string | null }) {
  return [input.firstName, input.middleName, input.lastName, input.suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function detail(status: MembershipApplicationStatus = "Submitted"): ChairmanApplicationDetail {
  return {
    id: "1",
    applicationCode: "MEM-APP-2026-000001",
    applicationSource: "Public Website",
    requestedMembershipType: "True Member",
    firstName: "Maria",
    middleName: null,
    lastName: "Santos",
    suffix: null,
    fullName: "Maria Santos",
    email: "maria@example.test",
    contactNumber: "09171234567",
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
    applicationStatus: status,
    submittedAt: new Date("2026-07-24T08:00:00.000Z"),
    reviewedAt: null,
    convertedMemberId: null,
    submittedByUserId: null,
    reviewedBy: null,
    boardMeetingDate: null,
    secretaryName: null,
    decisionReason: null,
    submittedIp: null,
    submittedUserAgent: null,
    beneficiaries: [],
    documents: [],
    requirements: [
      {
        id: "10",
        applicationId: "1",
        requirementType: "Orientation/Seminar",
        requirementStatus: "Verified",
        paymentReferenceId: null,
        documentId: null,
        completionDate: "2026-07-24",
        verifiedBy: "1",
        verifiedAt: new Date("2026-07-24T08:10:00.000Z"),
        remarks: null,
      },
    ],
    history: [],
  };
}

class FakeChairmanService {
  status: MembershipApplicationStatus = "Submitted";
  approvalFailure:
    | "orientation"
    | "fee"
    | "trueBelow"
    | "conflict"
    | "repeat"
    | "maxCapital"
    | null = null;
  lastUpdate: ChairmanMembershipApplicationUpdateInput | null = null;
  lastQuery: ChairmanApplicationListQuery | null = null;

  async submitPublicApplication() {
    throw new Error("not used");
  }
  async getPublicStatus() {
    throw new Error("not used");
  }
  async uploadPublicDocument() {
    throw new Error("not used");
  }
  async summary() {
    return { total: 1, submitted: 1, underReview: 0, needsInformation: 0, approved: 0, rejected: 0, withdrawn: 0 };
  }
  async list(query: ChairmanApplicationListQuery) {
    this.lastQuery = query;
    return { applications: [detail(this.status)], total: 1, page: query.page, pageSize: query.pageSize };
  }
  async createChairmanApplication() {
    return detail("Submitted");
  }
  async getChairmanApplication() {
    return detail(this.status);
  }
  async updateApplication(_id: string, input: ChairmanMembershipApplicationUpdateInput) {
    this.lastUpdate = input;
    const updated = { ...detail(this.status), ...input };
    return { ...updated, fullName: applicationFullName(updated) };
  }
  async createBeneficiary(_id: string, input: MembershipApplicationBeneficiaryInput & { displayOrder?: number }) {
    return { id: "2", applicationId: "1", displayOrder: input.displayOrder ?? 0, ...input };
  }
  async updateBeneficiary(_id: string, input: Partial<MembershipApplicationBeneficiaryInput> & { displayOrder?: number }) {
    return { id: "2", applicationId: "1", fullName: input.fullName ?? "Ana Santos", relationship: input.relationship ?? null, ageAtApplication: input.ageAtApplication ?? 9, birthDate: input.birthDate ?? null, displayOrder: input.displayOrder ?? 0 };
  }
  async deleteBeneficiary() {}
  async uploadChairmanDocument() {
    return { id: "3", applicationId: "1", documentType: "Valid ID", originalFileName: "valid-id.pdf", mimeType: "application/pdf", fileSizeBytes: 12, checksumSha256: "hash", uploadedByUserId: "1", uploadedAt: new Date("2026-07-24T08:10:00.000Z") };
  }
  async deleteDocument() {}
  async createRequirement(_id: string, input: RequirementInput) {
    return { id: "4", applicationId: "1", requirementType: input.requirementType, requirementStatus: input.requirementStatus ?? "Pending", paymentReferenceId: input.paymentReferenceId ?? null, documentId: input.documentId ?? null, completionDate: input.completionDate ?? null, verifiedBy: "1", verifiedAt: new Date("2026-07-24T08:10:00.000Z"), remarks: input.remarks ?? null };
  }
  async updateRequirement(id: string, input: RequirementUpdateInput) {
    return { id, applicationId: "1", requirementType: "Orientation/Seminar", requirementStatus: input.requirementStatus ?? "Pending", paymentReferenceId: input.paymentReferenceId ?? null, documentId: input.documentId ?? null, completionDate: input.completionDate ?? null, verifiedBy: "1", verifiedAt: new Date("2026-07-24T08:10:00.000Z"), remarks: input.remarks ?? null };
  }
  async history() {
    return detail(this.status).history;
  }
  async startReview() {
    if (this.status !== "Submitted" && this.status !== "Needs Information") {
      throw new AppError("Invalid transition", 409, "MEMBERSHIP_APPLICATION_STATUS_INVALID");
    }
    this.status = "Under Review";
    return detail(this.status);
  }
  async requestInformation(_id: string, input: StatusTransitionInput) {
    if (!input.reason && !input.applicantMessage && !input.internalNote) {
      throw new AppError("Reason required", 400, "MEMBERSHIP_APPLICATION_REASON_REQUIRED");
    }
    this.status = "Needs Information";
    return detail(this.status);
  }
  async reject() {
    this.status = "Rejected";
    return detail(this.status);
  }
  async withdraw() {
    this.status = "Withdrawn";
    return detail(this.status);
  }
  async approve(_id: string, input: ApprovalInput) {
    const failures = {
      orientation: ["Orientation must be verified before approval", "MEMBERSHIP_ORIENTATION_INCOMPLETE"],
      fee: ["The PHP 200 associate membership fee has not been validated", "MEMBERSHIP_FEE_INCOMPLETE"],
      trueBelow: ["At least PHP 1,500 validated initial share capital is required", "INITIAL_SHARE_CAPITAL_INCOMPLETE"],
      conflict: ["A conflicting user account already exists", "MEMBERSHIP_ACCOUNT_CONFLICT"],
      repeat: ["This application has already been converted to a member profile", "MEMBERSHIP_APPLICATION_ALREADY_CONVERTED"],
      maxCapital: ["Validated share capital cannot exceed PHP 15,000", "SHARE_CAPITAL_MAXIMUM_EXCEEDED"],
    } as const;
    if (this.approvalFailure) {
      const [message, code] = failures[this.approvalFailure];
      throw new AppError(message, 409, code);
    }
    this.status = "Approved";
    return {
      applicationId: "1",
      applicationCode: "MEM-APP-2026-000001",
      memberId: "5",
      memberCode: "NFFAC-2026-000005",
      membershipType: "Associate",
      shareCapitalDeadline: "2027-07-24",
      activationUrl: input.createMemberPortalAccount ? "http://localhost:3000/activate?token=secret" : null,
      activationTokenExpiresAt: input.createMemberPortalAccount ? new Date("2026-07-27T08:00:00.000Z") : null,
    };
  }
  async printablePdf() {
    return Buffer.from("%PDF-1.4\n%test\n");
  }
}

function createChairmanApp(role: RoleSlug, service = new FakeChairmanService()) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use((request, _response, next) => {
    request.requestId = "test-request";
    next();
  });
  app.use("/api", createMembershipApplicationRouter(createAuthService(role), service as unknown as MembershipApplicationService));
  app.use(errorHandler);
  return { app, service };
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

test("Chairman membership application endpoints reject Bookkeeper and Member roles", async () => {
  for (const role of ["bookkeeper", "member"] as const) {
    const { app } = createChairmanApp(role);
    const response = await request(app)
      .get("/api/membership-applications")
      .set("Cookie", "trackcoop_session=opaque-cookie-value");

    assert.equal(response.status, 403);
    assert.equal(response.body.errors[0].code, "FORBIDDEN");
  }
});

test("GET /api/membership-applications returns Chairman application list with paging metadata", async () => {
  const { app, service } = createChairmanApp("chairman");
  const response = await request(app)
    .get("/api/membership-applications?page=2&pageSize=5&status=Submitted")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].applicationCode, "MEM-APP-2026-000001");
  assert.equal(response.body.meta.total, 1);
  assert.equal(service.lastQuery?.page, 2);
  assert.equal(service.lastQuery?.status, "Submitted");
});

test("GET and PATCH /api/membership-applications/:id support Chairman detail and update", async () => {
  const { app, service } = createChairmanApp("chairman");
  const detailResponse = await request(app)
    .get("/api/membership-applications/1")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.data.fullName, "Maria Santos");

  const updateResponse = await request(app)
    .patch("/api/membership-applications/1")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({ firstName: "Maria", middleName: "R.", lastName: "Santos", contactNumber: "0917 000 0000" });

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.data.fullName, "Maria R. Santos");
  assert.equal(service.lastUpdate?.contactNumber, "0917 000 0000");
});

test("Chairman status transitions enforce valid paths and required reasons", async () => {
  const { app, service } = createChairmanApp("chairman");
  const startResponse = await request(app)
    .post("/api/membership-applications/1/start-review")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({});

  assert.equal(startResponse.status, 200);
  assert.equal(startResponse.body.data.applicationStatus, "Under Review");

  const invalidRepeat = await request(app)
    .post("/api/membership-applications/1/start-review")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({});

  assert.equal(invalidRepeat.status, 409);
  assert.equal(invalidRepeat.body.errors[0].code, "MEMBERSHIP_APPLICATION_STATUS_INVALID");

  service.status = "Under Review";
  const missingReason = await request(app)
    .post("/api/membership-applications/1/request-information")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({});

  assert.equal(missingReason.status, 400);
  assert.equal(missingReason.body.errors[0].code, "MEMBERSHIP_APPLICATION_REASON_REQUIRED");
});

test("PATCH /api/membership-application-requirements/:id verifies requirements", async () => {
  const { app } = createChairmanApp("chairman");
  const response = await request(app)
    .patch("/api/membership-application-requirements/10")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({ requirementStatus: "Verified", completionDate: "2026-07-24" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.requirementStatus, "Verified");
});

test("POST /api/membership-application-requirements/:id rejects waived requirements without a reason", async () => {
  const { app } = createChairmanApp("chairman");
  const response = await request(app)
    .patch("/api/membership-application-requirements/10")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({ requirementStatus: "Waived" });

  assert.equal(response.status, 400);
  assert.equal(response.body.errors[0].field, "remarks");
});

test("POST /api/membership-applications/:id/approve returns member conversion and activation URL", async () => {
  const { app } = createChairmanApp("chairman");
  const response = await request(app)
    .post("/api/membership-applications/1/approve")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({
      boardMeetingDate: "2026-07-24",
      secretaryName: "Coop Secretary",
      decisionReason: "Accepted by the board.",
      createMemberPortalAccount: true,
      accountEmail: "maria@example.test",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.memberCode, "NFFAC-2026-000005");
  assert.equal(response.body.data.membershipType, "Associate");
  assert.match(response.body.data.activationUrl, /activate\?token=/);
});

test("POST /api/membership-applications/:id/approve can convert without creating a portal account", async () => {
  const { app } = createChairmanApp("chairman");
  const response = await request(app)
    .post("/api/membership-applications/1/approve")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({
      boardMeetingDate: "2026-07-24",
      secretaryName: "Coop Secretary",
      decisionReason: "Accepted by the board.",
      createMemberPortalAccount: false,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.memberCode, "NFFAC-2026-000005");
  assert.equal(response.body.data.activationUrl, null);
  assert.equal(response.body.data.activationTokenExpiresAt, null);
});

test("POST /api/membership-applications/:id/approve blocks invalid approval cases", async () => {
  for (const [failure, code] of [
    ["orientation", "MEMBERSHIP_ORIENTATION_INCOMPLETE"],
    ["fee", "MEMBERSHIP_FEE_INCOMPLETE"],
    ["trueBelow", "INITIAL_SHARE_CAPITAL_INCOMPLETE"],
    ["conflict", "MEMBERSHIP_ACCOUNT_CONFLICT"],
    ["repeat", "MEMBERSHIP_APPLICATION_ALREADY_CONVERTED"],
    ["maxCapital", "SHARE_CAPITAL_MAXIMUM_EXCEEDED"],
  ] as const) {
    const service = new FakeChairmanService();
    service.approvalFailure = failure;
    const { app } = createChairmanApp("chairman", service);

    const response = await request(app)
      .post("/api/membership-applications/1/approve")
      .set("Cookie", "trackcoop_session=opaque-cookie-value")
      .send({
        boardMeetingDate: "2026-07-24",
        secretaryName: "Coop Secretary",
        decisionReason: "Accepted by the board.",
        createMemberPortalAccount: failure === "conflict",
        accountEmail: "maria@example.test",
      });

    assert.equal(response.status, 409);
    assert.equal(response.body.errors[0].code, code);
  }
});

test("GET /api/membership-applications/:id/print returns a protected PDF response", async () => {
  const { app } = createChairmanApp("chairman");
  const response = await request(app)
    .get("/api/membership-applications/1/print")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/pdf");
  assert.match(response.headers["content-disposition"], /membership-application-1\.pdf/);
});
