import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { createMemberService } from "./member.service";
import type { MemberRepository } from "./member.repository";
import type { MemberProfile } from "./member.types";

const member: MemberProfile = {
  id: "10",
  userId: null,
  memberCode: "NFFAC-001",
  fullName: "Sample Member",
  contactNumber: null,
  email: null,
  barangay: "Palico",
  municipality: "Nasugbu",
  province: "Batangas",
  sector: "Farming",
  membershipType: "Associate",
  approvalStatus: "Pending",
  officialMemberStatus: "Pending",
  applicationDate: null,
  approvedBy: null,
  approvedAt: null,
  trueMemberSince: null,
  shareCapitalDeadline: null,
  notes: null,
  createdAt: new Date("2026-07-18T00:00:00.000Z"),
  updatedAt: new Date("2026-07-18T00:00:00.000Z"),
};

const auth: AuthContext = {
  sessionId: "1",
  tokenHash: "hash",
  user: {
    id: "1",
    displayName: "Chair Person",
    email: "chair@example.test",
    username: "chair",
    role: "chairman",
  },
};

function createRepository(overrides: Partial<MemberRepository> = {}): MemberRepository {
  return {
    async list() {
      return { members: [], total: 0, page: 1, pageSize: 20 };
    },
    async findById() {
      return member;
    },
    async create() {
      return member;
    },
    async update() {
      return member;
    },
    async updateApproval() {
      return member;
    },
    async updateStatus() {
      return member;
    },
    async history() {
      return [];
    },
    async summary() {
      return {
        total: 0,
        pendingApproval: 0,
        approved: 0,
        associate: 0,
        trueMember: 0,
        active: 0,
        inactive: 0,
        suspended: 0,
      };
    },
    async barangayDistribution() {
      return [];
    },
    ...overrides,
  };
}

test("updateStatus rejects unchanged membership and official status", async () => {
  const service = createMemberService(createRepository());

  await assert.rejects(
    () =>
      service.updateStatus(
        member.id,
        {
          membershipType: "Associate",
          officialMemberStatus: "Pending",
          reason: "No actual change",
        },
        auth,
      ),
    (error) =>
      error instanceof AppError && error.code === "MEMBER_STATUS_UNCHANGED",
  );
});

test("updateStatus delegates actual changes to the repository", async () => {
  let delegated = false;
  const service = createMemberService(
    createRepository({
      async updateStatus() {
        delegated = true;
        return { ...member, officialMemberStatus: "Active" };
      },
    }),
  );

  const updated = await service.updateStatus(
    member.id,
    { officialMemberStatus: "Active", reason: "Approved by chairman" },
    auth,
  );

  assert.equal(delegated, true);
  assert.equal(updated.officialMemberStatus, "Active");
});
