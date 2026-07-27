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
  return new AppError("The request payload is invalid", 400, "VALIDATION_ERROR",
    error.issues.map((issue) => ({ code: "VALIDATION_ERROR", field: issue.path.join("."), message: issue.message })));
}
function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) throw new AppError(`Route parameter ${name} is required`, 400, "ROUTE_PARAM_REQUIRED");
  return value;
}
function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}
function sendProtectedProof(response: Response, file: { filePath: string; fileName: string; mimeType: string } | null) {
  if (!file) throw new AppError("Payment proof was not found", 404, "PAYMENT_PROOF_NOT_FOUND");
  const absolutePath = path.resolve(process.cwd(), file.filePath);
  const allowedRoot = `${path.resolve(protectedUploadRoot)}${path.sep}`;
  if (!absolutePath.startsWith(allowedRoot)) throw new AppError("Payment proof path is invalid", 403, "INVALID_FILE_PATH");
  response.setHeader("Content-Type", file.mimeType);
  response.setHeader("Content-Disposition", `inline; filename="${file.fileName.replaceAll('"', "")}"`);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.sendFile(absolutePath);
}

export function createPaymentReferenceController(service: PaymentReferenceService) {
  const review = (method: "rejectPaymentReference" | "requestClarification" | "returnToPending", message: string) =>
    asyncHandler(async (request, response) => sendSuccess(response,
      await service[method](requireParam(request.params.id, "id"),
        parseBody(reviewPaymentReferenceSchema, request.body), requireAuth(request.auth)), { message }));
  return {
    list: asyncHandler(async (request, response) => {
      const result = await service.listPaymentReferences(parseBody(listPaymentReferencesQuerySchema, request.query));
      return sendSuccess(response, result.paymentReferences, { meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
    }),
    summary: asyncHandler(async (_request, response) => sendSuccess(response, await service.getPaymentReferenceSummary())),
    create: asyncHandler(async (request, response) => sendSuccess(response,
      await service.createPaymentReference(parseBody(paymentReferenceSchema, request.body), requireAuth(request.auth)),
      { statusCode: 201, message: "Payment reference created" })),
    detailFull: asyncHandler(async (request, response) => {
      const payment = await service.getPaymentReferenceDetail(requireParam(request.params.id, "id"));
      if (!payment) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
      return sendSuccess(response, payment);
    }),
    proof: asyncHandler(async (request, response) => sendProtectedProof(response,
      await service.getPaymentReferenceProof(requireParam(request.params.id, "id")))),
    receiptStatus: asyncHandler(async (request, response) => {
      const receipt = await service.getPaymentReceiptStatus(requireParam(request.params.id, "id"));
      if (!receipt) throw new AppError("Payment receipt has not been queued", 404, "PAYMENT_RECEIPT_NOT_FOUND");
      return sendSuccess(response, receipt);
    }),
    retryReceipt: asyncHandler(async (request, response) => {
      const receipt = await service.retryPaymentReceipt(requireParam(request.params.id, "id"));
      if (!receipt) throw new AppError("Payment receipt has not been queued", 404, "PAYMENT_RECEIPT_NOT_FOUND");
      return sendSuccess(response, receipt, { message: receipt.processingStatus === "Generated" ? "Payment receipt generated" : "Payment receipt retry recorded" });
    }),
    update: asyncHandler(async (request, response) => sendSuccess(response,
      await service.updatePaymentReference(requireParam(request.params.id, "id"),
        parseBody(updatePaymentReferenceSchema, request.body), requireAuth(request.auth)), { message: "Payment reference updated" })),
    validate: asyncHandler(async (request, response) => sendSuccess(response,
      await service.validatePaymentReference(requireParam(request.params.id, "id"),
        parseBody(reviewPaymentReferenceSchema, request.body), requireAuth(request.auth)), { message: "Payment reference validated" })),
    reject: review("rejectPaymentReference", "Payment reference rejected"),
    clarification: review("requestClarification", "Payment clarification requested"),
    returnPending: review("returnToPending", "Payment reference returned to pending"),
    reverse: asyncHandler(async (request, response) => sendSuccess(response,
      await service.reversePaymentReference(requireParam(request.params.id, "id"),
        parseBody(reversePaymentReferenceSchema, request.body), requireAuth(request.auth)), { message: "Payment reference reversed" })),
  };
}
