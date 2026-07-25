import type { Request } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  approvalSchema,
  beneficiaryCreateSchema,
  beneficiaryUpdateSchema,
  chairmanApplicationListQuerySchema,
  chairmanMembershipApplicationSchema,
  chairmanMembershipApplicationUpdateSchema,
  idParamsSchema,
  publicDocumentUploadSchema,
  publicMembershipApplicationSchema,
  publicStatusParamsSchema,
  requirementCreateSchema,
  requirementUpdateSchema,
  statusTransitionSchema,
} from "./membership-application.schema";
import type { MembershipApplicationService } from "./membership-application.service";
import type { PublicDocumentUploadInput } from "./membership-application.types";
import type { AuthContext } from "../auth/auth.types";

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

function authContext(request: Request): AuthContext {
  if (!request.auth) {
    throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  }

  return request.auth;
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

    summary: asyncHandler(async (request, response) => {
      return sendSuccess(response, await service.summary(authContext(request)));
    }),

    list: asyncHandler(async (request, response) => {
      const query = parse(chairmanApplicationListQuerySchema, request.query);
      const result = await service.list(query, authContext(request));
      return sendSuccess(response, result.applications, {
        meta: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
      });
    }),

    createChairman: asyncHandler(async (request, response) => {
      const input = parse(chairmanMembershipApplicationSchema, request.body);
      return sendSuccess(
        response,
        await service.createChairmanApplication(input, authContext(request)),
        {
          statusCode: 201,
          message: "Membership application created",
        },
      );
    }),

    detail: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      return sendSuccess(
        response,
        await service.getChairmanApplication(params.id, authContext(request)),
      );
    }),

    update: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(chairmanMembershipApplicationUpdateSchema, request.body);
      return sendSuccess(
        response,
        await service.updateApplication(params.id, input, authContext(request)),
      );
    }),

    createBeneficiary: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(beneficiaryCreateSchema, request.body);
      return sendSuccess(
        response,
        await service.createBeneficiary(params.id, input, authContext(request)),
        {
          statusCode: 201,
          message: "Beneficiary added",
        },
      );
    }),

    updateBeneficiary: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(beneficiaryUpdateSchema, request.body);
      return sendSuccess(
        response,
        await service.updateBeneficiary(params.id, input, authContext(request)),
      );
    }),

    deleteBeneficiary: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      await service.deleteBeneficiary(params.id, authContext(request));
      return sendSuccess(response, { deleted: true });
    }),

    uploadChairmanDocument: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
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
        await service.uploadChairmanDocument(params.id, document, authContext(request)),
        {
          statusCode: 201,
          message: "Membership application document uploaded",
        },
      );
    }),

    deleteDocument: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      await service.deleteDocument(params.id, authContext(request));
      return sendSuccess(response, { deleted: true });
    }),

    createRequirement: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(requirementCreateSchema, request.body);
      return sendSuccess(
        response,
        await service.createRequirement(params.id, input, authContext(request)),
        {
          statusCode: 201,
          message: "Requirement added",
        },
      );
    }),

    updateRequirement: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(requirementUpdateSchema, request.body);
      return sendSuccess(
        response,
        await service.updateRequirement(params.id, input, authContext(request)),
      );
    }),

    history: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      return sendSuccess(response, await service.history(params.id, authContext(request)));
    }),

    startReview: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(statusTransitionSchema, request.body);
      return sendSuccess(
        response,
        await service.startReview(params.id, input, authContext(request)),
      );
    }),

    requestInformation: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(statusTransitionSchema, request.body);
      return sendSuccess(
        response,
        await service.requestInformation(params.id, input, authContext(request)),
      );
    }),

    reject: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(statusTransitionSchema, request.body);
      return sendSuccess(
        response,
        await service.reject(params.id, input, authContext(request)),
      );
    }),

    withdraw: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(statusTransitionSchema, request.body);
      return sendSuccess(
        response,
        await service.withdraw(params.id, input, authContext(request)),
      );
    }),

    approve: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(approvalSchema, request.body);
      return sendSuccess(
        response,
        await service.approve(params.id, input, authContext(request)),
        {
          message: "Membership application approved",
        },
      );
    }),

    print: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const pdf = await service.printablePdf(params.id, authContext(request));
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="membership-application-${params.id}.pdf"`,
      );
      return response.status(200).send(pdf);
    }),
  };
}
