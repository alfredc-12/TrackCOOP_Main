import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  contentBlockSchema,
  gallerySchema,
  listLandingQuerySchema,
  partnerSchema,
  programSchema,
  serviceSchema,
  settingSchema,
  updateContentBlockSchema,
  updateGallerySchema,
  updatePartnerSchema,
  updateProgramSchema,
  updateServiceSchema,
} from "./landing.schema";
import type { LandingService } from "./landing.service";
import type { LandingCollection } from "./landing.types";

const createSchemas: Record<LandingCollection, ZodType<Record<string, unknown>>> = {
  "content-blocks": contentBlockSchema,
  services: serviceSchema,
  programs: programSchema,
  partners: partnerSchema,
  gallery: gallerySchema,
};

const updateSchemas: Record<LandingCollection, ZodType<Record<string, unknown>>> = {
  "content-blocks": updateContentBlockSchema,
  services: updateServiceSchema,
  programs: updateProgramSchema,
  partners: updatePartnerSchema,
  gallery: updateGallerySchema,
};

function parse<T>(schema: ZodType<T>, value: unknown): T {
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

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}

function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) {
    throw new AppError(`Route parameter ${name} is required`, 400, "ROUTE_PARAM_REQUIRED");
  }
  return value;
}

function requireCollection(value: string | string[] | undefined): LandingCollection {
  const collection = requireParam(value, "collection");
  if (!["content-blocks", "services", "programs", "partners", "gallery"].includes(collection)) {
    throw new AppError("Landing collection was not found", 404, "LANDING_COLLECTION_NOT_FOUND");
  }
  return collection as LandingCollection;
}

function sendList<T>(
  response: Parameters<typeof sendSuccess<T[]>>[0],
  result: { records: T[]; total: number; page: number; pageSize: number },
) {
  return sendSuccess(response, result.records, {
    meta: { total: result.total, page: result.page, pageSize: result.pageSize },
  });
}

export function createLandingController(service: LandingService) {
  return {
    publicLanding: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.publicLanding());
    }),
    list: asyncHandler(async (request, response) => {
      const collection = requireCollection(request.params.collection);
      return sendList(response, await service.list(collection, parse(listLandingQuerySchema, request.query)));
    }),
    create: asyncHandler(async (request, response) => {
      const collection = requireCollection(request.params.collection);
      return sendSuccess(
        response,
        await service.create(collection, parse(createSchemas[collection], request.body), requireAuth(request.auth)),
        { statusCode: 201, message: "Landing record created" },
      );
    }),
    update: asyncHandler(async (request, response) => {
      const collection = requireCollection(request.params.collection);
      return sendSuccess(
        response,
        await service.update(
          collection,
          requireParam(request.params.id, "id"),
          parse(updateSchemas[collection], request.body),
          requireAuth(request.auth),
        ),
        { message: "Landing record updated" },
      );
    }),
    listSettings: asyncHandler(async (request, response) => {
      return sendList(response, await service.listSettings(parse(listLandingQuerySchema, request.query)));
    }),
    upsertSetting: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.upsertSetting(parse(settingSchema, request.body), requireAuth(request.auth)),
        { message: "System setting saved" },
      );
    }),
    listAuditLogs: asyncHandler(async (request, response) => {
      return sendList(response, await service.listAuditLogs(parse(listLandingQuerySchema, request.query)));
    }),
  };
}
