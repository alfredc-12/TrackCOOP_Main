import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/config/roles";
import {
  RentalConflictError,
  rentalDatabase,
  type RentalActor,
} from "@/app/rental/_server/rentalDatabase";
import type { PaymentStatus, RentalStatus, ScheduleStatus } from "@/app/rental/_types/rental";
import {
  getMemberProfileIdForUser,
  requireApiUser,
} from "@/lib/next-api-auth";
import { ZodError } from "zod";
import {
  normalizeProtectedStoragePath,
  protectedUploadRoot,
} from "@/../server/src/storage/protected-storage";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ path: string[] }> };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function notFound(message = "Rental resource was not found.") {
  return json({ message }, 404);
}

function badRequest(message: string) {
  return json({ message }, 400);
}

async function authorize(roles: Role[]) {
  const auth = await requireApiUser(roles);
  return auth.response;
}

async function authorizeActor(roles: Role[]) {
  const auth = await requireApiUser(roles);
  if (auth.response || !auth.user) {
    return { actor: null, response: auth.response };
  }
  const memberId =
    auth.user.role === "member"
      ? await getMemberProfileIdForUser(auth.user.numericId)
      : undefined;
  return {
    actor: {
      userId: auth.user.numericId,
      role: auth.user.role,
      displayName: auth.user.displayName,
      memberId,
    } satisfies RentalActor,
    response: null,
  };
}

async function body<T>(request: Request) {
  return request.json() as Promise<T>;
}

