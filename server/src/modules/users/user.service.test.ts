import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { createUserService } from "./user.service";
import type { UserRepository } from "./user.repository";
import type {
  CreateUserInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
  UserDetail,
  UserSummary,
} from "./user.types";

const chairmanAuth: AuthContext = {
  sessionId: "session-1",
  tokenHash: "hash",
  user: {
    id: "1",
    displayName: "Chair Person",
    email: "chair@example.test",
    username: "chair",
    role: "chairman",
  },
};

const userSummary: UserSummary = {
  id: "1",
  displayName: "Chair Person",
  email: "chair@example.test",
  username: "chair",
  role: "chairman",
  accountStatus: "Active",
  lastLoginAt: null,
  createdAt: new Date("2026-07-24T00:00:00.000Z"),
  linkedMemberId: null,
  linkedMemberCode: null,
  linkedMemberName: null,
  activeSessionCount: 1,
  activationTokenExpiresAt: null,
};

const userDetail: UserDetail = {
  ...userSummary,
  sessions: [],
};

function createRepository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    async list() {
      return { users: [userSummary], total: 1, page: 1, pageSize: 10 };
    },
    async summary() {
      return { total: 1, active: 1, pendingActivation: 0, suspendedInactive: 0 };
    },
    async findById() {
      return userDetail;
    },
    async listRoles() {
      return [];
    },
    async listLinkableMembers() {
      return [];
    },
    async create(input: CreateUserInput & {
      passwordHash: string;
      createdBy: string;
      activationTokenHash?: string;
      activationTokenExpiresAt?: Date;
      activationUrl?: string;
    }) {
      return {
        user: {
          ...userSummary,
          id: "2",
          email: input.email,
          username: input.username ?? null,
          displayName: input.displayName,
          role: input.role,
          accountStatus: input.accountStatus,
        },
        activationUrl: input.activationUrl,
        activationTokenExpiresAt: input.activationTokenExpiresAt,
      };
    },
    async update() {
      return userSummary;
    },
    async updateStatus(_userId: string, input: UpdateUserStatusInput) {
      return { ...userSummary, accountStatus: input.accountStatus };
    },
    async updateRole(_userId: string, input: UpdateUserRoleInput) {
      return { ...userSummary, role: input.role };
    },
    async issueActivationLink(_userId, input) {
      return {
        user: { ...userSummary, accountStatus: "Pending" },
        activationUrl: input.activationUrl,
        activationTokenExpiresAt: input.expiresAt,
      };
    },
    async revokeSession() {
      return userDetail;
    },
    async revokeAllSessions() {
      return userDetail;
    },
    async linkMember() {
      return { ...userDetail, role: "member", linkedMemberId: "12" };
    },
    async unlinkMember() {
      return userDetail;
    },
    async activationTokenHours() {
      return 72;
    },
    async hardDeleteUser() {},
    async resetPassword() {},
    async bulkAction() {
      return { count: 0 };
    },
    async getAuditLogs() {
      return [];
    },
    ...overrides,
  };
}

test("self status changes require typing the current display name", async () => {
  const service = createUserService(createRepository());

  await assert.rejects(
    () => service.updateStatus("1", {
      accountStatus: "Suspended",
      reason: "Temporary access review.",
      selfConfirmation: "wrong name",
    }, chairmanAuth),
    (error) => error instanceof AppError && error.code === "SELF_STATUS_CONFIRMATION_REQUIRED",
  );
});

test("chairman cannot remove their own Chairman role", async () => {
  const service = createUserService(createRepository());

  assert.throws(
    () => service.updateRole("1", {
      role: "bookkeeper",
      reason: "Testing self-demotion guard.",
    }, chairmanAuth),
    (error) => error instanceof AppError && error.code === "SELF_ROLE_CHANGE_DENIED",
  );
});

test("activation-link account creation creates pending account without returning a password hash", async () => {
  type CreateCallInput = Parameters<UserRepository["create"]>[0];
  let createdInput: CreateCallInput | undefined;
  const service = createUserService(createRepository({
    async create(input) {
      createdInput = input;
      return {
        user: {
          ...userSummary,
          id: "2",
          displayName: input.displayName,
          email: input.email,
          username: input.username ?? null,
          role: input.role,
          accountStatus: input.accountStatus,
        },
        activationUrl: input.activationUrl,
        activationTokenExpiresAt: input.activationTokenExpiresAt,
      };
    },
  }));

  const result = await service.createUser({
    displayName: "New Member",
    email: "new-member@example.test",
    username: "newmember",
    role: "member",
    accountStatus: "Active",
    issueActivationLink: true,
  }, chairmanAuth);

  assert.equal(result.user.accountStatus, "Pending");
  assert.match(result.activationUrl ?? "", /\/activate\?token=/);
  assert.notEqual(createdInput, undefined);
  const input = createdInput as CreateCallInput;
  assert.ok(input.activationTokenHash);
  assert.ok(!("passwordHash" in result.user));
});
