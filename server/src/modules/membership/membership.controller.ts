import type { Express } from "express";
import path from "node:path";
import type { ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { protectedUploadRoot } from "../../storage/protected-storage";
import {
  accountCreationSchema,
  activationSchema,
  additionalInformationSchema,
  applicationInputSchema,
  listApplicationsSchema,
  paymentValidationSchema,
  reviewActionSchema,
  statusLookupSchema,
} from "./membership.schema";
import type { MembershipService } from "./membership.service";
import type {
  ApplicationStatus,
  UploadedApplicationDocument,
} from "./membership.types";

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      "The membership request is invalid",
      422,
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
    throw new AppError(`${name} is required`, 400, "ROUTE_PARAM_REQUIRED");
  }
  return value;
}

function parseJson(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new AppError(
      "The submitted form data is invalid",
      422,
      "INVALID_FORM_DATA",
    );
  }
}

function uploadedDocuments(
  files: Express.Multer.File[] | undefined,
  documentTypesValue: unknown,
): UploadedApplicationDocument[] {
  const documentTypes =
    typeof documentTypesValue === "string"
      ? (parseJson(documentTypesValue) as unknown)
      : documentTypesValue;
  const types = Array.isArray(documentTypes) ? documentTypes.map(String) : [];
  return (files ?? []).map((file, index) => ({
    documentType: types[index] ?? "Other cooperative requirement",
    originalFileName: file.originalname,
    storedFilePath: file.path.replaceAll("\\", "/"),
    mimeType: file.mimetype,
    fileSizeBytes: file.size,
  }));
}

function sendProtectedFile(
  response: import("express").Response,
  file: { filePath: string; fileName: string; mimeType: string } | null,
) {
  if (!file) {
    throw new AppError("Protected file was not found", 404, "FILE_NOT_FOUND");
  }
  const absolutePath = path.resolve(process.cwd(), file.filePath);
  const allowedRoot = `${path.resolve(protectedUploadRoot)}${path.sep}`;
  if (!absolutePath.startsWith(allowedRoot)) {
    throw new AppError(
      "Protected file path is invalid",
      403,
      "INVALID_FILE_PATH",
    );
  }
  response.setHeader("Content-Type", file.mimeType);
  response.setHeader(
    "Content-Disposition",
    `inline; filename="${file.fileName.replaceAll('"', "")}"`,
  );
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.sendFile(absolutePath);
}

export function createMembershipController(service: MembershipService) {
  return {
    submit: asyncHandler(async (request, response) => {
      const input = parse(
        applicationInputSchema,
        parseJson(request.body.payload),
      );
      const documents = uploadedDocuments(
        request.files as Express.Multer.File[] | undefined,
        request.body.documentTypes,
      );
      return sendSuccess(
        response,
        await service.submitApplication(input, documents),
        { statusCode: 201, message: "Membership application submitted" },
      );
    }),

    lookup: asyncHandler(async (request, response) => {
      const input = parse(statusLookupSchema, request.body);
      const application = await service.lookupApplication(
        input.reference,
        input.contactNumber,
      );
      if (!application) {
        throw new AppError(
          "No application matched those verification details",
          404,
          "APPLICATION_NOT_FOUND",
        );
      }
      return sendSuccess(response, application);
    }),

    additionalInformation: asyncHandler(async (request, response) => {
      const input = parse(
        additionalInformationSchema,
        parseJson(request.body.payload),
      );
      return sendSuccess(
        response,
        await service.submitAdditionalInformation(
          input.reference,
          input.contactNumber,
          input.information,
          uploadedDocuments(
            request.files as Express.Multer.File[] | undefined,
            request.body.documentTypes,
          ),
        ),
        { message: "Additional information submitted" },
      );
    }),

    list: asyncHandler(async (request, response) => {
      const query = parse(listApplicationsSchema, request.query);
      return sendSuccess(
        response,
        await service.listApplications(
          query.status as ApplicationStatus | undefined,
          query.search,
        ),
      );
    }),

    detail: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.getApplication(
          requireParam(request.params.id, "Application ID"),
        ),
      );
    }),

    document: asyncHandler(async (request, response) => {
      return sendProtectedFile(
        response,
        await service.getApplicationDocument(
          requireParam(request.params.id, "Application ID"),
          requireParam(request.params.documentId, "Document ID"),
        ),
      );
    }),

    review: asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new AppError(
          "Authentication is required",
          401,
          "UNAUTHENTICATED",
        );
      }
      return sendSuccess(
        response,
        await service.reviewApplication(
          requireParam(request.params.id, "Application ID"),
          parse(reviewActionSchema, request.body),
          request.auth,
        ),
        { message: "Membership review updated" },
      );
    }),

    payment: asyncHandler(async (request, response) => {
      const proof = request.file;
      if (!proof) {
        throw new AppError(
          "Payment proof is required",
          422,
          "PAYMENT_PROOF_REQUIRED",
        );
      }
      const verification = parse(statusLookupSchema, {
        reference: request.body.reference,
        contactNumber: request.body.contactNumber,
      });
      const amount = Number(request.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError(
          "Enter a valid payment amount",
          422,
          "INVALID_PAYMENT_AMOUNT",
        );
      }
      return sendSuccess(
        response,
        await service.submitPayment(
          verification.reference,
          verification.contactNumber,
          {
            provider: String(request.body.provider ?? ""),
            referenceNumber: String(request.body.referenceNumber ?? ""),
            amount,
            proofFilePath: proof.path.replaceAll("\\", "/"),
            notes: request.body.notes ? String(request.body.notes) : undefined,
          },
        ),
        { statusCode: 201, message: "Payment proof submitted" },
      );
    }),

    payments: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.listPayments());
    }),

    paymentProof: asyncHandler(async (request, response) => {
      return sendProtectedFile(
        response,
        await service.getPaymentProof(
          requireParam(request.params.id, "Payment ID"),
        ),
      );
    }),

    validatePayment: asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new AppError(
          "Authentication is required",
          401,
          "UNAUTHENTICATED",
        );
      }
      const input = parse(paymentValidationSchema, request.body);
      return sendSuccess(
        response,
        await service.validatePayment(
          requireParam(request.params.id, "Payment ID"),
          input.decision,
          input.note,
          request.auth,
        ),
        { message: "Membership payment validation updated" },
      );
    }),

    createAccount: asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new AppError(
          "Authentication is required",
          401,
          "UNAUTHENTICATED",
        );
      }
      return sendSuccess(
        response,
        await service.createAccount(
          requireParam(request.params.id, "Application ID"),
          parse(accountCreationSchema, request.body),
          request.auth,
        ),
        { statusCode: 201, message: "Pending member account created" },
      );
    }),

    activate: asyncHandler(async (request, response) => {
      const input = parse(activationSchema, request.body);
      await service.activateAccount(input.token, input.password);
      return sendSuccess(
        response,
        { activated: true },
        { message: "Member account activated" },
      );
    }),
  };
}
