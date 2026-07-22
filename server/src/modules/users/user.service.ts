import { hash } from "bcryptjs";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import type { AuthContext, RoleSlug } from "../auth/auth.types";
import {
  createUserRepository,
  type UserRepository,
} from "./user.repository";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserListQuery,
} from "./user.types";

export interface UserService {
  listUsers(query: UserListQuery): ReturnType<UserRepository["list"]>;
  getUser(userId: string): ReturnType<UserRepository["findById"]>;
  listRoles(): ReturnType<UserRepository["listRoles"]>;
  createUser(input: CreateUserInput, auth: AuthContext): ReturnType<UserRepository["create"]>;
  updateUser(userId: string, input: UpdateUserInput, auth: AuthContext): ReturnType<UserRepository["update"]>;
  updateStatus(userId: string, accountStatus: CreateUserInput["accountStatus"], auth: AuthContext): ReturnType<UserRepository["updateStatus"]>;
  updateRole(userId: string, role: RoleSlug, auth: AuthContext): ReturnType<UserRepository["updateRole"]>;
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

    listRoles() {
      return repository.listRoles();
    },

    async createUser(input, auth) {
      if (input.role === "chairman" && auth.user.role !== "chairman") {
        throw new AppError(
          "Only the Chairman may create Chairman accounts",
          403,
          "FORBIDDEN",
        );
      }

      const passwordHash = await hash(input.password, env.BCRYPT_ROUNDS);

      return repository.create({
        ...input,
        passwordHash,
        createdBy: auth.user.id,
      });
    },

    updateUser(userId, input, auth) {
      return repository.update(userId, input, auth);
    },

    updateStatus(userId, accountStatus, auth) {
      if (userId === auth.user.id && accountStatus !== "Active") {
        throw new AppError(
          "You cannot disable your own active account",
          400,
          "SELF_STATUS_CHANGE_DENIED",
        );
      }

      return repository.updateStatus(userId, accountStatus, auth);
    },

    updateRole(userId, role, auth) {
      if (userId === auth.user.id && role !== "chairman") {
        throw new AppError(
          "You cannot remove your own Chairman role",
          400,
          "SELF_ROLE_CHANGE_DENIED",
        );
      }

      return repository.updateRole(userId, role, auth);
    },
  };
}
