import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { MembershipApplicationRepository } from "./membership-application.repository";
import { createMembershipApplicationService } from "./membership-application.service";
import type { AuthContext } from "../auth/auth.types";
import type {
  ChairmanApplicationDetail,
  ChairmanApplicationRequirement,
  RequirementStatus,
  RequirementType,
} from "./membership-application.types";

const auth: AuthContext = {
  sessionId: "session",
  tokenHash: "hash",
  user: {
    id: "1",
    displayName: "Chair Person",
    email: "chair@example.test",
    username: "chair",
    role: "chairman",
  },
};

function requirement(
  id: string,
  requirementType: RequirementType,
  requirementStatus: RequirementStatus,
): ChairmanApplicationRequirement {
  return {
    id,
    applicationId: "1",
    requirementType,
    requirementStatus,
    paymentReferenceId: null,
    documentId: null,
    completionDate: null,
    verifiedBy: requirementStatus === "Verified" ? "1" : null,
    verifiedAt: requirementStatus === "Verified" ? new Date("2026-07-24T08:00:00.000Z") : null,
    remarks: null,
  };
}

function detail(requirements: ChairmanApplicationRequirement[]): ChairmanApplicationDetail {
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
    applicationStatus: "Under Review",
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
    documents: [{
      id: "20",
      applicationId: "1",
      documentType: "Signed Application",
      originalFileName: "signed.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 100,
      checksumSha256: "hash",
      uploadedByUserId: null,
      uploadedAt: new Date("2026-07-24T08:00:00.000Z"),
    }],
    requirements,
    history: [],
  };
}

function serviceFor(requirements: ChairmanApplicationRequirement[]) {
  let transitioned = false;
  const repository = {
    async findChairmanApplicationById() {
      return detail(requirements);
    },
    async transitionStatus() {
      transitioned = true;
      return { ...detail(requirements), applicationStatus: "Payment Required" };
    },
  } as unknown as MembershipApplicationRepository;

  return {
    service: createMembershipApplicationService(repository),
    didTransition: () => transitioned,
  };
}

async function assertPaymentApprovalRejected(
  requirements: ChairmanApplicationRequirement[],
  expectedMessage: RegExp,
) {
  const { service, didTransition } = serviceFor(requirements);

  await assert.rejects(
    () => service.approveForPayment("1", {}, auth),
    (error) =>
      error instanceof AppError
      && error.code === "MEMBERSHIP_PRE_PAYMENT_REQUIREMENT_INCOMPLETE"
      && expectedMessage.test(error.message),
  );
  assert.equal(didTransition(), false);
}

test("approve for payment fails when Signed Application is still pending even if a file exists", async () => {
  await assertPaymentApprovalRejected([
    requirement("10", "Orientation/Seminar", "Verified"),
    requirement("11", "Signed Application", "Pending"),
    requirement("12", "Associate Membership Fee", "Pending"),
    requirement("13", "Initial Share Capital", "Pending"),
  ], /Signed Application/);
});

test("approve for payment fails when another pre-payment requirement is rejected", async () => {
  await assertPaymentApprovalRejected([
    requirement("10", "Orientation/Seminar", "Verified"),
    requirement("11", "Signed Application", "Verified"),
    requirement("12", "Valid ID", "Rejected"),
    requirement("13", "Associate Membership Fee", "Pending"),
  ], /Valid ID/);
});

test("approve for payment succeeds when pre-payment requirements are verified or waived", async () => {
  const { service, didTransition } = serviceFor([
    requirement("10", "Orientation/Seminar", "Pending"),
    requirement("11", "Signed Application", "Verified"),
    requirement("12", "Valid ID", "Verified"),
    requirement("13", "Associate Membership Fee", "Pending"),
    requirement("14", "Initial Share Capital", "Pending"),
  ]);

  const result = await service.approveForPayment("1", {}, auth);

  assert.equal(result.applicationStatus, "Payment Required");
  assert.equal(didTransition(), true);
});

test("orientation seminar does not block approve for payment", async () => {
  const { service, didTransition } = serviceFor([
    requirement("10", "Orientation/Seminar", "Pending"),
    requirement("11", "Signed Application", "Verified"),
    requirement("12", "Associate Membership Fee", "Pending"),
    requirement("13", "Initial Share Capital", "Pending"),
  ]);

  await service.approveForPayment("1", {}, auth);

  assert.equal(didTransition(), true);
});

test("payment requirements do not block approve for payment", async () => {
  const { service, didTransition } = serviceFor([
    requirement("10", "Orientation/Seminar", "Verified"),
    requirement("11", "Signed Application", "Verified"),
    requirement("12", "Associate Membership Fee", "Rejected"),
    requirement("13", "Initial Share Capital", "Pending"),
  ]);

  await service.approveForPayment("1", {}, auth);

  assert.equal(didTransition(), true);
});
