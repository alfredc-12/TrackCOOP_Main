import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  createUserRepository,
  type UserRepository,
} from "./user.repository";
import type {
  ActivationLinkResult,
  CreateUserInput,
  LinkableMember,
  UpdateUserInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
  UserDetail,
  UserListQuery,
  UserSummaryCounts,
  UserMutationResult,
} from "./user.types";

export interface UserService {
  listUsers(query: UserListQuery): ReturnType<UserRepository["list"]>;
  getUser(userId: string): Promise<UserDetail | null>;
  getSummary(): Promise<UserSummaryCounts>;
  listRoles(): ReturnType<UserRepository["listRoles"]>;
  listLinkableMembers(query: { search?: string; pageSize: number }): Promise<LinkableMember[]>;
  createUser(input: CreateUserInput, auth: AuthContext): Promise<UserMutationResult>;
  updateUser(userId: string, input: UpdateUserInput, auth: AuthContext): ReturnType<UserRepository["update"]>;
  updateStatus(userId: string, input: UpdateUserStatusInput, auth: AuthContext): ReturnType<UserRepository["updateStatus"]>;
  updateRole(userId: string, input: UpdateUserRoleInput, auth: AuthContext): ReturnType<UserRepository["updateRole"]>;
  issueActivationLink(userId: string, reason: string, auth: AuthContext): Promise<ActivationLinkResult>;
  revokeSession(userId: string, sessionId: string, reason: string, auth: AuthContext): Promise<UserDetail>;
  revokeAllSessions(userId: string, reason: string, auth: AuthContext): Promise<UserDetail>;
  linkMember(userId: string, memberId: string, reason: string, auth: AuthContext): Promise<UserDetail>;
  unlinkMember(userId: string, reason: string, auth: AuthContext): Promise<UserDetail>;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function activationUrl(rawToken: string) {
  return `${env.FRONTEND_URL.replace(/\/$/, "")}/activate?token=${encodeURIComponent(rawToken)}`;
}

async function createActivation(repository: UserRepository) {
  const rawToken = randomBytes(32).toString("base64url");
  const hours = await repository.activationTokenHours();
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  return {
    rawToken,
    tokenHash: hashToken(rawToken),
    expiresAt,
    activationUrl: activationUrl(rawToken),
  };
}

export function createUserService(
  repository: UserRepository = createUserRepository(),
): UserService {
  return {
    listUsers(query) {
      return repository.list(query);
    },

    getUser(userId) {
      return repository.findById(userId);
    },

    getSummary() {
      return repository.summary();
    },

    listRoles() {
      return repository.listRoles();
    },

    listLinkableMembers(query) {
      return repository.listLinkableMembers(query);
    },

    async createUser(input, auth) {
      if (input.role === "chairman" && auth.user.role !== "chairman") {
        throw new AppError(
          "Only the Chairman may create Chairman accounts",
          403,
          "FORBIDDEN",
        );
      }

      const activation = input.issueActivationLink
        ? await createActivation(repository)
        : null;
      const passwordHash = await hash(
        input.password ?? `unusable-${randomUUID()}-${randomBytes(32).toString("hex")}`,
        env.BCRYPT_ROUNDS,
      );

      return repository.create({
        ...input,
        accountStatus: activation ? "Pending" : input.accountStatus,
        passwordHash,
        createdBy: auth.user.id,
        activationTokenHash: activation?.tokenHash,
        activationTokenExpiresAt: activation?.expiresAt,
        activationUrl: activation?.activationUrl,
      });
    },

    updateUser(userId, input, auth) {
      return repository.update(userId, input, auth);
    },

    async updateStatus(userId, input, auth) {
      if (userId === auth.user.id && input.accountStatus !== "Active") {
        const existing = await repository.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");

        if (input.selfConfirmation !== existing.displayName) {
          throw new AppError(
            "Type your display name to confirm changes to your own account",
            400,
            "SELF_STATUS_CONFIRMATION_REQUIRED",
          );
        }
      }

      return repository.updateStatus(userId, input, auth);
    },

    updateRole(userId, input, auth) {
      if (userId === auth.user.id && input.role !== "chairman") {
        throw new AppError(
          "You cannot remove your own Chairman role",
          400,
          "SELF_ROLE_CHANGE_DENIED",
        );
      }

      return repository.updateRole(userId, input, auth);
    },

    async issueActivationLink(userId, reason, auth) {
      const activation = await createActivation(repository);
      return repository.issueActivationLink(
        userId,
        {
          tokenHash: activation.tokenHash,
          expiresAt: activation.expiresAt,
          activationUrl: activation.activationUrl,
          reason,
        },
        auth,
      );
    },

    revokeSession(userId, sessionId, reason, auth) {
      return repository.revokeSession(userId, sessionId, reason, auth);
    },

    revokeAllSessions(userId, reason, auth) {
      return repository.revokeAllSessions(userId, reason, auth);
    },

    linkMember(userId, memberId, reason, auth) {
      return repository.linkMember(userId, memberId, reason, auth);
    },

    unlinkMember(userId, reason, auth) {
      return repository.unlinkMember(userId, reason, auth);
    },
  };
}
