import type { Request } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import type { AuthContext } from "../auth/auth.types";
import { approvalSchema, idParamsSchema } from "./membership-application.schema";
import type { MembershipApprovalConversionService } from "./membership-application.approval-conversion";
import type { ApprovalInput } from "./membership-application.types";

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

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

function authContext(request: Request): AuthContext {
  if (!request.auth) {
    throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  }
  return request.auth;
}

export function createMembershipApprovalController(
  service: MembershipApprovalConversionService,
) {
  return {
    approve: asyncHandler(async (request, response) => {
      const params = parse<{ id: string }>(idParamsSchema, request.params);
      const input = parse<ApprovalInput>(approvalSchema, request.body);
      return sendSuccess(
        response,
        await service.approve(params.id, input, authContext(request)),
        { message: "Membership application approved" },
      );
    }),

    reconcileCapital: asyncHandler(async (request, response) => {
      const params = parse<{ id: string }>(idParamsSchema, request.params);
      return sendSuccess(
        response,
        await service.reconcileCapital(params.id, authContext(request)),
        { message: "Membership capital reconciliation completed" },
      );
    }),
  };
}
