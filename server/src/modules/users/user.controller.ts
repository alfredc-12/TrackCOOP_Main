import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  createUserSchema,
  issueActivationLinkSchema,
  linkMemberSchema,
  listLinkableMembersQuerySchema,
  listUsersQuerySchema,
  revokeSessionSchema,
  unlinkMemberSchema,
  updateUserRoleSchema,
  updateUserSchema,
  updateUserStatusSchema,
  deleteUserSchema,
  resetUserPasswordSchema,
  bulkUserActionSchema,
} from "./user.schema";
import type { UserService } from "./user.service";

function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw validationError(result.error);
  }

  return result.data;
}

function validationError(error: ZodError) {
  const details = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
  return new AppError(
    `The request payload is invalid: ${details}`,
    400,
    "VALIDATION_ERROR",
    error.issues.map((issue) => ({
      code: "VALIDATION_ERROR",
      field: issue.path.join("."),
      message: issue.message,
    })),
  );
}

function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) {
    throw new AppError(`Route parameter ${name} is required`, 400, "ROUTE_PARAM_REQUIRED");
  }

  return value;
}

export function createUserController(service: UserService) {
  return {
    list: asyncHandler(async (request, response) => {
      const query = parseBody(listUsersQuerySchema, request.query);
      const result = await service.listUsers(query);
      return sendSuccess(response, result.users, {
        meta: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
      });
    }),

    roles: asyncHandler(async (_request, response) => {
      const roles = await service.listRoles();
      return sendSuccess(response, roles);
    }),

    summary: asyncHandler(async (request, response) => {
      const query = parseBody(listUsersQuerySchema.pick({ includeHidden: true }), request.query);
      const summary = await service.getSummary(query);
      return sendSuccess(response, summary);
    }),

    linkableMembers: asyncHandler(async (request, response) => {
      const query = parseBody(listLinkableMembersQuerySchema, request.query);
      const members = await service.listLinkableMembers(query);
      return sendSuccess(response, members);
    }),

    create: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(createUserSchema, request.body);
      const user = await service.createUser(input, request.auth);
      return sendSuccess(response, user, {
        statusCode: 201,
        message: "User account created",
      });
    }),

    detail: asyncHandler(async (request, response) => {
      const user = await service.getUser(requireParam(request.params.id, "id"));

      if (!user) {
        throw new AppError("User was not found", 404, "USER_NOT_FOUND");
      }

      return sendSuccess(response, user);
    }),

    update: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(updateUserSchema, request.body);
      const user = await service.updateUser(
        requireParam(request.params.id, "id"),
        input,
        request.auth,
      );
      return sendSuccess(response, user, { message: "User account updated" });
    }),

    status: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(updateUserStatusSchema, request.body);
      const user = await service.updateStatus(
        requireParam(request.params.id, "id"),
        input,
        request.auth,
      );
      return sendSuccess(response, user, { message: "User account status updated" });
    }),

    role: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(updateUserRoleSchema, request.body);
      const user = await service.updateRole(
        requireParam(request.params.id, "id"),
        input,
        request.auth,
      );
      return sendSuccess(response, user, { message: "User role updated" });
    }),

    activationLink: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(issueActivationLinkSchema, request.body);
      const result = await service.issueActivationLink(
        requireParam(request.params.id, "id"),
        input.reason,
        request.auth,
      );
      return sendSuccess(response, result, { message: "Activation link issued" });
    }),

    revokeSession: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(revokeSessionSchema, request.body);
      const user = await service.revokeSession(
        requireParam(request.params.id, "id"),
        requireParam(request.params.sessionId, "sessionId"),
        input.reason,
        request.auth,
      );
      return sendSuccess(response, user, { message: "User session revoked" });
    }),

    revokeAllSessions: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(revokeSessionSchema, request.body);
      const user = await service.revokeAllSessions(
        requireParam(request.params.id, "id"),
        input.reason,
        request.auth,
      );
      return sendSuccess(response, user, { message: "User sessions revoked" });
    }),

    linkMember: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(linkMemberSchema, request.body);
      const user = await service.linkMember(
        requireParam(request.params.id, "id"),
        input.memberId,
        input.reason,
        request.auth,
      );
      return sendSuccess(response, user, { message: "Member profile linked" });
    }),

    unlinkMember: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(unlinkMemberSchema, request.body);
      const user = await service.unlinkMember(
        requireParam(request.params.id, "id"),
        input.reason,
        request.auth,
      );
      return sendSuccess(response, user, { message: "Member profile unlinked" });
    }),

    deleteUser: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(deleteUserSchema, request.body);
      await service.deleteUser(
        requireParam(request.params.id, "id"),
        input.reason,
        input.selfConfirmation,
        request.auth,
      );
      return sendSuccess(response, null, { message: "User account deleted" });
    }),

    resetPassword: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(resetUserPasswordSchema, request.body);
      await service.resetPassword(
        requireParam(request.params.id, "id"),
        input.password,
        input.reason,
        request.auth,
      );
      return sendSuccess(response, null, {
        message: "Password has been successfully reset.",
      });
    }),

    exportCsv: asyncHandler(async (request, response) => {
      const query = parseBody(listUsersQuerySchema, request.query);
      const csvString = await service.exportUsersCsv(query);
      response.setHeader("Content-Type", "text/csv");
      response.setHeader("Content-Disposition", `attachment; filename="users-export-${new Date().toISOString().split("T")[0]}.csv"`);
      return response.status(200).send(csvString);
    }),

    bulkAction: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(bulkUserActionSchema, request.body);
      const result = await service.bulkAction(input, request.auth);
      return sendSuccess(response, result, {
        message: `Successfully processed ${result.count} users`,
      });
    }),

    auditLogs: asyncHandler(async (request, response) => {
      const userId = requireParam(request.params.id, "id");
      const logs = await service.getAuditLogs(userId);
      return sendSuccess(response, logs);
    }),
  };
}
