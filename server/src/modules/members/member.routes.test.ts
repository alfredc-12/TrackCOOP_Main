import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, AuthUser, RoleSlug } from "../auth/auth.types";
import { createMemberRouter } from "./member.routes";
import type { MemberService } from "./member.service";
import type { MemberDetail } from "./member.types";

const chairman: AuthUser = {
  id: "1",
  displayName: "Chair Person",
  email: "chair@example.test",
  username: "chair",
  role: "chairman",
};

const memberDetail: MemberDetail = {
  id: "10",
  userId: "20",
  linkedUserEmail: "member@example.test",
  linkedUserUsername: "memberuser",
  linkedUserStatus: "Active",
  linkedUserRole: "member",
  memberCode: "NFFAC-2026-000010",
  fullName: "Sample Member",
  contactNumber: "09170000000",
  email: "member@example.test",
  barangay: "Palico",
  municipality: "Nasugbu",
  province: "Batangas",
  sector: "Farming",
  membershipType: "Associate",
  approvalStatus: "Approved",
  officialMemberStatus: "Active",
  applicationDate: new Date("2026-07-01T00:00:00.000Z"),
  approvedBy: "1",
  approvedAt: new Date("2026-07-02T00:00:00.000Z"),
  trueMemberSince: null,
  shareCapitalDeadline: new Date("2027-07-01T00:00:00.000Z"),
  notes: null,
  createdAt: new Date("2026-07-02T00:00:00.000Z"),
  updatedAt: new Date("2026-07-02T00:00:00.000Z"),
  shareCapital: {
    validatedTotal: 3000,
    pendingTotal: 500,
    validatedPayments: 2,
    fullRequirement: 3000,
    maximumAllowed: 15000,
    remainingToFull: 0,
    remainingAllowed: 12000,
    fullRequirementMet: true,
  },
  recentPayments: [],
  recentPosActivity: [],
  recentRentalActivity: [],
  latestIndicator: null,
  statusHistory: [],
};

function createAuthService(role: RoleSlug): AuthService {
  const auth: AuthContext = {
    sessionId: "1",
    tokenHash: "hash",
    user: { ...chairman, role },
  };

  return {
    async login() {
      throw new Error("not used");
    },
    async authenticate(rawToken) {
      if (!rawToken) throw new Error("missing token");
      return auth;
    },
    async logout() {},
    async listSessions() {
      return [];
    },
    async revokeSession() {},
  };
}

function createMemberService(): MemberService {
  return {
    async listMembers(query) {
      return { members: [memberDetail], total: 1, page: query.page, pageSize: query.pageSize };
    },
    async getMember() {
      return memberDetail;
    },
    async createMember() {
      return memberDetail;
    },
    async updateMember() {
      return memberDetail;
    },
    async updateApproval() {
      return memberDetail;
    },
    async updateStatus(_memberId, input) {
      return {
        ...memberDetail,
        membershipType: input.membershipType ?? memberDetail.membershipType,
        officialMemberStatus: input.officialMemberStatus ?? memberDetail.officialMemberStatus,
      };
    },
    async statusHistory() {
      return [];
    },
    async unifiedStatusHistory(query) {
      return {
        entries: [
          {
            id: "member-1",
            sourceModule: "Member",
            subjectId: "10",
            subjectCode: "NFFAC-2026-000010",
            subjectName: "Sample Member",
            oldStatus: "Associate / Active",
            newStatus: "True Member / Active",
            reason: "Capital requirement met.",
            actor: "Chair Person",
            changedAt: new Date("2026-07-24T00:00:00.000Z"),
          },
        ],
        total: 1,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
    async summary() {
      return {
        total: 1,
        pendingApproval: 0,
        approved: 1,
        associate: 1,
        trueMember: 0,
        active: 1,
        inactive: 0,
        suspended: 0,
      };
    },
    async barangayDistribution() {
      return [];
    },
  };
}

function createApp(role: RoleSlug) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use((request, _response, next) => {
    request.requestId = "test-request";
    next();
  });
  app.use("/api", createMemberRouter(createAuthService(role), createMemberService()));
  app.use(errorHandler);
  return app;
}

test("GET /api/members/:id returns Phase 7 member detail", async () => {
  const response = await request(createApp("chairman"))
    .get("/api/members/10")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.equal(response.body.data.shareCapital.validatedTotal, 3000);
  assert.equal(response.body.data.linkedUserEmail, "member@example.test");
});

test("PATCH /api/members/:id/status requires reason and confirmation", async () => {
  const response = await request(createApp("chairman"))
    .patch("/api/members/10/status")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({ membershipType: "True Member", reason: "Capital requirement met." });

  assert.equal(response.status, 400);
  assert.equal(response.body.errors[0].code, "VALIDATION_ERROR");
});

test("PATCH /api/members/:id/status accepts confirmed lifecycle changes", async () => {
  const response = await request(createApp("chairman"))
    .patch("/api/members/10/status")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({
      membershipType: "True Member",
      officialMemberStatus: "Active",
      reason: "Capital requirement met.",
      confirmation: "Sample Member",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.membershipType, "True Member");
});

test("GET /api/members/status-history returns unified history", async () => {
  const response = await request(createApp("chairman"))
    .get("/api/members/status-history?sourceModule=Member")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].sourceModule, "Member");
  assert.equal(response.body.meta.total, 1);
});

test("Member directory endpoints reject non-chairman roles", async () => {
  const response = await request(createApp("member"))
    .get("/api/members/status-history")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 403);
});
