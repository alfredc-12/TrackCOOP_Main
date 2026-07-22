import type { ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  listMembersQuerySchema,
  memberProfileSchema,
  updateMemberApprovalSchema,
  updateMemberProfileSchema,
  updateMemberStatusSchema,
} from "./member.schema";
import type { MemberService } from "./member.service";

function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError(
      "The request payload is invalid",
      400,
      "VALIDATION_ERROR",
      result.error.issues.map((issue) => ({
        code: "VALIDATION_ERROR",
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  return result.data;
}

function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) {
    throw new AppError(`Route parameter ${name} is required`, 400, "ROUTE_PARAM_REQUIRED");
  }

  return value;
}

export function createMemberController(service: MemberService) {
  return {
    list: asyncHandler(async (request, response) => {
      const query = parseBody(listMembersQuerySchema, request.query);
      const result = await service.listMembers(query);
      return sendSuccess(response, result.members, {
        meta: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
      });
    }),

    summary: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.summary());
    }),

    barangayDistribution: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.barangayDistribution());
    }),

    create: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(memberProfileSchema, request.body);
      const member = await service.createMember(input, request.auth);
      return sendSuccess(response, member, {
        statusCode: 201,
        message: "Member profile created",
      });
    }),

    detail: asyncHandler(async (request, response) => {
      const member = await service.getMember(requireParam(request.params.id, "id"));
      if (!member) throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");
      return sendSuccess(response, member);
    }),

    update: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(updateMemberProfileSchema, request.body);
      const member = await service.updateMember(
        requireParam(request.params.id, "id"),
        input,
        request.auth,
      );
      return sendSuccess(response, member, { message: "Member profile updated" });
    }),

    approval: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(updateMemberApprovalSchema, request.body);
      const member = await service.updateApproval(
        requireParam(request.params.id, "id"),
        input.approvalStatus,
        input.reason,
        request.auth,
      );
      return sendSuccess(response, member, { message: "Member approval updated" });
    }),

    status: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseBody(updateMemberStatusSchema, request.body);
      const member = await service.updateStatus(
        requireParam(request.params.id, "id"),
        input,
        request.auth,
      );
      return sendSuccess(response, member, { message: "Member status updated" });
    }),

    history: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.statusHistory(requireParam(request.params.id, "id")),
      );
    }),
  };
}
