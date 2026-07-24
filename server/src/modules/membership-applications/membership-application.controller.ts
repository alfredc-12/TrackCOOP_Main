import type { Request } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  publicDocumentUploadSchema,
  publicMembershipApplicationSchema,
  publicStatusParamsSchema,
} from "./membership-application.schema";
import type { MembershipApplicationService } from "./membership-application.service";
import type { PublicDocumentUploadInput } from "./membership-application.types";

type MulterFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type UploadRequest = Request & {
  file?: MulterFile;
};

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

function trackingToken(request: Request) {
  return request.get("X-Application-Tracking-Token");
}

function publicContext(request: Request) {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}
function documentFile(request: UploadRequest): MulterFile {
  if (!request.file) {
    throw new AppError(
      "A document file is required",
      400,
      "MEMBERSHIP_DOCUMENT_REQUIRED",
    );
  }

  return request.file;
}

export function createMembershipApplicationController(
  service: MembershipApplicationService,
) {
  return {
    submitPublic: asyncHandler(async (request, response) => {
      const input = parse(publicMembershipApplicationSchema, request.body);

      return sendSuccess(
        response,
        await service.submitPublicApplication(input, publicContext(request)),
        {
          statusCode: 201,
          message: "Membership application submitted",
        },
      );
    }),

    publicStatus: asyncHandler(async (request, response) => {
      const params = parse(publicStatusParamsSchema, request.params);

      return sendSuccess(
        response,
        await service.getPublicStatus(params.applicationCode, trackingToken(request)),
      );
    }),

    uploadPublicDocument: asyncHandler(async (request, response) => {
      const params = parse(publicStatusParamsSchema, request.params);
      const body = parse(publicDocumentUploadSchema, request.body);
      const file = documentFile(request as UploadRequest);
      const document: PublicDocumentUploadInput = {
        documentType: body.documentType,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        buffer: file.buffer,
      };

      return sendSuccess(
        response,
        await service.uploadPublicDocument(
          params.applicationCode,
          trackingToken(request),
          document,
        ),
        {
          statusCode: 201,
          message: "Membership application document uploaded",
        },
      );
    }),
  };
}
