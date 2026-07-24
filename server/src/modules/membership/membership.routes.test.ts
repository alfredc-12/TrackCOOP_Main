import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../app";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, AuthUser } from "../auth/auth.types";
import type { MembershipService } from "./membership.service";
import { membershipRules, validStatusTransitions } from "./membership.types";

const frontendUrl = "http://localhost:3000";

function user(role: AuthUser["role"]): AuthUser {
  return {
    id: role === "chairman" ? "1" : role === "bookkeeper" ? "2" : "3",
    displayName: role,
    email: `${role}@example.test`,
    username: role,
    role,
  };
}

function authService(): AuthService {
  return {
    async login() {
      throw new Error("not used");
    },
    async authenticate(rawToken) {
      const role =
        rawToken === "chairman"
          ? "chairman"
          : rawToken === "bookkeeper"
            ? "bookkeeper"
            : "member";
      const authUser = user(role);
      return {
        user: authUser,
        sessionId: "10",
        tokenHash: "hash",
      } satisfies AuthContext;
    },
    async logout() {},
    async listSessions() {
      return [];
    },
    async revokeSession() {},
  };
}

function membershipService(
  overrides: Partial<MembershipService> = {},
): MembershipService {
  return {
    async submitApplication(input) {
      return {
        id: "7",
        reference: "MEM-APP-2026-0007",
        fullName: `${input.firstName} ${input.lastName}`,
        status: "SUBMITTED",
      } as never;
    },
    async lookupApplication() {
      return { reference: "MEM-APP-2026-0007", status: "SUBMITTED" };
    },
    async submitAdditionalInformation() {
      throw new Error("not used");
    },
    async listApplications() {
      return [];
    },
    async getApplication() {
      return {};
    },
    async getApplicationDocument() {
      return null;
    },
    async reviewApplication(id, input, auth) {
      return { id, action: input.action, reviewer: auth.user.role } as never;
    },
    async submitPayment() {
      throw new Error("not used");
    },
    async listPayments() {
      return [];
    },
    async getPaymentProof() {
      return null;
    },
    async validatePayment(id, decision, _note, auth) {
      return { id, decision, validator: auth.user.role } as never;
    },
    async createAccount() {
      throw new Error("not used");
    },
    async activateAccount() {},
    ...overrides,
  };
}

const validApplication = {
  idempotencyKey: "5c6f0f62-90e5-4a47-8f85-778789bf5898",
  firstName: "Ana",
  middleName: "",
  lastName: "Dela Cruz",
  suffix: "",
  contactNumber: "+63 917 123 4567",
  email: "ana@example.test",
  preferredContactMethod: "SMS",
  completeAddress: "Sitio Uno",
  barangay: "Wawa",
  municipality: "Nasugbu",
  province: "Batangas",
  sector: "Farmer",
  livelihood: "Rice farming",
  applicantClassification: "Farmer",
  primaryActivity: "Rice",
  preferredMembershipType: "ASSOCIATE",
  consentAccuracy: true,
  consentPrivacy: true,
  consentNoImmediateMembership: true,
  consentAccountAfterApproval: true,
  privacyNoticeVersion: "2026-07-24",
};

test("confirmed membership amounts remain paper-aligned", () => {
  assert.equal(membershipRules.associateFee, 200);
  assert.equal(membershipRules.trueMemberInitialPayment, 1500);
  assert.equal(membershipRules.shareValue, 3000);
  assert.equal(membershipRules.maximumShareCapital, 15000);
  assert.equal(membershipRules.completionPeriodMonths, 12);
});

test("rejected applications cannot transition to account creation", () => {
  assert.deepEqual(validStatusTransitions.REJECTED, []);
  assert.equal(
    validStatusTransitions.APPROVED.includes("ACCOUNT_PENDING_ACTIVATION"),
    true,
  );
});

test("public applicant can submit without an account", async () => {
  const response = await request(
    createApp({
      authService: authService(),
      membershipService: membershipService(),
      enableRequestLogging: false,
      frontendUrl,
    }),
  )
    .post("/api/public/membership/applications")
    .set("Origin", frontendUrl)
    .field("payload", JSON.stringify(validApplication))
    .field("documentTypes", "[]");

  assert.equal(response.status, 201);
  assert.equal(response.body.data.reference, "MEM-APP-2026-0007");
});

test("bookkeeper cannot approve a membership application", async () => {
  const response = await request(
    createApp({
      authService: authService(),
      membershipService: membershipService(),
      enableRequestLogging: false,
      frontendUrl,
    }),
  )
    .post("/api/membership/applications/7/review")
    .set("Origin", frontendUrl)
    .set("Cookie", "trackcoop_session=bookkeeper")
    .send({
      action: "APPROVE",
      approvedMembershipType: "ASSOCIATE",
      publicMessage: "Approved.",
    });

  assert.equal(response.status, 403);
});

test("chairman can approve and bookkeeper can validate payment", async () => {
  const app = createApp({
    authService: authService(),
    membershipService: membershipService(),
    enableRequestLogging: false,
    frontendUrl,
  });
  const approval = await request(app)
    .post("/api/membership/applications/7/review")
    .set("Origin", frontendUrl)
    .set("Cookie", "trackcoop_session=chairman")
    .send({
      action: "APPROVE",
      approvedMembershipType: "TRUE_MEMBER",
      publicMessage: "Approved pending payment.",
    });
  const validation = await request(app)
    .post("/api/membership/payments/9/validate")
    .set("Origin", frontendUrl)
    .set("Cookie", "trackcoop_session=bookkeeper")
    .send({ decision: "VERIFIED", note: "Reference and proof matched." });

  assert.equal(approval.status, 200);
  assert.equal(approval.body.data.reviewer, "chairman");
  assert.equal(validation.status, 200);
  assert.equal(validation.body.data.validator, "bookkeeper");
});
