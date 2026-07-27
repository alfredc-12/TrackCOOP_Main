import { ZodError, type ZodType } from "zod";
import path from "node:path";
import type { Response } from "express";
import { protectedUploadRoot } from "../../storage/protected-storage";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  listPaymentReferencesQuerySchema,
  paymentReferenceSchema,
  reviewPaymentReferenceSchema,
  reversePaymentReferenceSchema,
  updatePaymentReferenceSchema,
} from "./payment-reference.schema";
import type { PaymentReferenceService } from "./payment-reference.service";

function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
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

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}

function sendProtectedProof(
  response: Response,
  file: { filePath: string; fileName: string; mimeType: string } | null,
) {
  if (!file) {
    throw new AppError("Payment proof was not found", 404, "PAYMENT_PROOF_NOT_FOUND");
  }
  const absolutePath = path.resolve(process.cwd(), file.filePath);
  const allowedRoot = `${path.resolve(protectedUploadRoot)}${path.sep}`;
  if (!absolutePath.startsWith(allowedRoot)) {
    throw new AppError("Payment proof path is invalid", 403, "INVALID_FILE_PATH");
  }
  response.setHeader("Content-Type", file.mimeType);
  response.setHeader("Content-Disposition", `inline; filename="${file.fileName.replaceAll('"', "")}"`);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.sendFile(absolutePath);
}

export function createPaymentReferenceController(
  service: PaymentReferenceService,
) {
  return {
    list: asyncHandler(async (request, response) => {
      const query = parseBody(listPaymentReferencesQuerySchema, request.query);
      const result = await service.listPaymentReferences(query);
      return sendSuccess(response, result.paymentReferences, {
        meta: { total: result.total, page: result.page, pageSize: result.pageSize },
      });
    }),
    summary: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.getPaymentReferenceSummary());
    }),
    create: asyncHandler(async (request, response) => {
      const input = parseBody(paymentReferenceSchema, request.body);
      const payment = await service.createPaymentReference(input, requireAuth(request.auth));
      return sendSuccess(response, payment, { statusCode: 201, message: "Payment reference created" });
    }),
    detail: asyncHandler(async (request, response) => {
      const payment = await service.getPaymentReference(requireParam(request.params.id, "id"));
      if (!payment) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
      return sendSuccess(response, payment);
    }),
    detailFull: asyncHandler(async (request, response) => {
      const payment = await service.getPaymentReferenceDetail(requireParam(request.params.id, "id"));
      if (!payment) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
      return sendSuccess(response, payment);
    }),
    proof: asyncHandler(async (request, response) => {
      return sendProtectedProof(
        response,
        await service.getPaymentReferenceProof(requireParam(request.params.id, "id")),
      );
    }),
    update: asyncHandler(async (request, response) => {
      const input = parseBody(updatePaymentReferenceSchema, request.body);
      const payment = await service.updatePaymentReference(
        requireParam(request.params.id, "id"),
        input,
        requireAuth(request.auth),
      );
      return sendSuccess(response, payment, { message: "Payment reference updated" });
    }),
    validate: asyncHandler(async (request, response) => {
      const input = parseBody(reviewPaymentReferenceSchema, request.body);
      return sendSuccess(
        response,
        await service.validatePaymentReference(
          requireParam(request.params.id, "id"),
          input,
          requireAuth(request.auth),
        ),
        { message: "Payment reference validated" },
      );
    }),
    reject: asyncHandler(async (request, response) => {
      const input = parseBody(reviewPaymentReferenceSchema, request.body);
      return sendSuccess(
        response,
        await service.rejectPaymentReference(
          requireParam(request.params.id, "id"),
          input,
          requireAuth(request.auth),
        ),
        { message: "Payment reference rejected" },
      );
    }),
    clarification: asyncHandler(async (request, response) => {
      const input = parseBody(reviewPaymentReferenceSchema, request.body);
      return sendSuccess(
        response,
        await service.requestClarification(
          requireParam(request.params.id, "id"),
          input,
          requireAuth(request.auth),
        ),
        { message: "Payment clarification requested" },
      );
    }),
    reverse: asyncHandler(async (request, response) => {
      const input = parseBody(reversePaymentReferenceSchema, request.body);
      return sendSuccess(
        response,
        await service.reversePaymentReference(
          requireParam(request.params.id, "id"),
          input,
          requireAuth(request.auth),
        ),
        { message: "Payment reference reversed" },
      );
    }),
  };
}
