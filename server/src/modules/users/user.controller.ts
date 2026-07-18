import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserSchema,
  updateUserStatusSchema,
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
  return new AppError(
    "The request payload is invalid",
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
        input.accountStatus,
        request.auth,
      );
      return sendSuccess(response, user, { message: "User account status updated" });
    }),

    role: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(updateUserRoleSchema, request.body);
      const user = await service.updateRole(
        requireParam(request.params.id, "id"),
        input.role,
        request.auth,
      );
      return sendSuccess(response, user, { message: "User role updated" });
    }),
  };
}
