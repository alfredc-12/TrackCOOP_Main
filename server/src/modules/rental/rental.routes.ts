import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import type { RowDataPacket } from "mysql2/promise";
import { ZodError } from "zod";
import { getPool } from "../../db/pool";
import { createAuthenticate, createOptionalAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import {
  normalizeProtectedStoragePath,
  protectedUploadRoot,
} from "../../storage/protected-storage";
import { createAuthService, type AuthService } from "../auth/auth.service";
import type { RoleSlug } from "../auth/auth.types";
import {
  RentalConflictError,
  rentalDatabase,
  type RentalActor,
} from "./rental.repository";
import {
  triggerRentalStatusEmail,
  triggerRentalSubmittedEmail,
} from "./rental-email";
import {
  MAX_RENTAL_ASSET_PHOTOS,
  validateRentalAssetPhoto,
} from "./rental-photos";
import {
  resolveProtectedDocumentPath,
  validateDocumentFile,
  type UploadedFileLike,
  type ValidatedDocumentFile,
} from "./rental-document-security";
import type {
  PaymentStatus,
  RentalStatus,
  ScheduleStatus,
} from "./rental.types";

class RentalUploadValidationError extends Error {}

type MemberProfileRow = RowDataPacket & {
  memberId: string;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 8,
  },
});

const rentalAssetPhotoExtensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function json(response: Response, data: unknown, status = 200) {
  return response.status(status).json(data);
}

function notFound(response: Response, message = "Rental resource was not found.") {
  return json(response, { message }, 404);
}

function badRequest(response: Response, message: string) {
  return json(response, { message }, 400);
}

function pathParts(request: Request) {
  const match = /^\/rental\/?(.*)$/.exec(request.path);
  return (match?.[1] ?? "")
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
}

function body<T>(request: Request) {
  return request.body as T;
}

function queryString(request: Request, key: string) {
  const value = request.query[key];
  if (Array.isArray(value)) return String(value[0] ?? "");
  return typeof value === "string" ? value : undefined;
}

function multerFileLike(file: Express.Multer.File): UploadedFileLike {
  return {
    name: file.originalname,
    size: file.size,
    type: file.mimetype,
    async arrayBuffer() {
      return Uint8Array.from(file.buffer).buffer;
    },
  };
}

function files(request: Request, fieldName: string) {
  const requestFiles = request.files;
  if (Array.isArray(requestFiles)) {
    return requestFiles.filter((file) => file.fieldname === fieldName);
  }
  return requestFiles?.[fieldName] ?? [];
}

function firstFile(request: Request, fieldName: string) {
  return files(request, fieldName)[0];
}

