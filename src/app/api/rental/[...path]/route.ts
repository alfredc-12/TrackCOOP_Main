import { NextResponse, type NextRequest } from "next/server";
import { rentalDatabase } from "@/app/rental/_server/rentalDatabase";
import type { PaymentStatus, RentalStatus, ScheduleStatus } from "@/app/rental/_types/rental";

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
    const [resource, id] = path;

    if (resource === "overview") return json(await rentalDatabase.getRentalOverview());
    if (resource === "services" && !id) return json(await rentalDatabase.getRentalServices());
    if (resource === "services" && id) return json(await rentalDatabase.getRentalServiceById(id) ?? null, (await rentalDatabase.getRentalServiceById(id)) ? 200 : 404);
    if (resource === "inquiries" && id === "status") {
      const reference = request.nextUrl.searchParams.get("reference") ?? "";
      const contact = request.nextUrl.searchParams.get("contact") ?? "";
      return json(await rentalDatabase.lookupRentalInquiry(reference, contact) ?? null, 200);
    }
    if (resource === "inquiries" && !id) return json(await rentalDatabase.getRentalInquiries());
    if (resource === "inquiries" && id) return json(await rentalDatabase.getRentalInquiryById(id) ?? null, (await rentalDatabase.getRentalInquiryById(id)) ? 200 : 404);
    if (resource === "schedules") return json(await rentalDatabase.getRentalSchedules());
    if (resource === "availability") return json(await rentalDatabase.getEquipmentAvailability());
    if (resource === "payments" && !id) return json(await rentalDatabase.getRentalPayments());
    if (resource === "payments" && id) return json(await rentalDatabase.getRentalPaymentById(id) ?? null, (await rentalDatabase.getRentalPaymentById(id)) ? 200 : 404);
    if (resource === "expenses") return json(await rentalDatabase.getRentalExpenses());
    if (resource === "receipts" && id) return json(await rentalDatabase.getRentalReceipt(id) ?? null, (await rentalDatabase.getRentalReceipt(id)) ? 200 : 404);
    if (resource === "reports") return json(await rentalDatabase.getRentalReports(parseFilters(request)));
    if (resource === "analytics" && id === "utilization") return json(await rentalDatabase.getEquipmentUtilization());
    if (resource === "analytics") return json(await rentalDatabase.getRentalAnalytics());
    if (resource === "notifications") return json(await rentalDatabase.getRentalNotifications());
    if (resource === "audit") return json(await rentalDatabase.getRentalAuditEntries());

    return notFound();
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "Rental request failed." }, 500);
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const { path } = await context.params;
    const [resource, id, action] = path;

    if (resource === "services" && !id) {
      return json(await rentalDatabase.createRentalService(await body<Parameters<typeof rentalDatabase.createRentalService>[0]>(request)), 201);
    }
    if (resource === "services" && id && action === "archive") {
      const service = await rentalDatabase.archiveRentalService(id);
      return service ? json(service) : notFound("Rental service was not found.");
    }
    if (resource === "inquiries" && id === "public") {
      return json(await rentalDatabase.submitRentalInquiry(await body<Parameters<typeof rentalDatabase.submitRentalInquiry>[0]>(request), false), 201);
    }
    if (resource === "requests" && id === "member") {
      return json(await rentalDatabase.submitRentalInquiry(await body<Parameters<typeof rentalDatabase.submitRentalInquiry>[0]>(request), true), 201);
    }
    if (resource === "inquiries" && id && action === "review") {
      const payload = await body<{ decision: RentalStatus; publicNote: string; internalNote?: string }>(request);
      const inquiry = await rentalDatabase.reviewRentalInquiry(id, payload.decision, payload.publicNote, payload.internalNote);
      return inquiry ? json(inquiry) : notFound("Rental inquiry was not found.");
    }
    if (resource === "schedules" && !id) {
      return json(await rentalDatabase.createRentalSchedule(await body<Parameters<typeof rentalDatabase.createRentalSchedule>[0]>(request)), 201);
    }
    if (resource === "schedules" && id === "conflicts") {
      return json(await rentalDatabase.checkScheduleConflict(await body<Parameters<typeof rentalDatabase.checkScheduleConflict>[0]>(request)));
    }
    if (resource === "payments" && !id) {
      return json(await rentalDatabase.recordRentalPayment(await body<Parameters<typeof rentalDatabase.recordRentalPayment>[0]>(request)), 201);
    }
    if (resource === "payments" && id === "proof") {
      const formData = await request.formData();
      const rentalId = String(formData.get("rentalId") ?? "");
      const file = formData.get("proof");
      const reference = formData.get("reference");
      if (!rentalId || !(file instanceof File)) return badRequest("Rental ID and payment proof file are required.");
      return json(await rentalDatabase.uploadRentalPaymentProof(rentalId, file.name, typeof reference === "string" ? reference : undefined), 201);
    }
    if (resource === "payments" && id && action === "validate") {
      const payload = await body<{ status: PaymentStatus; note?: string }>(request);
      const result = await rentalDatabase.validateRentalPayment(id, payload.status, payload.note);
      return result ? json(result) : notFound("Rental payment was not found.");
    }
    if (resource === "expenses" && !id) {
      return json(await rentalDatabase.recordRentalExpense(await body<Parameters<typeof rentalDatabase.recordRentalExpense>[0]>(request)), 201);
    }

    return notFound();
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "Rental request failed." }, 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const { path } = await context.params;
    const [resource, id, action] = path;
    if (!id) return notFound();

    if (resource === "services") {
      const service = await rentalDatabase.updateRentalService(id, await body<Parameters<typeof rentalDatabase.updateRentalService>[1]>(request));
      return service ? json(service) : notFound("Rental service was not found.");
    }
    if (resource === "inquiries" && action === "status") {
      const payload = await body<{ status: RentalStatus }>(request);
      const inquiry = await rentalDatabase.updateRentalStatus(id, payload.status);
      return inquiry ? json(inquiry) : notFound("Rental inquiry was not found.");
    }
    if (resource === "schedules") {
      const payload = await body<Parameters<typeof rentalDatabase.updateRentalSchedule>[1]>(request);
      const schedule = await rentalDatabase.updateRentalSchedule(id, { ...payload, status: payload.status as ScheduleStatus | undefined });
      return schedule ? json(schedule) : notFound("Rental schedule was not found.");
    }
    if (resource === "availability") {
      const payload = await body<{ status: Parameters<typeof rentalDatabase.updateEquipmentAvailability>[1] }>(request);
      const availability = await rentalDatabase.updateEquipmentAvailability(id, payload.status);
      return availability ? json(availability) : notFound("Rental service was not found.");
    }

    return notFound();
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "Rental request failed." }, 500);
  }
}