function parseFilters(request: NextRequest) {
  const encoded = request.nextUrl.searchParams.get("filters");
  if (!encoded) return undefined;
  try {
    return JSON.parse(encoded) as Parameters<typeof rentalDatabase.getRentalReports>[0];
  } catch {
    return undefined;
  }
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { path } = await context.params;
    const [resource, id, action] = path;

    if (resource === "overview") {
      const unauthorized = await authorize(["chairman", "bookkeeper"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalOverview());
    }
    if (resource === "services" && !id) {
      return json(await rentalDatabase.getPublicRentalServices());
    }
    if (resource === "services" && id && action === "booked-dates") {
      const blockedDates = await rentalDatabase.getPublicRentalBlockedDates(id);
      return blockedDates
        ? json(blockedDates)
        : notFound("Rental service was not found.");
    }
    if (resource === "services" && id) {
      const service = await rentalDatabase.getPublicRentalServiceById(id);
      return service ? json(service) : notFound("Rental service was not found.");
    }
    if (resource === "member-services") {
      const unauthorized = await authorize(["member"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getMemberRentalServices());
    }
    if (resource === "assets" && !id) {
      const unauthorized = await authorize(["chairman"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalServices());
    }
    if (resource === "assets" && id) {
      const unauthorized = await authorize(["chairman"]);
      if (unauthorized) return unauthorized;
      const service = await rentalDatabase.getRentalServiceById(id);
      return service ? json(service) : notFound("Rental asset was not found.");
    }
    if (resource === "inquiries" && id === "status") {
      const reference = request.nextUrl.searchParams.get("reference") ?? "";
      const contact = request.nextUrl.searchParams.get("contact") ?? "";
      return json(await rentalDatabase.lookupRentalInquiry(reference, contact) ?? null, 200);
    }
    if (resource === "inquiries" && id && action === "history") {
      const unauthorized = await authorize(["chairman"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalStatusHistory(id));
    }
    if (resource === "inquiries" && !id) {
      const unauthorized = await authorize(["chairman", "bookkeeper"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalInquiries());
    }
    if (resource === "inquiries" && id) {
      const unauthorized = await authorize(["chairman"]);
      if (unauthorized) return unauthorized;
      const inquiry = await rentalDatabase.getRentalInquiryById(id);
      return inquiry ? json(inquiry) : notFound("Rental inquiry was not found.");
    }
    if (resource === "member-inquiries" && !id) {
      const auth = await authorizeActor(["member"]);
      if (auth.response) return auth.response;
      if (!auth.actor?.memberId) {
        return json({ message: "Member profile was not found." }, 403);
      }
      return json(
        await rentalDatabase.getRentalInquiriesForMember(auth.actor.memberId),
      );
    }
    if (resource === "member-inquiries" && id) {
      const auth = await authorizeActor(["member"]);
      if (auth.response) return auth.response;
      if (!auth.actor?.memberId) {
        return json({ message: "Member profile was not found." }, 403);
      }
      const inquiry = await rentalDatabase.getRentalInquiryForMember(
        id,
        auth.actor.memberId,
      );
      return inquiry
        ? json(inquiry)
        : notFound("Rental request was not found in this member account.");
    }
    if (resource === "schedules") {
      const unauthorized = await authorize(["chairman", "bookkeeper"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalSchedules());
    }
    if (resource === "availability") {
      const unauthorized = await authorize(["chairman", "bookkeeper"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getEquipmentAvailability());
    }
    if (resource === "maintenance") {
      const unauthorized = await authorize(["chairman"]);
      if (unauthorized) return unauthorized;
      return json(
        await rentalDatabase.getRentalMaintenanceRecords(
          request.nextUrl.searchParams.get("serviceId") ?? undefined,
        ),
      );
    }
    if (resource === "payments" && !id) {
      const unauthorized = await authorize(["chairman", "bookkeeper"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalPayments());
    }
    if (resource === "payments" && id && action === "proof") {
      const auth = await authorizeActor(["chairman", "bookkeeper", "member"]);
      if (auth.response) return auth.response;
      if (!auth.actor) {
        return json({ message: "Authentication is required." }, 401);
      }
      const storedPath = await rentalDatabase.getRentalPaymentProof(
        id,
        auth.actor,
      );
      if (!storedPath) return notFound("Payment proof was not found.");
      const normalized = normalizeProtectedStoragePath(storedPath);
      const absolutePath = nodePath.resolve(process.cwd(), normalized);
      const allowedRoot = `${nodePath.resolve(protectedUploadRoot)}${nodePath.sep}`;
      if (!absolutePath.startsWith(allowedRoot)) {
        return json({ message: "Payment proof path is invalid." }, 403);
      }
      const file = await readFile(absolutePath);
      const extension = nodePath.extname(absolutePath).toLowerCase();
      const contentType =
        extension === ".pdf"
          ? "application/pdf"
          : extension === ".png"
            ? "image/png"
            : "image/jpeg";
      return new NextResponse(file, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="rental-proof-${id}${extension}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (resource === "payments" && id) {
      const unauthorized = await authorize(["chairman", "bookkeeper"]);
      if (unauthorized) return unauthorized;
      const payment = await rentalDatabase.getRentalPaymentById(id);
      return payment ? json(payment) : notFound("Rental payment was not found.");
    }
    if (resource === "expenses") {
      const unauthorized = await authorize(["bookkeeper"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalExpenses());
    }
    if (resource === "receipts" && id) {
      const auth = await authorizeActor(["chairman", "bookkeeper", "member"]);
      if (auth.response) return auth.response;
      const receipt = await rentalDatabase.getRentalReceipt(id);
      if (!receipt) return notFound("Rental receipt was not found.");
      if (auth.actor?.role === "member") {
        if (
          !auth.actor.memberId ||
          !(await rentalDatabase.getRentalInquiryForMember(
            receipt.rentalId,
            auth.actor.memberId,
          ))
        ) {
          return notFound("Rental receipt was not found in this member account.");
        }
      }
      return json(receipt);
    }
    if (resource === "reports") {
      const unauthorized = await authorize(["chairman", "bookkeeper"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalReports(parseFilters(request)));
    }
    if (resource === "analytics" && id === "utilization") {
      const unauthorized = await authorize(["chairman", "bookkeeper"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getEquipmentUtilization());
    }
    if (resource === "analytics") {
      const unauthorized = await authorize(["chairman", "bookkeeper"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalAnalytics());
    }
    if (resource === "notifications") {
      const unauthorized = await authorize(["chairman", "bookkeeper"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalNotifications());
    }
    if (resource === "audit") {
      const unauthorized = await authorize(["chairman"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.getRentalAuditEntries());
    }

    return notFound();
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        { message: "Rental request validation failed.", errors: error.flatten() },
        422,
      );
    }
    if (error instanceof RentalConflictError) {
      return json({ message: error.message, conflict: error.conflict }, 409);
    }
    return json({ message: error instanceof Error ? error.message : "Rental request failed." }, 500);
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const { path } = await context.params;
    const [resource, id, action] = path;

    if (resource === "services" && !id) {
      const auth = await authorizeActor(["chairman"]);
      if (auth.response) return auth.response;
      return json(
        await rentalDatabase.createRentalService(
          await body<Parameters<typeof rentalDatabase.createRentalService>[0]>(
            request,
          ),
          auth.actor ?? undefined,
        ),
        201,
      );
    }
    if (resource === "services" && id && action === "archive") {
      const auth = await authorizeActor(["chairman"]);
      if (auth.response) return auth.response;
      const service = await rentalDatabase.archiveRentalService(
        id,
        auth.actor ?? undefined,
      );
      return service ? json(service) : notFound("Rental service was not found.");
    }
    if (resource === "inquiries" && id === "public") {
      return json(await rentalDatabase.submitRentalInquiry(await body<Parameters<typeof rentalDatabase.submitRentalInquiry>[0]>(request), false), 201);
    }
    if (resource === "requests" && id === "member") {
      const auth = await authorizeActor(["member"]);
      if (auth.response) return auth.response;
      return json(
        await rentalDatabase.submitRentalInquiry(
          await body<Parameters<typeof rentalDatabase.submitRentalInquiry>[0]>(
            request,
          ),
          true,
          auth.actor ?? undefined,
        ),
        201,
      );
    }
    if (resource === "inquiries" && id && action === "review") {
      const auth = await authorizeActor(["chairman"]);
      if (auth.response) return auth.response;
      const payload = await body<{ decision: RentalStatus; publicNote: string; internalNote?: string }>(request);
      const inquiry = await rentalDatabase.reviewRentalInquiry(
        id,
        payload.decision,
        payload.publicNote,
        payload.internalNote,
        auth.actor ?? undefined,
      );
      return inquiry ? json(inquiry) : notFound("Rental inquiry was not found.");
    }
    if (resource === "schedules" && !id) {
      const auth = await authorizeActor(["chairman"]);
      if (auth.response) return auth.response;
      return json(
        await rentalDatabase.createRentalSchedule(
          await body<Parameters<typeof rentalDatabase.createRentalSchedule>[0]>(
            request,
          ),
          auth.actor ?? undefined,
        ),
        201,
      );
    }
    if (resource === "schedules" && id === "conflicts") {
      const unauthorized = await authorize(["chairman"]);
      if (unauthorized) return unauthorized;
      return json(await rentalDatabase.checkScheduleConflict(await body<Parameters<typeof rentalDatabase.checkScheduleConflict>[0]>(request)));
    }
    if (resource === "payments" && !id) {
      const auth = await authorizeActor(["bookkeeper"]);
      if (auth.response) return auth.response;
      return json(
        await rentalDatabase.recordRentalPayment(
          await body<Parameters<typeof rentalDatabase.recordRentalPayment>[0]>(
            request,
          ),
          auth.actor ?? undefined,
        ),
        201,
      );
    }
    if (resource === "payments" && id === "proof") {
      const auth = await authorizeActor(["member", "bookkeeper"]);
      if (auth.response) return auth.response;
      const formData = await request.formData();
      const rentalId = String(formData.get("rentalId") ?? "");
      const file = formData.get("proof");
      const reference = formData.get("reference");
      const amount = Number(formData.get("amount") ?? 0);
      const paymentDate = String(formData.get("paymentDate") ?? "");
      const notes = String(formData.get("notes") ?? "");
      if (!rentalId || !(file instanceof File)) return badRequest("Rental ID and payment proof file are required.");
      if (!Number.isFinite(amount) || amount <= 0) {
        return badRequest("Enter the payment amount shown by the proof.");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
        return badRequest("Enter a valid payment date.");
      }
      const extensionByType: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "application/pdf": "pdf",
      };
      const extension = extensionByType[file.type];
      if (!extension) {
        return badRequest("Payment proof must be a JPG, PNG, or PDF file.");
      }
      if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
        return badRequest("Payment proof must be 5 MB or smaller.");
      }
      const directory = nodePath.join(protectedUploadRoot, "rental-payments");
      await mkdir(directory, { recursive: true });
      const generatedName = `${randomUUID()}.${extension}`;
      const absolutePath = nodePath.join(directory, generatedName);
      const storedPath = normalizeProtectedStoragePath(
        `rental-payments/${generatedName}`,
      );
      await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()), {
        flag: "wx",
      });
      try {
        return json(
          await rentalDatabase.uploadRentalPaymentProof(
            rentalId,
            storedPath,
            typeof reference === "string" ? reference : undefined,
            auth.actor ?? undefined,
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
      const auth = await authorizeActor(["bookkeeper"]);
      if (auth.response) return auth.response;
      const payload = await body<{
        status: PaymentStatus;
        note?: string;
        amount?: number;
      }>(request);
      const result = await rentalDatabase.validateRentalPayment(
        id,
        payload.status,
        payload.note,
        auth.actor ?? undefined,
        payload.amount,
      );
      return result ? json(result) : notFound("Rental payment was not found.");
    }
    if (resource === "expenses" && !id) {
      const auth = await authorizeActor(["bookkeeper"]);
      if (auth.response) return auth.response;
      return json(
        await rentalDatabase.recordRentalExpense(
          await body<Parameters<typeof rentalDatabase.recordRentalExpense>[0]>(
            request,
          ),
          auth.actor ?? undefined,
        ),
        201,
      );
    }
    if (resource === "maintenance" && !id) {
      const auth = await authorizeActor(["chairman"]);
      if (auth.response) return auth.response;
      return json(
        await rentalDatabase.createRentalMaintenanceRecord(
          await body<
            Parameters<
              typeof rentalDatabase.createRentalMaintenanceRecord
            >[0]
          >(request),
          auth.actor ?? undefined,
        ),
        201,
      );
    }
    if (resource === "maintenance" && id && action === "complete") {
      const auth = await authorizeActor(["chairman"]);
      if (auth.response) return auth.response;
      const maintenance = await rentalDatabase.completeRentalMaintenance(
        id,
        auth.actor ?? undefined,
      );
      return maintenance
        ? json(maintenance)
        : notFound("Maintenance record was not found.");
    }

    return notFound();
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        { message: "Rental request validation failed.", errors: error.flatten() },
        422,
      );
    }
    if (error instanceof RentalConflictError) {
      return json({ message: error.message, conflict: error.conflict }, 409);
    }
    return json({ message: error instanceof Error ? error.message : "Rental request failed." }, 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const { path } = await context.params;
    const [resource, id, action] = path;
    if (!id) return notFound();

    if (resource === "services") {
      const auth = await authorizeActor(["chairman"]);
      if (auth.response) return auth.response;
      const service = await rentalDatabase.updateRentalService(
        id,
        await body<Parameters<typeof rentalDatabase.updateRentalService>[1]>(
          request,
        ),
        auth.actor ?? undefined,
      );
      return service ? json(service) : notFound("Rental service was not found.");
    }
    if (resource === "inquiries" && action === "status") {
      const auth = await authorizeActor(["chairman"]);
      if (auth.response) return auth.response;
      const payload = await body<{ status: RentalStatus; reason?: string }>(request);
      const inquiry = await rentalDatabase.updateRentalStatus(
        id,
        payload.status,
        auth.actor ?? undefined,
        payload.reason,
      );
      return inquiry ? json(inquiry) : notFound("Rental inquiry was not found.");
    }
    if (resource === "member-inquiries" && action === "status") {
      const auth = await authorizeActor(["member"]);
      if (auth.response) return auth.response;
      if (!auth.actor) return json({ message: "Authentication is required." }, 401);
      const payload = await body<{
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
        return badRequest("Members may only confirm or request rescheduling.");
      }
      const inquiry = await rentalDatabase.updateMemberRentalStatus(
        id,
        payload.status,
        payload.publicNote,
        payload.internalNote,
        auth.actor,
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
      return inquiry
        ? json(inquiry)
        : notFound("Rental request was not found in this member account.");
    }
    if (resource === "schedules") {
      const auth = await authorizeActor(["chairman"]);
      if (auth.response) return auth.response;
      const payload = await body<Parameters<typeof rentalDatabase.updateRentalSchedule>[1]>(request);
      const schedule = await rentalDatabase.updateRentalSchedule(
        id,
        { ...payload, status: payload.status as ScheduleStatus | undefined },
        auth.actor ?? undefined,
      );
      return schedule ? json(schedule) : notFound("Rental schedule was not found.");
    }
    if (resource === "availability") {
      const auth = await authorizeActor(["chairman"]);
      if (auth.response) return auth.response;
      const payload = await body<{ status: Parameters<typeof rentalDatabase.updateEquipmentAvailability>[1] }>(request);
      const availability = await rentalDatabase.updateEquipmentAvailability(
        id,
        payload.status,
        auth.actor ?? undefined,
      );
      return availability ? json(availability) : notFound("Rental service was not found.");
    }

    return notFound();
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        { message: "Rental request validation failed.", errors: error.flatten() },
        422,
      );
    }
    if (error instanceof RentalConflictError) {
      return json({ message: error.message, conflict: error.conflict }, 409);
    }
    return json({ message: error instanceof Error ? error.message : "Rental request failed." }, 500);
  }
}