function numericUserId(request: Request) {
  const userId = Number(request.auth?.user.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

async function memberProfileIdForUser(userId: number) {
  const [rows] = await getPool().execute<MemberProfileRow[]>(
    `SELECT CAST(member_id AS CHAR) AS memberId
       FROM member_profiles
      WHERE user_id = ?
      LIMIT 1`,
    [userId],
  );
  const memberId = Number(rows[0]?.memberId);
  return Number.isInteger(memberId) && memberId > 0 ? memberId : null;
}

function hasRole(request: Request, roles: RoleSlug[]) {
  const role = request.auth?.user.role;
  return Boolean(role && roles.includes(role));
}

async function authorize(request: Request, response: Response, roles: RoleSlug[]) {
  if (!request.auth) {
    json(response, { message: "Authentication is required." }, 401);
    return false;
  }
  if (!hasRole(request, roles)) {
    json(response, { message: "You do not have permission to perform this action." }, 403);
    return false;
  }
  if (!numericUserId(request)) {
    json(response, { message: "Authenticated user is not linked to a valid account." }, 403);
    return false;
  }
  return true;
}

async function authorizeActor(
  request: Request,
  response: Response,
  roles: RoleSlug[],
) {
  if (!(await authorize(request, response, roles))) {
    return null;
  }

  const userId = numericUserId(request);
  if (!request.auth || !userId) return null;
  const memberId =
    request.auth.user.role === "member"
      ? await memberProfileIdForUser(userId)
      : undefined;

  return {
    userId,
    role: request.auth.user.role,
    displayName: request.auth.user.displayName,
    memberId,
  } satisfies RentalActor;
}

async function rentalSubmission(request: Request): Promise<{
  draft: Parameters<typeof rentalDatabase.submitRentalInquiry>[0];
  validIdFile: ValidatedDocumentFile;
}> {
  const rawDraft = typeof request.body?.draft === "string" ? request.body.draft : undefined;
  const validId = firstFile(request, "validId");
  if (!rawDraft) {
    throw new RentalUploadValidationError("Rental request details are required.");
  }
  if (!validId) {
    throw new RentalUploadValidationError("Upload a valid ID before submitting the rental request.");
  }

  let draft: Parameters<typeof rentalDatabase.submitRentalInquiry>[0];
  try {
    draft = JSON.parse(rawDraft) as Parameters<typeof rentalDatabase.submitRentalInquiry>[0];
  } catch {
    throw new RentalUploadValidationError("Rental request details are invalid.");
  }

  try {
    const validIdFile = await validateDocumentFile(multerFileLike(validId));
    if (
      !["jpg", "jpeg", "png", "pdf"].includes(validIdFile.extension) ||
      validIdFile.size > 5 * 1024 * 1024
    ) {
      throw new Error("Valid ID must be a JPG, PNG, or PDF file no larger than 5 MB.");
    }
    return { draft, validIdFile };
  } catch (error) {
    throw new RentalUploadValidationError(
      error instanceof Error ? error.message : "The valid ID file is invalid.",
    );
  }
}

function parseFilters(request: Request) {
  const encoded = queryString(request, "filters");
  if (!encoded) return undefined;
  try {
    return JSON.parse(encoded) as Parameters<typeof rentalDatabase.getRentalReports>[0];
  } catch {
    return undefined;
  }
}

function handleRentalError(response: Response, error: unknown) {
  if (error instanceof RentalUploadValidationError) {
    return json(response, { message: error.message }, 422);
  }
  if (error instanceof ZodError) {
    return json(
      response,
      { message: "Rental request validation failed.", errors: error.flatten() },
      422,
    );
  }
  if (error instanceof RentalConflictError) {
    return json(response, { message: error.message, conflict: error.conflict }, 409);
  }
  return json(
    response,
    { message: error instanceof Error ? error.message : "Rental request failed." },
    500,
  );
}

async function getRental(request: Request, response: Response) {
  try {
    const [resource, id, action] = pathParts(request);

    if (resource === "overview") {
      if (!(await authorize(request, response, ["chairman", "bookkeeper"]))) return;
      return json(response, await rentalDatabase.getRentalOverview());
    }
    if (resource === "services" && !id) {
      return json(response, await rentalDatabase.getPublicRentalServices());
    }
    if (resource === "services" && id && action === "booked-dates") {
      const blockedDates = await rentalDatabase.getPublicRentalBlockedDates(id);
      return blockedDates
        ? json(response, blockedDates)
        : notFound(response, "Rental service was not found.");
    }
    if (resource === "services" && id) {
      const service = await rentalDatabase.getPublicRentalServiceById(id);
      return service ? json(response, service) : notFound(response, "Rental service was not found.");
    }
    if (resource === "member-services") {
      if (!(await authorize(request, response, ["member"]))) return;
      return json(response, await rentalDatabase.getMemberRentalServices());
    }
    if (resource === "assets" && !id) {
      if (!(await authorize(request, response, ["chairman"]))) return;
      return json(response, await rentalDatabase.getRentalServices());
    }
    if (resource === "assets" && id) {
      if (!(await authorize(request, response, ["chairman"]))) return;
      const service = await rentalDatabase.getRentalServiceById(id);
      return service ? json(response, service) : notFound(response, "Rental asset was not found.");
    }
    if (resource === "inquiries" && id === "status") {
      return json(
        response,
        await rentalDatabase.lookupRentalInquiry(
          queryString(request, "reference") ?? "",
          queryString(request, "contact") ?? "",
        ) ?? null,
      );
    }
    if (resource === "inquiries" && id && action === "history") {
      if (!(await authorize(request, response, ["chairman"]))) return;
      return json(response, await rentalDatabase.getRentalStatusHistory(id));
    }
    if (resource === "inquiries" && id && action === "valid-id") {
      if (!(await authorize(request, response, ["chairman"]))) return;
      const document = await rentalDatabase.getRentalValidId(id);
      if (!document) return notFound(response, "Valid ID was not found for this rental request.");
      const absolutePath = resolveProtectedDocumentPath(document.storagePath);
      const file = await readFile(absolutePath);
      const extension = document.mimeType === "application/pdf"
        ? "pdf"
        : document.mimeType === "image/png"
          ? "png"
          : "jpg";
      response.set({
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="rental-valid-id-${id}.${extension}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return response.send(file);
    }
    if (resource === "inquiries" && !id) {
      if (!(await authorize(request, response, ["chairman", "bookkeeper"]))) return;
      return json(response, await rentalDatabase.getRentalInquiries());
    }
    if (resource === "inquiries" && id) {
      if (!(await authorize(request, response, ["chairman"]))) return;
      const inquiry = await rentalDatabase.getRentalInquiryById(id);
      return inquiry ? json(response, inquiry) : notFound(response, "Rental inquiry was not found.");
    }
    if (resource === "member-inquiries" && !id) {
      const actor = await authorizeActor(request, response, ["member"]);
      if (!actor) return;
      if (!actor.memberId) return json(response, { message: "Member profile was not found." }, 403);
      return json(response, await rentalDatabase.getRentalInquiriesForMember(actor.memberId));
    }
    if (resource === "member-inquiries" && id) {
      const actor = await authorizeActor(request, response, ["member"]);
      if (!actor) return;
      if (!actor.memberId) return json(response, { message: "Member profile was not found." }, 403);
      const inquiry = await rentalDatabase.getRentalInquiryForMember(id, actor.memberId);
      return inquiry
        ? json(response, inquiry)
        : notFound(response, "Rental request was not found in this member account.");
    }
    if (resource === "schedules") {
      if (!(await authorize(request, response, ["chairman", "bookkeeper"]))) return;
      return json(response, await rentalDatabase.getRentalSchedules());
    }
    if (resource === "availability") {
      if (!(await authorize(request, response, ["chairman", "bookkeeper"]))) return;
      return json(response, await rentalDatabase.getEquipmentAvailability());
    }
    if (resource === "maintenance") {
      if (!(await authorize(request, response, ["chairman"]))) return;
      return json(
        response,
        await rentalDatabase.getRentalMaintenanceRecords(
          queryString(request, "serviceId") ?? undefined,
        ),
      );
    }
    if (resource === "payments" && !id) {
      if (!(await authorize(request, response, ["chairman", "bookkeeper"]))) return;
      return json(response, await rentalDatabase.getRentalPayments());
    }
    if (resource === "payments" && id && action === "proof") {
      const actor = await authorizeActor(request, response, ["chairman", "bookkeeper", "member"]);
      if (!actor) return;
      const storedPath = await rentalDatabase.getRentalPaymentProof(id, actor);
      if (!storedPath) return notFound(response, "Payment proof was not found.");
      const normalized = normalizeProtectedStoragePath(storedPath);
      const absolutePath = nodePath.resolve(process.cwd(), normalized);
      const allowedRoot = `${nodePath.resolve(protectedUploadRoot)}${nodePath.sep}`;
      if (!absolutePath.startsWith(allowedRoot)) {
        return json(response, { message: "Payment proof path is invalid." }, 403);
      }
      const file = await readFile(absolutePath);
      const extension = nodePath.extname(absolutePath).toLowerCase();
      const contentType =
        extension === ".pdf"
          ? "application/pdf"
          : extension === ".png"
            ? "image/png"
            : "image/jpeg";
      response.set({
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="rental-proof-${id}${extension}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return response.send(file);
    }
    if (resource === "payments" && id) {
      if (!(await authorize(request, response, ["chairman", "bookkeeper"]))) return;
      const payment = await rentalDatabase.getRentalPaymentById(id);
      return payment ? json(response, payment) : notFound(response, "Rental payment was not found.");
    }
    if (resource === "expenses") {
      if (!(await authorize(request, response, ["bookkeeper"]))) return;
      return json(response, await rentalDatabase.getRentalExpenses());
    }
    if (resource === "receipts" && id) {
      const actor = await authorizeActor(request, response, ["chairman", "bookkeeper", "member"]);
      if (!actor) return;
      const receipt = await rentalDatabase.getRentalReceipt(id);
      if (!receipt) return notFound(response, "Rental receipt was not found.");
      if (actor.role === "member") {
        if (
          !actor.memberId ||
          !(await rentalDatabase.getRentalInquiryForMember(
            receipt.rentalId,
            actor.memberId,
          ))
        ) {
          return notFound(response, "Rental receipt was not found in this member account.");
        }
      }
      return json(response, receipt);
    }
    if (resource === "reports") {
      if (!(await authorize(request, response, ["chairman", "bookkeeper"]))) return;
      return json(response, await rentalDatabase.getRentalReports(parseFilters(request)));
    }
    if (resource === "analytics" && id === "utilization") {
      if (!(await authorize(request, response, ["chairman", "bookkeeper"]))) return;
      return json(response, await rentalDatabase.getEquipmentUtilization());
    }
    if (resource === "analytics") {
      if (!(await authorize(request, response, ["chairman", "bookkeeper"]))) return;
      return json(response, await rentalDatabase.getRentalAnalytics());
    }
    if (resource === "notifications") {
      if (!(await authorize(request, response, ["chairman", "bookkeeper"]))) return;
      return json(response, await rentalDatabase.getRentalNotifications());
    }
    if (resource === "audit") {
      if (!(await authorize(request, response, ["chairman"]))) return;
      return json(response, await rentalDatabase.getRentalAuditEntries());
    }

    return notFound(response);
  } catch (error) {
    return handleRentalError(response, error);
  }
}

async function postRental(request: Request, response: Response) {
  try {
    const [resource, id, action] = pathParts(request);

    if (resource === "services" && !id) {
      const actor = await authorizeActor(request, response, ["chairman"]);
      if (!actor) return;
      return json(
        response,
        await rentalDatabase.createRentalService(
          body<Parameters<typeof rentalDatabase.createRentalService>[0]>(request),
          actor,
        ),
        201,
      );
    }
    if (resource === "services" && id && action === "archive") {
      const actor = await authorizeActor(request, response, ["chairman"]);
      if (!actor) return;
      const service = await rentalDatabase.archiveRentalService(id, actor);
      return service ? json(response, service) : notFound(response, "Rental service was not found.");
    }
    if (resource === "inquiries" && id === "public") {
      const submission = await rentalSubmission(request);
      const inquiry = await rentalDatabase.submitRentalInquiry(
        submission.draft,
        submission.validIdFile,
        false,
      );
      await triggerRentalSubmittedEmail(inquiry);
      return json(response, inquiry, 201);
    }
    if (resource === "requests" && id === "member") {
      const actor = await authorizeActor(request, response, ["member"]);
      if (!actor) return;
      const submission = await rentalSubmission(request);
      const inquiry = await rentalDatabase.submitRentalInquiry(
        submission.draft,
        submission.validIdFile,
        true,
        actor,
      );
      await triggerRentalSubmittedEmail(inquiry);
      return json(response, inquiry, 201);
    }
    if (resource === "inquiries" && id && action === "review") {
      const actor = await authorizeActor(request, response, ["chairman"]);
      if (!actor) return;
      const payload = body<{ decision: RentalStatus; publicNote: string; internalNote?: string }>(request);
      const inquiry = await rentalDatabase.reviewRentalInquiry(
        id,
        payload.decision,
        payload.publicNote,
        payload.internalNote,
        actor,
      );
      if (inquiry) await triggerRentalStatusEmail(inquiry);
      return inquiry ? json(response, inquiry) : notFound(response, "Rental inquiry was not found.");
    }
    if (resource === "schedules" && !id) {
      const actor = await authorizeActor(request, response, ["chairman"]);
      if (!actor) return;
      const schedule = await rentalDatabase.createRentalSchedule(
        body<Parameters<typeof rentalDatabase.createRentalSchedule>[0]>(request),
        actor,
      );
      const inquiry = await rentalDatabase.getRentalInquiryById(schedule.rentalId);
      if (inquiry) await triggerRentalStatusEmail(inquiry);
      return json(response, schedule, 201);
    }
    if (resource === "schedules" && id === "conflicts") {
      if (!(await authorize(request, response, ["chairman"]))) return;
      return json(
        response,
        await rentalDatabase.checkScheduleConflict(
          body<Parameters<typeof rentalDatabase.checkScheduleConflict>[0]>(request),
        ),
      );
    }
    if (resource === "payments" && !id) {
      const actor = await authorizeActor(request, response, ["bookkeeper"]);
      if (!actor) return;
      return json(
        response,
        await rentalDatabase.recordRentalPayment(
          body<Parameters<typeof rentalDatabase.recordRentalPayment>[0]>(request),
          actor,
        ),
        201,
      );
    }
    if (resource === "payments" && id === "proof") {
      const actor = await authorizeActor(request, response, ["member", "bookkeeper"]);
      if (!actor) return;
      const rentalId = String(request.body?.rentalId ?? "");
      const file = firstFile(request, "proof");
      const reference = request.body?.reference;
      const amount = Number(request.body?.amount ?? 0);
      const paymentDate = String(request.body?.paymentDate ?? "");
      const notes = String(request.body?.notes ?? "");
      if (!rentalId || !file) return badRequest(response, "Rental ID and payment proof file are required.");
      if (!Number.isFinite(amount) || amount <= 0) {
        return badRequest(response, "Enter the payment amount shown by the proof.");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
        return badRequest(response, "Enter a valid payment date.");
      }
      const extensionByType: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "application/pdf": "pdf",
      };
      const extension = extensionByType[file.mimetype];
      if (!extension) {
        return badRequest(response, "Payment proof must be a JPG, PNG, or PDF file.");
      }
      if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
        return badRequest(response, "Payment proof must be 5 MB or smaller.");
      }
      const directory = nodePath.join(protectedUploadRoot, "rental-payments");
      await mkdir(directory, { recursive: true });
      const generatedName = `${randomUUID()}.${extension}`;
      const absolutePath = nodePath.join(directory, generatedName);
      const storedPath = normalizeProtectedStoragePath(`rental-payments/${generatedName}`);
      await writeFile(absolutePath, file.buffer, { flag: "wx" });
      try {
        return json(
          response,
          await rentalDatabase.uploadRentalPaymentProof(
            rentalId,
            storedPath,
            typeof reference === "string" ? reference : undefined,
            actor,
            amount,
            paymentDate,
            notes || undefined,
          ),
          201,
        );
      } catch (error) {
        await unlink(absolutePath).catch(() => undefined);
        throw error;
      }
    }
    if (resource === "payments" && id && action === "validate") {
      const actor = await authorizeActor(request, response, ["bookkeeper"]);
      if (!actor) return;
      const payload = body<{ status: PaymentStatus; note?: string; amount?: number }>(request);
      const result = await rentalDatabase.validateRentalPayment(
        id,
        payload.status,
        payload.note,
        actor,
        payload.amount,
      );
      if (result && payload.status === "Paid") {
        const inquiry = await rentalDatabase.getRentalInquiryById(result.payment.rentalId);
        if (inquiry) await triggerRentalStatusEmail(inquiry);
      }
      return result ? json(response, result) : notFound(response, "Rental payment was not found.");
    }
    if (resource === "expenses" && !id) {
      const actor = await authorizeActor(request, response, ["bookkeeper"]);
      if (!actor) return;
      return json(
        response,
        await rentalDatabase.recordRentalExpense(
          body<Parameters<typeof rentalDatabase.recordRentalExpense>[0]>(request),
          actor,
        ),
        201,
      );
    }
    if (resource === "maintenance" && !id) {
      const actor = await authorizeActor(request, response, ["chairman"]);
      if (!actor) return;
      return json(
        response,
        await rentalDatabase.createRentalMaintenanceRecord(
          body<Parameters<typeof rentalDatabase.createRentalMaintenanceRecord>[0]>(request),
          actor,
        ),
        201,
      );
    }
    if (resource === "maintenance" && id && action === "complete") {
      const actor = await authorizeActor(request, response, ["chairman"]);
      if (!actor) return;
      const maintenance = await rentalDatabase.completeRentalMaintenance(id, actor);
      return maintenance ? json(response, maintenance) : notFound(response, "Maintenance record was not found.");
    }

    return notFound(response);
  } catch (error) {
    return handleRentalError(response, error);
  }
}

async function patchRental(request: Request, response: Response) {
  try {
    const [resource, id, action] = pathParts(request);
    if (!id) return notFound(response);

    if (resource === "services") {
      const actor = await authorizeActor(request, response, ["chairman"]);
      if (!actor) return;
      const service = await rentalDatabase.updateRentalService(
        id,
        body<Parameters<typeof rentalDatabase.updateRentalService>[1]>(request),
        actor,
      );
      return service ? json(response, service) : notFound(response, "Rental service was not found.");
    }
    if (resource === "inquiries" && action === "status") {
      const actor = await authorizeActor(request, response, ["chairman"]);
      if (!actor) return;
      const payload = body<{ status: RentalStatus; reason?: string }>(request);
      const inquiry = await rentalDatabase.updateRentalStatus(
        id,
        payload.status,
        actor,
        payload.reason,
      );
      if (inquiry) await triggerRentalStatusEmail(inquiry);
      return inquiry ? json(response, inquiry) : notFound(response, "Rental inquiry was not found.");
    }
    if (resource === "member-inquiries" && action === "status") {
      const actor = await authorizeActor(request, response, ["member"]);
      if (!actor) return;
      const payload = body<{
        status: "Scheduled" | "Rescheduled";
        publicNote: string;
        internalNote?: string;
        requestedDate?: string;
        requestedEndDate?: string;
        alternativeDate?: string;
        alternativeEndDate?: string;
        reason?: string;
        note?: string;
      }>(request);
      if (!["Scheduled", "Rescheduled"].includes(payload.status)) {
        return badRequest(response, "Members may only confirm or request rescheduling.");
      }
      const inquiry = await rentalDatabase.updateMemberRentalStatus(
        id,
        payload.status,
        payload.publicNote,
        payload.internalNote,
        actor,
        payload.status === "Rescheduled"
          ? {
              requestedDate: payload.requestedDate ?? "",
              requestedEndDate: payload.requestedEndDate ?? "",
              alternativeDate: payload.alternativeDate,
              alternativeEndDate: payload.alternativeEndDate,
              reason: payload.reason ?? "",
              note: payload.note,
            }
          : undefined,
      );
      if (inquiry) await triggerRentalStatusEmail(inquiry);
      return inquiry
        ? json(response, inquiry)
        : notFound(response, "Rental request was not found in this member account.");
    }
    if (resource === "schedules") {
      const actor = await authorizeActor(request, response, ["chairman"]);
      if (!actor) return;
      const payload = body<Parameters<typeof rentalDatabase.updateRentalSchedule>[1]>(request);
      const schedule = await rentalDatabase.updateRentalSchedule(
        id,
        { ...payload, status: payload.status as ScheduleStatus | undefined },
        actor,
      );
      if (schedule) {
        const inquiry = await rentalDatabase.getRentalInquiryById(schedule.rentalId);
        if (inquiry) await triggerRentalStatusEmail(inquiry);
      }
      return schedule ? json(response, schedule) : notFound(response, "Rental schedule was not found.");
    }
    if (resource === "availability") {
      const actor = await authorizeActor(request, response, ["chairman"]);
      if (!actor) return;
      const payload = body<{ status: Parameters<typeof rentalDatabase.updateEquipmentAvailability>[1] }>(request);
      const availability = await rentalDatabase.updateEquipmentAvailability(
        id,
        payload.status,
        actor,
      );
      return availability ? json(response, availability) : notFound(response, "Rental service was not found.");
    }

    return notFound(response);
  } catch (error) {
    return handleRentalError(response, error);
  }
}

async function uploadRentalAssetImage(request: Request, response: Response) {
  try {
    const requestFiles = [
      ...files(request, "images"),
      ...files(request, "image"),
    ];

    if (!requestFiles.length) {
      return response.status(400).json({ error: "Upload at least one photo." });
    }
    if (requestFiles.length > MAX_RENTAL_ASSET_PHOTOS) {
      return response.status(400).json({ error: "Upload up to 5 photos only." });
    }

    const publicDir = nodePath.join(process.cwd(), "public", "uploads", "rentals");
    await mkdir(publicDir, { recursive: true });

    const urls: string[] = [];
    for (const file of requestFiles) {
      const validationError = validateRentalAssetPhoto({
        size: file.size,
        type: file.mimetype,
      });
      if (validationError) {
        return response.status(400).json({ error: validationError });
      }

      const extension = rentalAssetPhotoExtensionByType[file.mimetype] ?? "jpg";
      const filename = `${randomUUID()}.${extension}`;
      await writeFile(nodePath.join(publicDir, filename), file.buffer);
      urls.push(`/uploads/rentals/${filename}`);
    }

    return response.json({ url: urls[0], urls });
  } catch (error) {
    return handleRentalError(response, error);
  }
}

export function createRentalRouter(authService: AuthService = createAuthService()) {
  const router = Router();
  const optionalAuthenticated = createOptionalAuthenticate(authService);
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];

  router.post(
    "/rental/upload-image",
    ...chairmanOnly,
    upload.fields([
      { name: "images", maxCount: MAX_RENTAL_ASSET_PHOTOS },
      { name: "image", maxCount: 1 },
    ]),
    uploadRentalAssetImage,
  );

  router.get(/^\/rental(?:\/(.*))?$/, optionalAuthenticated, getRental);
  router.post(/^\/rental(?:\/(.*))?$/, optionalAuthenticated, upload.any(), postRental);
  router.patch(/^\/rental(?:\/(.*))?$/, optionalAuthenticated, patchRental);

  return router;
}
