import type { Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { publishRealtimeEvent } from "../realtime/realtime.events";
import {
  approvalSchema,
  beneficiaryCreateSchema,
  beneficiaryUpdateSchema,
  chairmanApplicationListQuerySchema,
  chairmanMembershipApplicationSchema,
  chairmanMembershipApplicationUpdateSchema,
  idParamsSchema,
  publicDocumentViewParamsSchema,
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

function dateOfBirthCredential(request: Request) {
  return request.get("X-Application-Date-Of-Birth");
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

function publishMembershipApplicationEvent(input: {
  type: string;
  entityId?: string | null;
  actor?: AuthContext | null;
  message?: string;
}) {
  publishRealtimeEvent({
    channel: "membership-applications",
    type: input.type,
    entityId: input.entityId,
    actorRole: input.actor?.user.role ?? null,
    message: input.message,
  });
}

function streamInlineDocument(
  response: Response,
  document: { contents: Buffer; originalFileName: string; mimeType: string },
) {
  response.removeHeader("X-Frame-Options");
  response.setHeader("Content-Type", document.mimeType);
  response.setHeader(
    "Content-Disposition",
    `inline; filename="${document.originalFileName.replace(/["\r\n]/g, "")}"`,
  );
  return response.send(document.contents);
}

export function createMembershipApplicationController(
  service: MembershipApplicationService,
) {
  return {
    submitPublic: asyncHandler(async (request, response) => {
      const input = parse(publicMembershipApplicationSchema, request.body);
      const result = await service.submitPublicApplication(input, publicContext(request));
      publishMembershipApplicationEvent({
        type: "membership-application.submitted",
        entityId: result.applicationCode,
        message: "A public membership application was submitted.",
      });

      return sendSuccess(
        response,
        result,
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
        await service.getPublicStatus(params.applicationCode, dateOfBirthCredential(request)),
      );
    }),

    issuePublicActivationLink: asyncHandler(async (request, response) => {
      const params = parse(publicStatusParamsSchema, request.params);

      return sendSuccess(
        response,
        await service.issuePublicActivationLink(
          params.applicationCode,
          dateOfBirthCredential(request),
        ),
        { message: "Membership activation link issued" },
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
      const result = await service.uploadPublicDocument(
        params.applicationCode,
        dateOfBirthCredential(request),
        document,
      );
      publishMembershipApplicationEvent({
        type: "membership-application.document-uploaded",
        entityId: params.applicationCode,
        message: "An applicant uploaded a requested document.",
      });

      return sendSuccess(
        response,
        result,
        {
          statusCode: 201,
          message: "Membership application document uploaded",
        },
      );
    }),

    viewPublicDocument: asyncHandler(async (request, response) => {
      const params = parse(publicDocumentViewParamsSchema, request.params);
      const document = await service.viewPublicDocument(
        params.applicationCode,
        params.documentId,
        dateOfBirthCredential(request),
      );
      return streamInlineDocument(response, document);
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
      const auth = authContext(request);
      const result = await service.createChairmanApplication(input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.created",
        entityId: result.id,
        actor: auth,
        message: "A membership application was created by the chairman.",
      });
      return sendSuccess(
        response,
        result,
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
      const auth = authContext(request);
      const result = await service.updateApplication(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.updated",
        entityId: params.id,
        actor: auth,
        message: "Membership application details were updated.",
      });
      return sendSuccess(
        response,
        result,
      );
    }),

    createBeneficiary: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(beneficiaryCreateSchema, request.body);
      const auth = authContext(request);
      const result = await service.createBeneficiary(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.beneficiary-created",
        entityId: params.id,
        actor: auth,
        message: "A membership application beneficiary was added.",
      });
      return sendSuccess(
        response,
        result,
        {
          statusCode: 201,
          message: "Beneficiary added",
        },
      );
    }),

    updateBeneficiary: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(beneficiaryUpdateSchema, request.body);
      const auth = authContext(request);
      const result = await service.updateBeneficiary(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.beneficiary-updated",
        entityId: params.id,
        actor: auth,
        message: "A membership application beneficiary was updated.",
      });
      return sendSuccess(
        response,
        result,
      );
    }),

    deleteBeneficiary: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const auth = authContext(request);
      await service.deleteBeneficiary(params.id, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.beneficiary-deleted",
        entityId: params.id,
        actor: auth,
        message: "A membership application beneficiary was removed.",
      });
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
      const auth = authContext(request);
      const result = await service.uploadChairmanDocument(params.id, document, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.document-uploaded",
        entityId: params.id,
        actor: auth,
        message: "A chairman uploaded a membership application document.",
      });
      return sendSuccess(
        response,
        result,
        {
          statusCode: 201,
          message: "Membership application document uploaded",
        },
      );
    }),

    deleteDocument: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const auth = authContext(request);
      await service.deleteDocument(params.id, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.document-deleted",
        entityId: params.id,
        actor: auth,
        message: "A membership application document was removed.",
      });
      return sendSuccess(response, { deleted: true });
    }),

    viewDocument: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const document = await service.viewDocument(params.id, authContext(request));
      return streamInlineDocument(response, document);
    }),

    createRequirement: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(requirementCreateSchema, request.body);
      const auth = authContext(request);
      const result = await service.createRequirement(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.requirement-created",
        entityId: params.id,
        actor: auth,
        message: "A membership application requirement was added.",
      });
      return sendSuccess(
        response,
        result,
        {
          statusCode: 201,
          message: "Requirement added",
        },
      );
    }),

    updateRequirement: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(requirementUpdateSchema, request.body);
      const auth = authContext(request);
      const result = await service.updateRequirement(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.requirement-updated",
        entityId: params.id,
        actor: auth,
        message: "A membership application requirement was updated.",
      });
      return sendSuccess(
        response,
        result,
      );
    }),

    deleteRequirement: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const auth = authContext(request);
      await service.deleteRequirement(params.id, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.requirement-deleted",
        entityId: params.id,
        actor: auth,
        message: "A membership application requirement was removed.",
      });
      return sendSuccess(response, { deleted: true });
    }),

    history: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      return sendSuccess(response, await service.history(params.id, authContext(request)));
    }),

    startReview: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(statusTransitionSchema, request.body);
      const auth = authContext(request);
      const result = await service.startReview(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.status-changed",
        entityId: params.id,
        actor: auth,
        message: "A membership application review was started.",
      });
      return sendSuccess(response, result);
    }),

    requestInformation: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(statusTransitionSchema, request.body);
      const auth = authContext(request);
      const result = await service.requestInformation(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.status-changed",
        entityId: params.id,
        actor: auth,
        message: "More information was requested for a membership application.",
      });
      return sendSuccess(response, result);
    }),

    approveForPayment: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(statusTransitionSchema, request.body);
      const auth = authContext(request);
      const result = await service.approveForPayment(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.status-changed",
        entityId: params.id,
        actor: auth,
        message: "Payment was opened for a membership application.",
      });
      return sendSuccess(
        response,
        result,
        { message: "Membership application approved for payment" },
      );
    }),

    reject: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(statusTransitionSchema, request.body);
      const auth = authContext(request);
      const result = await service.reject(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.status-changed",
        entityId: params.id,
        actor: auth,
        message: "A membership application was rejected.",
      });
      return sendSuccess(response, result);
    }),

    withdraw: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(statusTransitionSchema, request.body);
      const auth = authContext(request);
      const result = await service.withdraw(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.status-changed",
        entityId: params.id,
        actor: auth,
        message: "A membership application was withdrawn.",
      });
      return sendSuccess(response, result);
    }),

    approve: asyncHandler(async (request, response) => {
      const params = parse(idParamsSchema, request.params);
      const input = parse(approvalSchema, request.body);
      const auth = authContext(request);
      const result = await service.approve(params.id, input, auth);
      publishMembershipApplicationEvent({
        type: "membership-application.approved",
        entityId: params.id,
        actor: auth,
        message: "A membership application was approved.",
      });
      return sendSuccess(
        response,
        {
          ...result,
          activationUrl: null,
        },
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
