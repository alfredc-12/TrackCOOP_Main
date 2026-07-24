import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { withTransaction } from "@/../server/src/db/transaction";
import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { checkRentalScheduleConflict } from "../_lib/rentalConflict";
import {
  inquirySchema,
  rentalRescheduleSchema,
  rentalScheduleSchema,
  rentalServiceSchema,
} from "../_lib/rentalValidation";
import { assertRentalStatusTransition } from "../_lib/rentalWorkflow";
import type {
  EquipmentAvailability,
  InquiryDraft,
  OperationalStatus,
  PaymentMethod,
  PaymentStatus,
  RentalAnalytics,
  RentalAuditEntry,
  RentalExpense,
  RentalInquiry,
  RentalMaintenanceRecord,
  RentalNotification,
  RentalOverview,
  RentalPayment,
  PublicRentalBlockedDate,
  RentalReceipt,
  RentalReportFilter,
  RentalRescheduleRequest,
  RentalSchedule,
  RentalService,
  RentalStatus,
  RentalStatusHistoryEntry,
  RequesterType,
  ScheduleConflict,
  ScheduleStatus,
  ServiceVisibility,
  PublicRentalInquiryStatus,
} from "../_types/rental";

type DbValue = string | number | boolean | null;
type JsonRecord = Record<string, unknown>;
type DbExecutor = Pool | PoolConnection;

export type RentalActor = {
  userId: number;
  role: "chairman" | "bookkeeper" | "member";
  displayName: string;
  memberId?: number | null;
};

export class RentalConflictError extends Error {
  constructor(public conflict: ScheduleConflict) {
    super(conflict.reasons[0] ?? "The proposed rental schedule conflicts with an existing record.");
    this.name = "RentalConflictError";
  }
}

interface AssetRow extends RowDataPacket {
  rental_asset_id: number;
  asset_code: string;
  asset_name: string;
  asset_type: "Equipment" | "Service" | "Facility" | "Other";
  category: string | null;
  description: string | null;
  rate_amount: string | null;
  rate_unit: "Per Hour" | "Per Day" | "Per Use" | "Per Unit" | "Custom";
  deposit_amount: string | null;
  asset_status: "Available" | "Reserved" | "In Use" | "Maintenance" | "Unavailable" | "Archived";
  public_visibility: 0 | 1;
  created_at: string;
  updated_at: string;
  upcoming_bookings: number;
}

interface BookingRow extends RowDataPacket {
  rental_booking_id: number;
  booking_number: string;
  rental_asset_id: number;
  member_id: number | null;
  requester_name: string | null;
  requester_contact: string | null;
  purpose: string | null;
  start_datetime: string;
  end_datetime: string;
  booking_status: "Inquiry" | "Pending" | "Approved" | "Scheduled" | "In Use" | "Completed" | "Rescheduled" | "Cancelled" | "Rejected";
  rate_amount: string | null;
  deposit_amount: string;
  total_amount: string;
  payment_status: "Unpaid" | "Partially Paid" | "Paid" | "Refunded";
  approved_at: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
  asset_code: string;
  asset_name: string;
  asset_status: AssetRow["asset_status"];
  asset_description: string | null;
  category: string | null;
  member_code: string | null;
  member_full_name: string | null;
  member_contact_number: string | null;
  member_email: string | null;
  member_barangay: string | null;
  member_municipality: string | null;
}

interface PaymentRow extends RowDataPacket {
  payment_reference_id: number;
  member_id: number | null;
  payer_name: string | null;
  payer_email: string | null;
  payer_contact: string | null;
  provider: string;
  reference_number: string;
  amount: string;
  proof_file_path: string | null;
  validation_status: "Pending" | "Validated" | "Rejected" | "Needs Clarification";
  notes: string | null;
  submitted_at: string;
  updated_at: string;
  booking_number: string;
  requester_name: string | null;
  requester_contact: string | null;
  start_datetime: string;
  purpose: string | null;
  asset_name: string;
  member_code: string | null;
}

interface ExpenseRow extends RowDataPacket {
  financial_record_id: number;
  record_number: string;
  source_record_id: number | null;
  amount: string;
  record_date: string;
  remarks: string | null;
  category_name: string;
  booking_number: string | null;
  asset_name: string | null;
}

interface NotificationRow extends RowDataPacket {
  notification_id: number;
  notification_type: string;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: number | null;
  is_read: 0 | 1;
  created_at: string;
  booking_number: string | null;
  payment_notes: string | null;
}

interface AuditRow extends RowDataPacket {
  audit_log_id: number;
  action: string;
  entity_table: string;
  record_id: number | null;
  description: string | null;
  old_values: string | null;
  new_values: string | null;
  action_time: string;
  display_name: string | null;
}

interface StatusHistoryRow extends RowDataPacket {
  rental_status_history_id: number;
  booking_number: string;
  old_status: string | null;
  new_status: string;
  remarks: string | null;
  changed_at: string;
  display_name: string | null;
}

interface MaintenanceRow extends RowDataPacket {
  rental_maintenance_id: number;
  rental_asset_id: number;
  asset_code: string;
  asset_name: string;
  maintenance_type: string;
  start_datetime: string;
  end_datetime: string;
  description: string;
  technician_provider: string | null;
  cost: string | null;
  internal_note: string | null;
  operational_impact: RentalMaintenanceRecord["operationalImpact"];
  maintenance_status: RentalMaintenanceRecord["status"];
  created_by: number;
  created_by_name: string | null;
  completed_at: string | null;
  created_at: string;
}

const defaultSafetyReminders = [
  "Follow the assigned operator safety briefing.",
  "Keep children and bystanders away from the operating area.",
  "Report unsafe ground or weather conditions before operation.",
];

async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  params: DbValue[] = [],
  executor: DbExecutor = db,
) {
  const [rows] = await executor.query<T>(sql, params);
  return rows;
}

async function execute(
  sql: string,
  params: DbValue[] = [],
  executor: DbExecutor = db,
) {
  const [result] = await executor.execute<ResultSetHeader>(sql, params);
  return result;
}

async function withRentalTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
) {
  return withTransaction(work, db);
}

function cleanParams(values: Array<string | number | boolean | null | undefined>): DbValue[] {
  return values.map((value) => value ?? null);
}

function parseJson(value: string | null | undefined): JsonRecord {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : {};
  } catch {
    return {};
  }
}

function stringValue(meta: JsonRecord, key: string, fallback = "") {
  const value = meta[key];
  return typeof value === "string" ? value : fallback;
}

function stringArrayValue(meta: JsonRecord, key: string, fallback: string[] = []) {
  const value = meta[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
}

function rescheduleRequestValue(
  meta: JsonRecord,
): RentalRescheduleRequest | undefined {
  const value = meta.rescheduleRequest;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const request = value as JsonRecord;
  const requestedDate = stringValue(request, "requestedDate");
  const reason = stringValue(request, "reason");
  const requestedAt = stringValue(request, "requestedAt");
  if (!requestedDate || !reason || !requestedAt) return undefined;
  return {
    requestedDate,
    requestedEndDate:
      stringValue(request, "requestedEndDate", requestedDate) || undefined,
    alternativeDate: stringValue(request, "alternativeDate") || undefined,
    alternativeEndDate:
      stringValue(request, "alternativeEndDate") || undefined,
    reason,
    note: stringValue(request, "note") || undefined,
    requestedAt,
    status: request.status === "Approved" ? "Approved" : "Pending",
  };
}

function datePart(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function localDateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKeysBetween(startDate: string, endDate: string) {
  if (!startDate || !endDate) return [];
  const start = localDateFromKey(startDate);
  const end = localDateFromKey(endDate);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) {
    return [];
  }

  const dates: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
    );
  }
  return dates;
}

function timePart(value: string | null | undefined) {
  return value && value.length >= 16 ? value.slice(11, 16) : "";
}

function isoDateTime(value: string | null | undefined) {
  if (!value) return new Date().toISOString();
  return value.includes("T") ? value : `${value.replace(" ", "T")}+08:00`;
}

function toMysqlDateTime(date: string, time: string) {
  return `${date} ${time || "08:00"}:00`;
}

function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function rentalStatusFromBooking(status: BookingRow["booking_status"], meta: JsonRecord): RentalStatus {
  const override = stringValue(meta, "statusOverride");
  if (isRentalStatus(override)) return override;
  if (status === "Inquiry") return "New Inquiry";
  if (status === "Pending") return "Under Review";
  if (status === "Approved") return "Approved for Scheduling";
  if (status === "Scheduled") return "Scheduled";
  if (status === "In Use") return "In Progress";
  if (status === "Completed") return "Completed";
  if (status === "Rescheduled") return "Rescheduled";
  if (status === "Cancelled") return "Cancelled";
  return "Rejected";
}

function isRentalStatus(value: string): value is RentalStatus {
  return [
    "New Inquiry",
    "Under Review",
    "Awaiting Information",
    "Awaiting Confirmation",
    "Approved for Scheduling",
    "Scheduled",
    "Payment Pending",
    "Payment Under Review",
    "Payment Confirmed",
    "In Progress",
    "Completed",
    "Cancelled",
    "Rescheduled",
    "Rejected",
    "On Hold",
  ].includes(value);
}

function bookingStatusFromRental(status: RentalStatus): BookingRow["booking_status"] {
  if (status === "New Inquiry") return "Inquiry";
  if (status === "Approved for Scheduling" || status === "Awaiting Confirmation" || status === "Payment Pending" || status === "Payment Under Review" || status === "Payment Confirmed") return "Approved";
  if (status === "Scheduled") return "Scheduled";
  if (status === "In Progress") return "In Use";
  if (status === "Completed") return "Completed";
  if (status === "Cancelled") return "Cancelled";
  if (status === "Rescheduled") return "Rescheduled";
  if (status === "Rejected") return "Rejected";
  return "Pending";
}

function scheduleStatusFromBooking(row: BookingRow, meta: JsonRecord): ScheduleStatus {
  const stored = stringValue(meta, "scheduleStatus");
  if (isScheduleStatus(stored)) return stored;
  if (row.booking_status === "Scheduled") return "Confirmed";
  if (row.booking_status === "In Use") return "In Progress";
  if (row.booking_status === "Completed") return "Completed";
  if (row.booking_status === "Cancelled") return "Cancelled";
  if (row.booking_status === "Approved") return "Proposed";
  return "Proposed";
}

function isScheduleStatus(value: string): value is ScheduleStatus {
  return ["Proposed", "Awaiting Confirmation", "Confirmed", "In Progress", "Completed", "Cancelled", "Maintenance"].includes(value);
}

function bookingStatusFromSchedule(status: ScheduleStatus): BookingRow["booking_status"] {
  if (status === "Confirmed" || status === "Maintenance") return "Scheduled";
  if (status === "In Progress") return "In Use";
  if (status === "Completed") return "Completed";
  if (status === "Cancelled") return "Cancelled";
  return "Approved";
}

function paymentStatusFromBooking(status: BookingRow["payment_status"], meta?: JsonRecord): PaymentStatus {
  const override = meta ? stringValue(meta, "paymentStatusOverride") : "";
  if (isPaymentStatus(override)) return override;
  if (status === "Paid") return "Paid";
  if (status === "Partially Paid") return "Partially Paid";
  if (status === "Refunded") return "Refunded";
  return "Pending";
}

function bookingPaymentStatusFromPayment(status: PaymentStatus): BookingRow["payment_status"] {
  if (status === "Paid") return "Paid";
  if (status === "Refunded") return "Refunded";
  if (status === "Partially Paid" || status === "Under Review") return "Partially Paid";
  return "Unpaid";
}

function paymentStatusFromValidation(status: PaymentRow["validation_status"], meta: JsonRecord): PaymentStatus {
  const stored = stringValue(meta, "status");
  if (isPaymentStatus(stored)) return stored;
  if (status === "Validated") return "Paid";
  if (status === "Rejected") return "Rejected";
  if (status === "Needs Clarification") return "Needs Clarification";
  return "Under Review";
}

function validationFromPaymentStatus(status: PaymentStatus): PaymentRow["validation_status"] {
  if (status === "Paid") return "Validated";
  if (status === "Rejected") return "Rejected";
  if (status === "Needs Clarification") return "Needs Clarification";
  return "Pending";
}

function isPaymentStatus(value: string): value is PaymentStatus {
  return ["Pending", "Under Review", "Partially Paid", "Paid", "Rejected", "Refunded", "Needs Clarification"].includes(value);
}

function requesterType(value: string): RequesterType {
  return value === "Public or Non-member" ? "Public or Non-member" : "Member";
}

function paymentMethod(value: string): PaymentMethod {
  if (["Direct GCash", "GCash Reference Upload", "Cash", "Bank Transfer", "Other Approved Method"].includes(value)) {
    return value as PaymentMethod;
  }
  return "Other Approved Method";
}

function assetStatusFromService(service: Partial<RentalService>): AssetRow["asset_status"] {
  if (service.operationalStatus === "Archived") return "Archived";
  if (service.operationalStatus === "Under Maintenance") return "Maintenance";
  if (service.operationalStatus === "Out of Service" || service.availability === "Unavailable") return "Unavailable";
  if (service.availability === "By Schedule Only" || service.availability === "Limited Availability") return "Reserved";
  return "Available";
}

function serviceAvailability(row: AssetRow, meta: JsonRecord): RentalService["availability"] {
  const stored = stringValue(meta, "availability");
  if (["Available", "Limited Availability", "Unavailable", "By Schedule Only"].includes(stored)) return stored as RentalService["availability"];
  if (row.asset_status === "Unavailable" || row.asset_status === "Archived") return "Unavailable";
  if (row.asset_status === "Reserved" || row.asset_status === "In Use") return "By Schedule Only";
  return "Available";
}

function operationalStatus(row: AssetRow, meta: JsonRecord): OperationalStatus {
  const stored = stringValue(meta, "operationalStatus");
  if (["Ready for Use", "Under Maintenance", "Out of Service", "Archived"].includes(stored)) return stored as OperationalStatus;
  if (row.asset_status === "Maintenance") return "Under Maintenance";
  if (row.asset_status === "Unavailable") return "Out of Service";
  if (row.asset_status === "Archived") return "Archived";
  return "Ready for Use";
}

function visibility(row: AssetRow, meta: JsonRecord): ServiceVisibility {
  const stored = stringValue(meta, "visibility");
  if (["Public", "Member-only", "Internal only", "Hidden"].includes(stored)) return stored as ServiceVisibility;
  return row.public_visibility ? "Public" : "Hidden";
}

function serviceDescriptionPayload(service: Partial<RentalService>) {
  return JSON.stringify({
    shortDescription: service.shortDescription ?? "",
    description: service.description ?? "",
    availability: service.availability ?? "Available",
    operationalStatus: service.operationalStatus ?? "Ready for Use",
    visibility: service.visibility ?? "Public",
    unitOfUsage: service.unitOfUsage ?? "",
    suitableActivity: service.suitableActivity ?? "",
    capacity: service.capacity ?? "",
    serviceArea: service.serviceArea ?? "Nasugbu service barangays",
    operatorRequirement: service.operatorRequirement ?? "Cooperative operator confirmation required",
    operationalNotes: service.operationalNotes ?? "",
    safetyReminders: service.safetyReminders ?? defaultSafetyReminders,
    imageUrl: service.imageUrl ?? "",
    imageUrls: service.imageUrls ?? [],
    lastMaintenanceDate: service.lastMaintenanceDate ?? "",
    nextMaintenanceDate: service.nextMaintenanceDate ?? "",
    assetCondition: service.assetCondition ?? "",
    internalNotes: service.internalNotes ?? "",
    availableDays: service.availableDays ?? [],
    availableStartTime: service.availableStartTime ?? "",
    availableEndTime: service.availableEndTime ?? "",
    maximumBookingsPerDay: service.maximumBookingsPerDay ?? 1,
    preparationMinutes: service.preparationMinutes ?? 0,
    travelMinutes: service.travelMinutes ?? 0,
    bufferMinutes: service.bufferMinutes ?? 0,
    assignedCustodian: service.assignedCustodian ?? "",
    publicTitle: service.publicTitle ?? "",
    publicDescription: service.publicDescription ?? "",
    publicNotes: service.publicNotes ?? "",
    publicAvailabilityMessage: service.publicAvailabilityMessage ?? "",
    featured: service.featured ?? false,
    memberRate: service.memberRate ?? null,
    nonMemberRate: service.nonMemberRate ?? null,
    gasolineHandling: service.gasolineHandling ?? null,
    cancellationPolicy: service.cancellationPolicy ?? null,
    reschedulingPolicy: service.reschedulingPolicy ?? null,
    paymentDeadline: service.paymentDeadline ?? null,
  });
}

function mapAsset(row: AssetRow): RentalService {
  const meta = parseJson(row.description);
  const plainDescription = row.description && Object.keys(meta).length === 0 ? row.description : "";
  const description = stringValue(meta, "description", plainDescription || `${row.asset_name} rental service.`);
  return {
    serviceId: row.asset_code,
    name: row.asset_name,
    category: row.category ?? "Rental",
    shortDescription: stringValue(meta, "shortDescription", description),
    description,
    imageUrl: stringValue(meta, "imageUrl") || undefined,
    imageUrls: stringArrayValue(meta, "imageUrls"),
    availability: serviceAvailability(row, meta),
    operationalStatus: operationalStatus(row, meta),
    visibility: visibility(row, meta),
    unitOfUsage: stringValue(meta, "unitOfUsage", row.rate_unit),
    suitableActivity: stringValue(meta, "suitableActivity", row.category ?? "Agricultural support"),
    capacity: stringValue(meta, "capacity", "Confirmed during inquiry review"),
    serviceArea: stringValue(meta, "serviceArea", "Nasugbu service barangays"),
    operatorRequirement: stringValue(meta, "operatorRequirement", "Cooperative operator confirmation required"),
    operationalNotes: stringValue(meta, "operationalNotes", "Final operating arrangements are confirmed during cooperative review."),
    safetyReminders: stringArrayValue(meta, "safetyReminders", defaultSafetyReminders),
    upcomingBookings: Number(row.upcoming_bookings ?? 0),
    createdAt: isoDateTime(row.created_at),
    lastMaintenanceDate: stringValue(meta, "lastMaintenanceDate") || undefined,
    nextMaintenanceDate: stringValue(meta, "nextMaintenanceDate") || undefined,
    assetCondition: stringValue(meta, "assetCondition") || undefined,
    internalNotes: stringValue(meta, "internalNotes") || undefined,
    availableDays: stringArrayValue(meta, "availableDays"),
    availableStartTime: stringValue(meta, "availableStartTime") || undefined,
    availableEndTime: stringValue(meta, "availableEndTime") || undefined,
    maximumBookingsPerDay: numberValue(
      typeof meta.maximumBookingsPerDay === "number"
        ? meta.maximumBookingsPerDay
        : undefined,
    ),
    preparationMinutes: numberValue(
      typeof meta.preparationMinutes === "number"
        ? meta.preparationMinutes
        : undefined,
    ),
    travelMinutes: numberValue(
      typeof meta.travelMinutes === "number" ? meta.travelMinutes : undefined,
    ),
    bufferMinutes: numberValue(
      typeof meta.bufferMinutes === "number" ? meta.bufferMinutes : undefined,
    ),
    assignedCustodian: stringValue(meta, "assignedCustodian") || undefined,
    publicTitle: stringValue(meta, "publicTitle") || undefined,
    publicDescription: stringValue(meta, "publicDescription") || undefined,
    publicNotes: stringValue(meta, "publicNotes") || undefined,
    publicAvailabilityMessage:
      stringValue(meta, "publicAvailabilityMessage") || undefined,
    featured: Boolean(meta.featured),
    standardRate: row.rate_amount === null ? null : numberValue(row.rate_amount),
    memberRate:
      typeof meta.memberRate === "number" ? meta.memberRate : null,
    nonMemberRate:
      typeof meta.nonMemberRate === "number" ? meta.nonMemberRate : null,
    gasolineHandling: stringValue(meta, "gasolineHandling") || null,
    depositRequirement:
      row.deposit_amount === null ? null : numberValue(row.deposit_amount),
    cancellationPolicy: stringValue(meta, "cancellationPolicy") || null,
    reschedulingPolicy: stringValue(meta, "reschedulingPolicy") || null,
    paymentDeadline: stringValue(meta, "paymentDeadline") || null,
    updatedAt: isoDateTime(row.updated_at),
  };
}

function mapBooking(row: BookingRow): RentalInquiry {
  const meta = parseJson(row.purpose);
  const requestType = requesterType(stringValue(meta, "requesterType", row.member_id ? "Member" : "Public or Non-member"));
  const requesterName = row.requester_name ?? row.member_full_name ?? "Rental requester";
  const barangay = stringValue(meta, "barangay", row.member_barangay ?? stringValue(meta, "serviceBarangay", ""));
  const municipality = stringValue(meta, "municipality", row.member_municipality ?? "Nasugbu");
  const preferredDate = stringValue(meta, "preferredDate", datePart(row.start_datetime));
  const preferredEndDate = stringValue(
    meta,
    "preferredEndDate",
    datePart(row.end_datetime) || preferredDate,
  );
  return {
    inquiryId: row.booking_number,
    rentalId: row.booking_number,
    requester: {
      requesterId: row.member_id ? `MEM-${row.member_id}` : `REQ-${row.booking_number.slice(-4)}`,
      fullName: requesterName,
      requesterType: requestType,
      memberId: stringValue(meta, "memberCode", row.member_code ?? "") || undefined,
      contactNumber: row.requester_contact ?? row.member_contact_number ?? "",
      email: stringValue(meta, "email", row.member_email ?? "") || undefined,
      completeAddress: stringValue(meta, "completeAddress", barangay ? `${barangay}, ${municipality}, Batangas` : "Nasugbu, Batangas"),
      barangay,
      municipality,
      preferredContactMethod: stringValue(meta, "preferredContactMethod", "SMS") as RentalInquiry["requester"]["preferredContactMethod"],
    },
    serviceId: row.asset_code,
    equipmentName: row.asset_name,
    intendedUse: stringValue(meta, "intendedUse", row.category ?? "Agricultural rental"),
    preferredDate,
    preferredEndDate,
    alternativeDate: stringValue(meta, "alternativeDate") || undefined,
    alternativeEndDate: stringValue(meta, "alternativeEndDate") || undefined,
    preferredStartTime: stringValue(meta, "preferredStartTime", timePart(row.start_datetime)) || undefined,
    preferredEndTime: stringValue(meta, "preferredEndTime", timePart(row.end_datetime)) || undefined,
    estimatedDuration: stringValue(meta, "estimatedDuration", "2 hours"),
    estimatedUsage: stringValue(meta, "estimatedUsage", "To be confirmed"),
    unitOfMeasurement: stringValue(meta, "unitOfMeasurement", "Operating session"),
    serviceLocation: stringValue(meta, "serviceLocation", "Nasugbu service area"),
    serviceBarangay: stringValue(meta, "serviceBarangay", barangay),
    requestDescription: stringValue(meta, "requestDescription", row.purpose && Object.keys(meta).length === 0 ? row.purpose : "Rental request recorded in TrackCOOP."),
    specialInstructions: stringValue(meta, "specialInstructions") || undefined,
    additionalNotes: stringValue(meta, "additionalNotes") || undefined,
    attachmentNames: stringArrayValue(meta, "attachmentNames"),
    status: rentalStatusFromBooking(row.booking_status, meta),
    paymentStatus: paymentStatusFromBooking(row.payment_status, meta),
    scheduleStatus: stringValue(meta, "scheduleStatus", scheduleStatusFromBooking(row, meta)),
    assignedReviewer: stringValue(meta, "assignedReviewer") || undefined,
    rescheduleRequest: rescheduleRequestValue(meta),
    publicNote: stringValue(meta, "publicNote", "NFFAC received your inquiry and will review availability, schedule, pricing, and rental conditions."),
    internalNote: stringValue(meta, "internalNote") || undefined,
    submittedAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
  };
}

function mapSchedule(row: BookingRow): RentalSchedule {
  const meta = parseJson(row.purpose);
  const scheduleId = stringValue(meta, "scheduleId", row.booking_number.startsWith("RNT-") ? `SCH-${row.booking_number.slice(-4)}` : `SCH-${row.rental_booking_id}`);
  return {
    scheduleId,
    inquiryId: row.booking_number,
    rentalId: row.booking_number,
    serviceId: row.asset_code,
    equipmentName: row.asset_name,
    requesterName: row.requester_name ?? "Rental requester",
    requesterType: requesterType(stringValue(meta, "requesterType", row.member_id ? "Member" : "Public or Non-member")),
    date: datePart(row.start_datetime),
    endDate: datePart(row.end_datetime) || datePart(row.start_datetime),
    startTime: timePart(row.start_datetime),
    endTime: timePart(row.end_datetime),
    assignedOperator: stringValue(meta, "assignedOperator") || undefined,
    serviceLocation: stringValue(meta, "serviceLocation", "Nasugbu service area"),
    barangay: stringValue(meta, "serviceBarangay", stringValue(meta, "barangay")),
    preparationMinutes: Number(meta.preparationMinutes ?? 30),
    travelMinutes: Number(meta.travelMinutes ?? 30),
    bufferMinutes: Number(meta.bufferMinutes ?? 30),
    specialInstructions: stringValue(meta, "specialInstructions") || undefined,
    status: scheduleStatusFromBooking(row, meta),
    paymentStatus: paymentStatusFromBooking(row.payment_status, meta),
  };
}

function mapPayment(row: PaymentRow): RentalPayment {
  const meta = parseJson(row.notes);
  const bookingMeta = parseJson(row.purpose);
  const paymentId = stringValue(meta, "paymentId", `PAY-${String(row.payment_reference_id).padStart(4, "0")}`);
  return {
    paymentId,
    rentalId: row.booking_number,
    requesterName: row.payer_name ?? row.requester_name ?? "Rental requester",
    equipmentName: row.asset_name,
    scheduleDate: stringValue(meta, "scheduleDate", datePart(row.start_datetime)),
    amount: numberValue(row.amount),
    paymentDate: stringValue(meta, "paymentDate", datePart(row.submitted_at)),
    paymentMethod: paymentMethod(stringValue(meta, "paymentMethod", row.provider)),
    gcashReference: row.reference_number || undefined,
    receiptNumber: stringValue(meta, "receiptNumber") || undefined,
    status: paymentStatusFromValidation(row.validation_status, meta),
    notes: stringValue(meta, "notes") || undefined,
    proofFileName: row.proof_file_path ?? undefined,
    recordedBy: stringValue(meta, "recordedBy", row.member_id ? row.payer_name ?? "Member upload" : "NFFAC Bookkeeper"),
    submittedAt: isoDateTime(row.submitted_at || stringValue(bookingMeta, "submittedAt")),
  };
}

function mapExpense(row: ExpenseRow): RentalExpense {
  const meta = parseJson(row.remarks);
  return {
    expenseId: stringValue(meta, "expenseId", `EXP-${String(row.financial_record_id).padStart(3, "0")}`),
    rentalId: stringValue(meta, "rentalId", row.booking_number ?? ""),
    expenseDate: datePart(row.record_date),
    equipmentName: stringValue(meta, "equipmentName", row.asset_name ?? "Rental asset"),
    category: stringValue(meta, "category", row.category_name),
    amount: numberValue(row.amount),
    payee: stringValue(meta, "payee", "Recorded payee"),
    paymentMethod: stringValue(meta, "paymentMethod", "Cash"),
    referenceNumber: stringValue(meta, "referenceNumber") || undefined,
    receiptFileName: stringValue(meta, "receiptFileName") || undefined,
    description: stringValue(meta, "description", row.remarks ?? "Rental-related expense."),
    remarks: stringValue(meta, "remarks") || undefined,
    encodedBy: stringValue(meta, "encodedBy", "NFFAC Bookkeeper"),
  };
}

function mapNotification(row: NotificationRow): RentalNotification {
  const paymentMeta = parseJson(row.payment_notes);
  const paymentId = stringValue(paymentMeta, "paymentId");
  const relatedRental = row.booking_number ?? "";
  const href = row.related_entity_type === "payment_references" && paymentId
    ? `/rental/payments/${paymentId}/validate`
    : relatedRental
      ? `/portal/chairman/rentals/bookings/${relatedRental}`
      : undefined;
  return {
    notificationId: `NTF-${String(row.notification_id).padStart(3, "0")}`,
    type: row.title.includes("Payment") ? "Payment Proof Received" : row.title.includes("schedule") ? "Schedule Confirmed" : "Inquiry Received",
    title: row.title,
    message: row.message,
    createdAt: isoDateTime(row.created_at),
    rentalId: relatedRental || undefined,
    read: Boolean(row.is_read),
    href,
  };
}

function mapAudit(row: AuditRow): RentalAuditEntry {
  const newValues = parseJson(row.new_values);
  const oldValues = parseJson(row.old_values);
  const rentalId = stringValue(newValues, "booking_number") || stringValue(oldValues, "booking_number") || undefined;
  return {
    auditId: `AUD-${String(row.audit_log_id).padStart(3, "0")}`,
    createdAt: isoDateTime(row.action_time),
    user: row.display_name ?? "NFFAC Chairman",
    role: row.action.toLowerCase().includes("payment") ? "Bookkeeper" : "Chairman",
    action: row.action,
    rentalId,
    equipmentName: stringValue(newValues, "asset_name") || undefined,
    recordAffected: row.entity_table,
    previousValue: stringValue(oldValues, "status") || undefined,
    newValue: stringValue(newValues, "status") || undefined,
    status: "Success",
    details: (row.description ?? "Rental audit event.").replace(/^trackcoop-rental-seed:\s*/, ""),
  };
}

function mapStatusHistory(row: StatusHistoryRow): RentalStatusHistoryEntry {
  return {
    historyId: `HST-${String(row.rental_status_history_id).padStart(4, "0")}`,
    inquiryId: row.booking_number,
    previousStatus: row.old_status ?? undefined,
    newStatus: row.new_status,
    remarks: row.remarks ?? undefined,
    changedBy: row.display_name ?? "NFFAC staff",
    changedAt: isoDateTime(row.changed_at),
  };
}

function mapMaintenance(row: MaintenanceRow): RentalMaintenanceRecord {
  return {
    maintenanceId: `MNT-${String(row.rental_maintenance_id).padStart(4, "0")}`,
    serviceId: row.asset_code,
    equipmentName: row.asset_name,
    maintenanceType: row.maintenance_type,
    startAt: isoDateTime(row.start_datetime),
    endAt: isoDateTime(row.end_datetime),
    description: row.description,
    technician: row.technician_provider ?? undefined,
    cost: row.cost === null ? undefined : Number(row.cost),
    internalNote: row.internal_note ?? undefined,
    operationalImpact: row.operational_impact,
    status: row.maintenance_status,
    createdBy: row.created_by_name ?? `User ${row.created_by}`,
    createdAt: isoDateTime(row.created_at),
    completedAt: row.completed_at
      ? isoDateTime(row.completed_at)
      : undefined,
  };
}

function mapPublicInquiryStatus(
  inquiry: RentalInquiry,
): PublicRentalInquiryStatus {
  const confirmed =
    ["Confirmed", "In Progress", "Completed"].includes(inquiry.scheduleStatus) &&
    inquiry.preferredStartTime
      ? {
          date: inquiry.preferredDate,
          endDate: inquiry.preferredEndDate,
          startTime: inquiry.preferredStartTime,
          endTime: inquiry.preferredEndTime ?? "",
        }
      : undefined;
  return {
    inquiryId: inquiry.inquiryId,
    equipmentName: inquiry.equipmentName,
    submittedAt: inquiry.submittedAt,
    status: inquiry.status,
    scheduleStatus: inquiry.scheduleStatus,
    paymentStatus: inquiry.paymentStatus,
    confirmedSchedule: confirmed,
    publicNote: inquiry.publicNote,
    updatedAt: inquiry.updatedAt,
  };
}

async function systemUserId(executor: DbExecutor = db) {
  const rows = await queryRows<Array<RowDataPacket & { user_id: number }>>(
    `SELECT u.user_id
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug = 'chairman'
        AND u.account_status = 'Active'
      ORDER BY u.user_id ASC
      LIMIT 1`,
    [],
    executor,
  );
  if (rows[0]) return rows[0].user_id;
  throw new Error("A live Chairman account is required before rental records can be mutated.");
}

async function actorUserId(
  actor: RentalActor | undefined,
  executor: DbExecutor = db,
) {
  return actor?.userId ?? systemUserId(executor);
}

async function assetRows(
  where = "",
  params: DbValue[] = [],
  executor: DbExecutor = db,
) {
  return queryRows<AssetRow[]>(
    `SELECT a.*,
      (SELECT COUNT(*)
         FROM rental_bookings rb
        WHERE rb.rental_asset_id = a.rental_asset_id
          AND rb.booking_status IN ('Approved', 'Scheduled', 'In Use')
          AND rb.start_datetime >= NOW()) AS upcoming_bookings
     FROM rental_assets a
     ${where}
     ORDER BY a.public_visibility DESC, a.asset_name ASC`,
    params,
    executor,
  );
}

async function bookingRows(
  where = "",
  params: DbValue[] = [],
  executor: DbExecutor = db,
) {
  return queryRows<BookingRow[]>(
    `SELECT rb.*, a.asset_code, a.asset_name, a.asset_status, a.description AS asset_description, a.category,
            mp.member_code, mp.full_name AS member_full_name, mp.contact_number AS member_contact_number,
            mp.email AS member_email, mp.barangay AS member_barangay, mp.municipality AS member_municipality
       FROM rental_bookings rb
       JOIN rental_assets a ON a.rental_asset_id = rb.rental_asset_id
       LEFT JOIN member_profiles mp ON mp.member_id = rb.member_id
      ${where}
      ORDER BY rb.start_datetime DESC, rb.rental_booking_id DESC`,
    params,
    executor,
  );
}

async function paymentRows(
  where = "",
  params: DbValue[] = [],
  executor: DbExecutor = db,
) {
  return queryRows<PaymentRow[]>(
    `SELECT pr.*, rb.booking_number, rb.requester_name, rb.requester_contact, rb.start_datetime, rb.purpose,
            a.asset_name, mp.member_code
       FROM payment_references pr
       JOIN rental_bookings rb ON rb.rental_booking_id = pr.related_entity_id
       JOIN rental_assets a ON a.rental_asset_id = rb.rental_asset_id
       LEFT JOIN member_profiles mp ON mp.member_id = pr.member_id
      WHERE pr.payment_purpose = 'Rental'
        AND pr.related_entity_type = 'rental_bookings'
        ${where}
      ORDER BY pr.submitted_at DESC, pr.payment_reference_id DESC`,
    params,
    executor,
  );
}

async function bookingByRentalId(
  rentalId: string,
  executor: DbExecutor = db,
) {
  const rows = await bookingRows(
    "WHERE rb.booking_number = ?",
    [rentalId],
    executor,
  );
  return rows[0];
}

async function bookingByScheduleId(
  scheduleId: string,
  executor: DbExecutor = db,
) {
  const rows = await bookingRows(
    "WHERE rb.booking_number LIKE 'RNT-%' OR rb.booking_number LIKE 'MAINTENANCE-%'",
    [],
    executor,
  );
  return rows.find((row) => mapSchedule(row).scheduleId === scheduleId);
}

async function paymentByPaymentId(
  paymentId: string,
  executor: DbExecutor = db,
) {
  const rows = await paymentRows("", [], executor);
  return rows.find((row) => mapPayment(row).paymentId === paymentId);
}

async function addRentalAudit(
  action: string,
  entityTable: string,
  recordId: number,
  details: string,
  oldStatus?: string,
  newStatus?: string,
  actor?: RentalActor,
  executor: DbExecutor = db,
) {
  const userId = await actorUserId(actor, executor);
  await execute(
    "INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, old_values, new_values, action_time) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
    cleanParams([
      userId,
      action,
      entityTable,
      recordId,
      details,
      oldStatus ? JSON.stringify({ status: oldStatus }) : null,
      newStatus ? JSON.stringify({ status: newStatus }) : null,
    ]),
    executor,
  );
}

async function addStatusHistory(
  bookingId: number,
  oldStatus: BookingRow["booking_status"] | null,
  newStatus: BookingRow["booking_status"],
  remarks: string,
  actor?: RentalActor,
  executor: DbExecutor = db,
) {
  const userId = await actorUserId(actor, executor);
  await execute(
    "INSERT INTO rental_status_history (rental_booking_id, old_status, new_status, remarks, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, NOW())",
    cleanParams([bookingId, oldStatus, newStatus, remarks, userId]),
    executor,
  );
}

async function addNotification(
  title: string,
  message: string,
  relatedType: string,
  relatedId: number,
  isRead = false,
  targetUserId?: number | null,
  eventKey?: string,
  executor: DbExecutor = db,
) {
  if (eventKey) {
    const result = await execute(
      `INSERT IGNORE INTO rental_idempotency_keys
        (idempotency_key, operation, entity_type, entity_id)
       VALUES (?, 'notification', ?, ?)`,
      [eventKey, relatedType, relatedId],
      executor,
    );
    if (result.affectedRows === 0) return;
  }
  const userId = targetUserId ?? (await systemUserId(executor));
  await execute(
    "INSERT INTO notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id, is_read, created_at) VALUES (?, 'Rental', ?, ?, ?, ?, ?, NOW())",
    cleanParams([userId, title, message, relatedType, relatedId, isRead]),
    executor,
  );
}

async function nextReferenceNumber(executor: DbExecutor) {
  const year = new Date().getFullYear();
  await execute(
    `INSERT INTO rental_booking_sequences (reference_year, last_number)
     VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_number = last_number + 1`,
    [year],
    executor,
  );
  const rows = await queryRows<Array<RowDataPacket & { last_number: number }>>(
    `SELECT last_number
       FROM rental_booking_sequences
      WHERE reference_year = ?
      FOR UPDATE`,
    [year],
    executor,
  );
  return `RNT-${year}-${String(Number(rows[0]?.last_number ?? 1)).padStart(4, "0")}`;
}

async function persistedScheduleConflict(
  schedule: Omit<
    RentalSchedule,
    "scheduleId" | "status" | "paymentStatus"
  >,
  ignoreRentalId?: string,
  executor: DbExecutor = db,
): Promise<ScheduleConflict> {
  const [bookingRecords, serviceRecords] = await Promise.all([
    bookingRows(
      `WHERE rb.booking_number LIKE 'RNT-%'
         AND rb.booking_status IN ('Approved', 'Scheduled', 'In Use', 'Rescheduled')`,
      [],
      executor,
    ),
    assetRows("", [], executor),
  ]);
  const schedules = bookingRecords
    .filter((row) => row.booking_number !== ignoreRentalId)
    .map(mapSchedule);
  const services = serviceRecords.map(mapAsset);
  const base = checkRentalScheduleConflict(schedule, schedules, services);
  const candidateStart = toMysqlDateTime(schedule.date, schedule.startTime);
  const candidateEnd = toMysqlDateTime(schedule.endDate, schedule.endTime);
  const maintenanceRows = await queryRows<
    Array<RowDataPacket & {
      maintenance_type: string;
      start_datetime: string;
      end_datetime: string;
    }>
  >(
    `SELECT m.maintenance_type, m.start_datetime, m.end_datetime
       FROM rental_maintenance_periods m
       JOIN rental_assets a ON a.rental_asset_id = m.rental_asset_id
      WHERE a.asset_code = ?
        AND m.maintenance_status IN ('Scheduled', 'In Progress')
        AND m.start_datetime < DATE_ADD(?, INTERVAL ? MINUTE)
        AND m.end_datetime > DATE_SUB(?, INTERVAL ? MINUTE)`,
    [
      schedule.serviceId,
      candidateEnd,
      schedule.bufferMinutes,
      candidateStart,
      schedule.preparationMinutes + schedule.travelMinutes,
    ],
    executor,
  );
  const reasons = [...base.reasons];
  for (const maintenance of maintenanceRows) {
    reasons.push(
      `${schedule.equipmentName} has ${maintenance.maintenance_type} maintenance from ${isoDateTime(maintenance.start_datetime)} to ${isoDateTime(maintenance.end_datetime)}.`,
    );
  }
  const service = services.find((item) => item.serviceId === schedule.serviceId);
  if (service?.maximumBookingsPerDay) {
    const candidateDates = dateKeysBetween(schedule.date, schedule.endDate);
    const fullDate = candidateDates.find((date) => {
      const bookingCount = schedules.filter(
        (item) =>
          item.serviceId === schedule.serviceId &&
          item.status !== "Cancelled" &&
          dateKeysBetween(item.date, item.endDate).includes(date),
      ).length;
      return bookingCount >= service.maximumBookingsPerDay!;
    });
    if (fullDate) {
      reasons.push(
        `${service.name} has reached its maximum bookings for ${fullDate}.`,
      );
    }
  }
  return {
    hasConflict: reasons.length > 0,
    reasons,
    conflictingSchedules: base.conflictingSchedules,
    suggestedSlots:
      reasons.length > 0 && schedule.date === schedule.endDate
        ? base.suggestedSlots.length
          ? base.suggestedSlots
          : ["07:00–09:00", "13:00–15:00", "15:30–17:30"]
        : [],
  };
}

async function rentalCategoryId(code: string) {
  const rows = await queryRows<Array<RowDataPacket & { financial_category_id: number }>>(
    "SELECT financial_category_id FROM financial_categories WHERE category_code = ? LIMIT 1",
    [code],
  );
  if (rows[0]) return rows[0].financial_category_id;
  const fallback = await queryRows<Array<RowDataPacket & { financial_category_id: number }>>(
    "SELECT financial_category_id FROM financial_categories WHERE category_code = 'OTHER_EXPENSE' LIMIT 1",
  );
  return fallback[0]?.financial_category_id ?? 1;
}

function expenseCategoryCode(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("gas") || normalized.includes("fuel")) return "FUEL_GASOLINE";
  if (normalized.includes("repair") || normalized.includes("maintenance")) return "REPAIR_MAINTENANCE";
  if (normalized.includes("transport")) return "TRANSPORTATION";
  if (normalized.includes("supply")) return "OFFICE_SUPPLIES";
  return "OTHER_EXPENSE";
}

async function upsertIncomeRecord(
  payment: RentalPayment,
  paymentReferenceId: number,
  bookingId: number,
  memberId: number | null,
  actor?: RentalActor,
  executor: DbExecutor = db,
) {
  const userId = await actorUserId(actor, executor);
  const categoryRows = await queryRows<
    Array<RowDataPacket & { financial_category_id: number }>
  >(
    `SELECT financial_category_id
       FROM financial_categories
      WHERE category_code = 'RENTAL_INCOME'
      LIMIT 1`,
    [],
    executor,
  );
  const categoryId =
    categoryRows[0]?.financial_category_id ??
    (await rentalCategoryId("RENTAL_INCOME"));
  const recordNumber = `FIN-${payment.paymentId}`;
  await execute(
    `INSERT INTO financial_records
      (record_number, payment_reference_id, member_id, financial_category_id, recorded_by, approved_by, record_type, source_module, source_record_id, amount, record_date, record_status, remarks)
     VALUES (?, ?, ?, ?, ?, ?, 'Income', 'Rental', ?, ?, ?, 'Active', ?)
     ON DUPLICATE KEY UPDATE
      payment_reference_id = VALUES(payment_reference_id),
      member_id = VALUES(member_id),
      amount = VALUES(amount),
      record_date = VALUES(record_date),
      remarks = VALUES(remarks)`,
    cleanParams([
      recordNumber,
      paymentReferenceId,
      memberId,
      categoryId,
      userId,
      userId,
      bookingId,
      payment.amount,
      payment.paymentDate,
      JSON.stringify({
        paymentId: payment.paymentId,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.gcashReference,
        receiptNumber: payment.receiptNumber,
      }),
    ]),
    executor,
  );
}

export const rentalDatabase = {
  async getRentalServices() {
    return (await assetRows()).map(mapAsset);
  },

  async getPublicRentalServices() {
    const [rows, maintenanceRows] = await Promise.all([
      assetRows(
        "WHERE a.public_visibility = 1 AND a.asset_status <> 'Archived'",
      ),
      queryRows<Array<RowDataPacket & { asset_code: string }>>(
        `SELECT DISTINCT a.asset_code
           FROM rental_maintenance_periods m
           JOIN rental_assets a ON a.rental_asset_id = m.rental_asset_id
          WHERE m.maintenance_status IN ('Scheduled', 'In Progress')
            AND m.start_datetime <= NOW()
            AND m.end_datetime > NOW()`,
      ),
    ]);
    const underMaintenance = new Set(
      maintenanceRows.map((row) => row.asset_code),
    );
    return rows
      .map(mapAsset)
      .filter(
        (service) =>
          service.visibility === "Public" &&
          service.operationalStatus !== "Out of Service" &&
          service.operationalStatus !== "Archived",
      )
      .map((service) =>
        underMaintenance.has(service.serviceId)
          ? {
              ...service,
              availability: "Unavailable" as const,
              operationalStatus: "Under Maintenance" as const,
              publicAvailabilityMessage:
                "Temporarily unavailable while scheduled maintenance is in progress.",
            }
          : service,
      );
  },

  async getMemberRentalServices() {
    const [rows, maintenanceRows] = await Promise.all([
      assetRows("WHERE a.asset_status <> 'Archived'"),
      queryRows<Array<RowDataPacket & { asset_code: string }>>(
        `SELECT DISTINCT a.asset_code
           FROM rental_maintenance_periods m
           JOIN rental_assets a ON a.rental_asset_id = m.rental_asset_id
          WHERE m.maintenance_status IN ('Scheduled', 'In Progress')
            AND m.start_datetime <= NOW()
            AND m.end_datetime > NOW()`,
      ),
    ]);
    const underMaintenance = new Set(
      maintenanceRows.map((row) => row.asset_code),
    );
    return rows
      .map(mapAsset)
      .filter(
        (service) =>
          ["Public", "Member-only"].includes(service.visibility) &&
          service.operationalStatus !== "Out of Service" &&
          service.operationalStatus !== "Archived",
      )
      .map((service) =>
        underMaintenance.has(service.serviceId)
          ? {
              ...service,
              availability: "Unavailable" as const,
              operationalStatus: "Under Maintenance" as const,
              publicAvailabilityMessage:
                "Temporarily unavailable while scheduled maintenance is in progress.",
            }
          : service,
      );
  },

  async getRentalServiceById(serviceId: string) {
    return (await assetRows("WHERE a.asset_code = ?", [serviceId])).map(mapAsset)[0];
  },

  async getPublicRentalServiceById(serviceId: string) {
    const services = await this.getPublicRentalServices();
    return services.find((service) => service.serviceId === serviceId);
  },

  async getPublicRentalBlockedDates(serviceId: string) {
    const service = await this.getPublicRentalServiceById(serviceId);
    if (!service) return undefined;

    const [bookingRows, maintenanceRows] = await Promise.all([
      queryRows<
        Array<
          RowDataPacket & {
            start_date: string;
            end_date: string;
            booking_status: "Approved" | "Scheduled" | "In Use" | "Rescheduled";
          }
        >
      >(
        `SELECT
            DATE(rb.start_datetime) AS start_date,
            DATE(rb.end_datetime) AS end_date,
            rb.booking_status
           FROM rental_bookings rb
           JOIN rental_assets a
             ON a.rental_asset_id = rb.rental_asset_id
          WHERE a.asset_code = ?
            AND a.public_visibility = 1
            AND rb.booking_status IN ('Approved', 'Scheduled', 'In Use', 'Rescheduled')
            AND rb.end_datetime >= CURDATE()
          ORDER BY rb.start_datetime ASC`,
        [serviceId],
      ),
      queryRows<
        Array<
          RowDataPacket & {
            start_date: string;
            end_date: string;
            maintenance_status: RentalMaintenanceRecord["status"];
          }
        >
      >(
        `SELECT
            DATE(m.start_datetime) AS start_date,
            DATE(m.end_datetime) AS end_date,
            m.maintenance_status
           FROM rental_maintenance_periods m
           JOIN rental_assets a
             ON a.rental_asset_id = m.rental_asset_id
          WHERE a.asset_code = ?
            AND a.public_visibility = 1
            AND m.maintenance_status IN ('Scheduled', 'In Progress')
            AND m.end_datetime >= CURDATE()
          ORDER BY m.start_datetime ASC`,
        [serviceId],
      ),
    ]);

    const blocked = new Map<string, PublicRentalBlockedDate>();
    for (const row of bookingRows) {
      const startDate = datePart(row.start_date);
      const endDate = datePart(row.end_date);
      for (const date of dateKeysBetween(startDate, endDate)) {
        blocked.set(date, {
          date,
          startDate,
          endDate,
          status: row.booking_status,
          reason: "Already has an approved rental schedule.",
        });
      }
    }
    for (const row of maintenanceRows) {
      const startDate = datePart(row.start_date);
      const endDate = datePart(row.end_date);
      for (const date of dateKeysBetween(startDate, endDate)) {
        if (!blocked.has(date)) {
          blocked.set(date, {
            date,
            startDate,
            endDate,
            status: "Maintenance",
            reason: "Equipment is blocked for maintenance.",
          });
        }
      }
    }

    return Array.from(blocked.values()).sort((left, right) =>
      left.date.localeCompare(right.date),
    );
  },

  async createRentalService(
    service: Omit<RentalService, "updatedAt">,
    actor?: RentalActor,
  ) {
    const validation = rentalServiceSchema.safeParse(service);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message ?? "Rental asset is invalid.");
    }
    return withRentalTransaction(async (connection) => {
      const userId = await actorUserId(actor, connection);
      const result = await execute(
        `INSERT INTO rental_assets
          (asset_code, asset_name, asset_type, category, description, rate_amount,
           rate_unit, deposit_amount, asset_status, public_visibility, created_by)
         VALUES (?, ?, 'Equipment', ?, ?, ?, 'Custom', ?, ?, ?, ?)`,
        cleanParams([
          service.serviceId,
          service.name,
          service.category,
          serviceDescriptionPayload(service),
          service.standardRate,
          service.depositRequirement,
          assetStatusFromService(service),
          service.visibility === "Public" ? 1 : 0,
          userId,
        ]),
        connection,
      );
      const rows = await assetRows(
        "WHERE a.rental_asset_id = ?",
        [result.insertId],
        connection,
      );
      const created = rows[0] ? mapAsset(rows[0]) : undefined;
      if (!created) throw new Error("Rental service was not created.");
      await addRentalAudit(
        "Asset Created",
        "rental_assets",
        result.insertId,
        "Rental asset created.",
        undefined,
        service.visibility,
        actor,
        connection,
      );
      return created;
    });
  },

  async updateRentalService(
    serviceId: string,
    updates: Partial<RentalService>,
    actor?: RentalActor,
  ) {
    const existing = await this.getRentalServiceById(serviceId);
    if (!existing) return undefined;
    const next = { ...existing, ...updates, serviceId };
    const validation = rentalServiceSchema.safeParse(next);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message ?? "Rental asset is invalid.");
    }
    return withRentalTransaction(async (connection) => {
      const lockedRows = await queryRows<
        Array<RowDataPacket & { rental_asset_id: number }>
      >(
        "SELECT rental_asset_id FROM rental_assets WHERE asset_code = ? FOR UPDATE",
        [serviceId],
        connection,
      );
      if (!lockedRows[0]) return undefined;
      await execute(
        `UPDATE rental_assets
            SET asset_name = ?, category = ?, description = ?, rate_amount = ?,
                deposit_amount = ?, asset_status = ?, public_visibility = ?
          WHERE asset_code = ?`,
        cleanParams([
          next.name,
          next.category,
          serviceDescriptionPayload(next),
          next.standardRate,
          next.depositRequirement,
          assetStatusFromService(next),
          next.visibility === "Public" ? 1 : 0,
          serviceId,
        ]),
        connection,
      );
      const updatedRows = await assetRows(
        "WHERE a.asset_code = ?",
        [serviceId],
        connection,
      );
      const updated = updatedRows[0] ? mapAsset(updatedRows[0]) : undefined;
      if (updated) {
        const action =
          updated.operationalStatus === "Archived" &&
          existing.operationalStatus !== "Archived"
            ? "Asset Archived"
            : existing.operationalStatus === "Archived" &&
                updated.operationalStatus !== "Archived"
              ? "Asset Restored"
          : existing.visibility !== updated.visibility
            ? updated.visibility === "Public"
              ? "Asset Published"
              : "Asset Hidden"
            : existing.operationalStatus !== updated.operationalStatus
              ? "Operational Status Changed"
              : existing.availability !== updated.availability
                ? "Availability Changed"
                : "Asset Edited";
        await addRentalAudit(
          action,
          "rental_assets",
          lockedRows[0].rental_asset_id,
          "Rental asset updated.",
          `${existing.visibility}; ${existing.availability}; ${existing.operationalStatus}`,
          `${updated.visibility}; ${updated.availability}; ${updated.operationalStatus}`,
          actor,
          connection,
        );
      }
      return updated;
    });
  },

  async archiveRentalService(serviceId: string, actor?: RentalActor) {
    return this.updateRentalService(
      serviceId,
      {
        operationalStatus: "Archived",
        visibility: "Hidden",
        availability: "Unavailable",
      },
      actor,
    );
  },

  async submitRentalInquiry(
    draft: InquiryDraft,
    member = false,
    actor?: RentalActor,
  ) {
    const parsed = inquirySchema.parse(draft);
    if (member && (!actor || actor.role !== "member" || !actor.memberId)) {
      throw new Error("An authenticated member profile is required.");
    }
    return withRentalTransaction(async (connection) => {
      const idempotencyKey = parsed.clientRequestId
        ? `rental-inquiry:${parsed.clientRequestId}`
        : undefined;
      if (idempotencyKey) {
        const reservation = await execute(
          `INSERT IGNORE INTO rental_idempotency_keys
            (idempotency_key, operation, entity_type)
           VALUES (?, 'submit-inquiry', 'rental_bookings')`,
          [idempotencyKey],
          connection,
        );
        if (reservation.affectedRows === 0) {
          const existingKeys = await queryRows<
            Array<RowDataPacket & { entity_id: number | null }>
          >(
            `SELECT entity_id
               FROM rental_idempotency_keys
              WHERE idempotency_key = ?
              FOR UPDATE`,
            [idempotencyKey],
            connection,
          );
          if (existingKeys[0]?.entity_id) {
            const existingRows = await bookingRows(
              "WHERE rb.rental_booking_id = ?",
              [existingKeys[0].entity_id],
              connection,
            );
            if (existingRows[0]) return mapBooking(existingRows[0]);
          }
        }
      }

      const assets = await assetRows(
        "WHERE a.asset_code = ?",
        [parsed.serviceId],
        connection,
      );
      const asset = assets[0];
      if (!asset) throw new Error("Selected rental service was not found.");
      const service = mapAsset(asset);
      const start = toMysqlDateTime(
        parsed.preferredDate,
        parsed.preferredStartTime || "08:00",
      );
      const end = toMysqlDateTime(
        parsed.preferredEndDate,
        parsed.preferredEndTime || "17:00",
      );
      const maintenanceConflicts = await queryRows<
        Array<RowDataPacket & { rental_maintenance_id: number }>
      >(
        `SELECT rental_maintenance_id
           FROM rental_maintenance_periods
          WHERE rental_asset_id = ?
            AND maintenance_status IN ('Scheduled', 'In Progress')
            AND start_datetime < ?
            AND end_datetime > ?
          LIMIT 1`,
        [asset.rental_asset_id, end, start],
        connection,
      );
      const bookingConflicts = await queryRows<
        Array<RowDataPacket & { rental_booking_id: number }>
      >(
        `SELECT rental_booking_id
           FROM rental_bookings
          WHERE rental_asset_id = ?
            AND booking_status IN ('Approved', 'Scheduled', 'In Use', 'Rescheduled')
            AND start_datetime < ?
            AND end_datetime > ?
          LIMIT 1`,
        [asset.rental_asset_id, end, start],
        connection,
      );
      if (bookingConflicts.length > 0) {
        throw new Error(
          "The selected rental period overlaps an approved booking. Choose another date range.",
        );
      }
      const canRequest =
        asset.asset_status !== "Archived" &&
        asset.asset_status !== "Maintenance" &&
        asset.asset_status !== "Unavailable" &&
        service.operationalStatus !== "Out of Service" &&
        service.operationalStatus !== "Under Maintenance" &&
        service.availability !== "Unavailable" &&
        maintenanceConflicts.length === 0 &&
        (member
          ? ["Public", "Member-only"].includes(service.visibility)
          : asset.public_visibility === 1 && service.visibility === "Public");
      if (!canRequest) {
        throw new Error("Selected rental service is not currently requestable.");
      }

      const bookingNumber = await nextReferenceNumber(connection);
      const userId = await actorUserId(actor, connection);
      const purpose = JSON.stringify({
        ...parsed,
        requesterType: member ? "Member" : parsed.requesterType,
        scheduleStatus: "Not scheduled",
        publicNote:
          "NFFAC received your inquiry and will review availability, schedule, pricing, and rental conditions.",
        attachmentNames: [
          parsed.attachmentName,
          parsed.membershipProofName,
        ].filter(Boolean),
      });
      const result = await execute(
        `INSERT INTO rental_bookings
          (booking_number, rental_asset_id, member_id, requester_name,
           requester_contact, purpose, start_datetime, end_datetime,
           booking_status, total_amount, payment_status, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Inquiry', 0.00, 'Unpaid', ?)`,
        cleanParams([
          bookingNumber,
          asset.rental_asset_id,
          member ? actor?.memberId : null,
          parsed.fullName,
          parsed.contactNumber,
          purpose,
          start,
          end,
          userId,
        ]),
        connection,
      );
      if (idempotencyKey) {
        await execute(
          `UPDATE rental_idempotency_keys
              SET entity_id = ?
            WHERE idempotency_key = ?`,
          [result.insertId, idempotencyKey],
          connection,
        );
      }
      const booking = await bookingByRentalId(
        bookingNumber,
        connection,
      );
      if (!booking) throw new Error("Rental inquiry was not created.");
      await addStatusHistory(
        booking.rental_booking_id,
        null,
        "Inquiry",
        member
          ? "Member rental request submitted."
          : "Public rental inquiry submitted.",
        actor,
        connection,
      );
      await addNotification(
        "New rental inquiry received",
        `${parsed.fullName} requested ${asset.asset_name}.`,
        "rental_bookings",
        booking.rental_booking_id,
        false,
        undefined,
        `rental-notification:submitted:${booking.rental_booking_id}`,
        connection,
      );
      await addRentalAudit(
        "Booking Submitted",
        "rental_bookings",
        booking.rental_booking_id,
        member
          ? "Member rental request submitted."
          : "Public rental inquiry submitted.",
        undefined,
        "Inquiry",
        actor,
        connection,
      );
      return mapBooking(booking);
    });
  },

  async getRentalInquiries() {
    return (await bookingRows("WHERE rb.booking_number LIKE 'RNT-%'")).map(mapBooking);
  },

  async getRentalInquiryById(inquiryId: string) {
    const row = await bookingByRentalId(inquiryId);
    return row ? mapBooking(row) : undefined;
  },

  async getRentalInquiriesForMember(memberId: number) {
    return (
      await bookingRows(
        "WHERE rb.booking_number LIKE 'RNT-%' AND rb.member_id = ?",
        [memberId],
      )
    ).map(mapBooking);
  },

  async getRentalInquiryForMember(inquiryId: string, memberId: number) {
    const rows = await bookingRows(
      "WHERE rb.booking_number = ? AND rb.member_id = ?",
      [inquiryId, memberId],
    );
    return rows[0] ? mapBooking(rows[0]) : undefined;
  },

  async updateMemberRentalStatus(
    inquiryId: string,
    status: "Scheduled" | "Rescheduled",
    publicNote: string,
    internalNote: string | undefined,
    actor: RentalActor,
    rescheduleRequest?: Pick<
      RentalRescheduleRequest,
      | "requestedDate"
      | "requestedEndDate"
      | "alternativeDate"
      | "alternativeEndDate"
      | "reason"
      | "note"
    >,
  ) {
    if (!actor.memberId) return undefined;
    const memberId = actor.memberId;
    return withRentalTransaction(async (connection) => {
      const locked = await queryRows<
        Array<RowDataPacket & { rental_booking_id: number }>
      >(
        `SELECT rental_booking_id
           FROM rental_bookings
          WHERE booking_number = ?
            AND member_id = ?
          FOR UPDATE`,
        [inquiryId, memberId],
        connection,
      );
      if (!locked[0]) return undefined;
      const row = await bookingByRentalId(inquiryId, connection);
      if (!row) return undefined;
      const meta = parseJson(row.purpose);
      const currentStatus = rentalStatusFromBooking(row.booking_status, meta);
      assertRentalStatusTransition(currentStatus, status);
      meta.statusOverride = status;
      meta.publicNote = publicNote.trim();
      meta.internalNote = internalNote?.trim() ?? "";
      if (status === "Scheduled") meta.scheduleStatus = "Confirmed";
      if (status === "Rescheduled") {
        const parsedRequest = rentalRescheduleSchema.parse(rescheduleRequest);
        meta.scheduleStatus = "Proposed";
        meta.rescheduleRequest = {
          requestedDate: parsedRequest.requestedDate,
          requestedEndDate: parsedRequest.requestedEndDate,
          alternativeDate: parsedRequest.alternativeDate ?? "",
          alternativeEndDate: parsedRequest.alternativeEndDate ?? "",
          reason: parsedRequest.reason,
          note: parsedRequest.note ?? "",
          requestedAt: new Date().toISOString(),
          status: "Pending",
        } satisfies RentalRescheduleRequest;
      }
      const nextStatus = bookingStatusFromRental(status);
      await execute(
        `UPDATE rental_bookings
            SET booking_status = ?, purpose = ?
          WHERE rental_booking_id = ?`,
        [nextStatus, JSON.stringify(meta), row.rental_booking_id],
        connection,
      );
      await addStatusHistory(
        row.rental_booking_id,
        row.booking_status,
        nextStatus,
        status === "Scheduled"
          ? "Requester confirmed the proposed schedule."
          : "Requester submitted a rescheduling request.",
        actor,
        connection,
      );
      await addRentalAudit(
        status === "Scheduled"
          ? "Schedule Confirmed by Requester"
          : "Reschedule Requested",
        "rental_bookings",
        row.rental_booking_id,
        internalNote?.trim() || publicNote.trim(),
        currentStatus,
        status,
        actor,
        connection,
      );
      await addNotification(
        status === "Scheduled"
          ? "Requester confirmed rental schedule"
          : "Rental reschedule requested",
        `${inquiryId}: ${publicNote.trim()}`,
        "rental_bookings",
        row.rental_booking_id,
        false,
        undefined,
        `rental-notification:member-${status}:${row.rental_booking_id}:${row.updated_at}`,
        connection,
      );
      const updated = await bookingByRentalId(inquiryId, connection);
      return updated ? mapBooking(updated) : undefined;
    });
  },

  async getRentalStatusHistory(inquiryId: string) {
    const rows = await queryRows<StatusHistoryRow[]>(
      `SELECT rsh.*, rb.booking_number, u.display_name
         FROM rental_status_history rsh
         JOIN rental_bookings rb
           ON rb.rental_booking_id = rsh.rental_booking_id
         LEFT JOIN users u ON u.user_id = rsh.changed_by
        WHERE rb.booking_number = ?
        ORDER BY rsh.changed_at ASC, rsh.rental_status_history_id ASC`,
      [inquiryId],
    );
    return rows.map(mapStatusHistory);
  },

  async lookupRentalInquiry(reference: string, contact: string) {
    const inquiries = await this.getRentalInquiries();
    const digits = contact.replace(/\D/g, "");
    const inquiry = inquiries.find(
      (item) =>
        item.inquiryId.toLowerCase() === reference.trim().toLowerCase() &&
        item.requester.contactNumber.replace(/\D/g, "") === digits,
    );
    if (!inquiry) return undefined;
    const schedule = (await this.getRentalSchedules()).find(
      (item) => item.rentalId === inquiry.rentalId,
    );
    return {
      ...mapPublicInquiryStatus(inquiry),
      confirmedSchedule:
        schedule &&
        ["Confirmed", "In Progress", "Completed"].includes(schedule.status)
          ? {
              date: schedule.date,
              endDate: schedule.endDate,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
            }
          : undefined,
    } satisfies PublicRentalInquiryStatus;
  },

  async reviewRentalInquiry(
    inquiryId: string,
    decision: RentalStatus,
    publicNote: string,
    internalNote?: string,
    actor?: RentalActor,
  ) {
    if (!publicNote.trim()) throw new Error("A public response is required.");
    return withRentalTransaction(async (connection) => {
      await queryRows(
        "SELECT rental_booking_id FROM rental_bookings WHERE booking_number = ? FOR UPDATE",
        [inquiryId],
        connection,
      );
      const row = await bookingByRentalId(inquiryId, connection);
      if (!row) return undefined;
      const currentStatus = rentalStatusFromBooking(
        row.booking_status,
        parseJson(row.purpose),
      );
      assertRentalStatusTransition(currentStatus, decision);
      const meta = parseJson(row.purpose);
      meta.publicNote = publicNote.trim();
      meta.internalNote = internalNote?.trim() ?? "";
      meta.assignedReviewer = actor?.displayName ?? "NFFAC Chairman";
      meta.statusOverride = decision;
      if (decision === "Scheduled") meta.scheduleStatus = "Confirmed";
      if (decision === "In Progress") meta.scheduleStatus = "In Progress";
      if (decision === "Completed") meta.scheduleStatus = "Completed";
      if (decision === "Cancelled") meta.scheduleStatus = "Cancelled";
      if (decision === "Rescheduled") meta.scheduleStatus = "Proposed";
      const nextStatus = bookingStatusFromRental(decision);
      const userId = await actorUserId(actor, connection);
      await execute(
        `UPDATE rental_bookings
            SET booking_status = ?, purpose = ?,
                approved_by = CASE
                  WHEN ? IN ('Approved', 'Scheduled') THEN ?
                  ELSE approved_by
                END,
                approved_at = CASE
                  WHEN ? IN ('Approved', 'Scheduled') THEN COALESCE(approved_at, NOW())
                  ELSE approved_at
                END,
                completed_at = CASE WHEN ? = 'Completed' THEN NOW() ELSE completed_at END,
                cancellation_reason = CASE WHEN ? = 'Cancelled' THEN ? ELSE cancellation_reason END,
                completion_notes = CASE WHEN ? = 'Completed' THEN ? ELSE completion_notes END
          WHERE rental_booking_id = ?`,
        cleanParams([
          nextStatus,
          JSON.stringify(meta),
          nextStatus,
          userId,
          nextStatus,
          nextStatus,
          nextStatus,
          internalNote,
          nextStatus,
          internalNote?.trim() || publicNote.trim(),
          row.rental_booking_id,
        ]),
        connection,
      );
      await addStatusHistory(
        row.rental_booking_id,
        row.booking_status,
        nextStatus,
        publicNote.trim(),
        actor,
        connection,
      );
      await addRentalAudit(
        decision === "Rejected"
          ? "Booking Rejected"
          : decision === "Cancelled"
            ? "Booking Cancelled"
            : decision === "Awaiting Information"
              ? "Additional Information Requested"
              : decision === "Approved for Scheduling"
                ? "Inquiry Approved for Scheduling"
                : decision === "On Hold"
                  ? "Booking Placed on Hold"
            : decision === "Completed"
                    ? "Rental Completed"
                    : decision === "In Progress"
                      ? "Rental Started"
                      : "Booking Reviewed",
        "rental_bookings",
        row.rental_booking_id,
        "Rental booking status and review response updated.",
        currentStatus,
        decision,
        actor,
        connection,
      );
      const requesterRows = row.member_id
        ? await queryRows<Array<RowDataPacket & { user_id: number | null }>>(
            "SELECT user_id FROM member_profiles WHERE member_id = ? LIMIT 1",
            [row.member_id],
            connection,
          )
        : [];
      if (requesterRows[0]?.user_id) {
        await addNotification(
          `Rental request ${decision.toLowerCase()}`,
          `${inquiryId}: ${publicNote.trim()}`,
          "rental_bookings",
          row.rental_booking_id,
          false,
          requesterRows[0].user_id,
          `rental-notification:${decision}:${row.rental_booking_id}:${row.updated_at}`,
          connection,
        );
      }
      const updated = await bookingByRentalId(inquiryId, connection);
      return updated ? mapBooking(updated) : undefined;
    });
  },

  async updateRentalStatus(
    inquiryId: string,
    status: RentalStatus,
    actor?: RentalActor,
    reason?: string,
  ) {
    return this.reviewRentalInquiry(
      inquiryId,
      status,
      reason?.trim() || `Your rental request status is now ${status}.`,
      reason,
      actor,
    );
  },

  async getRentalSchedules() {
    const rows = await bookingRows(
      "WHERE rb.booking_number LIKE 'MAINTENANCE-%' OR (rb.booking_number LIKE 'RNT-%' AND rb.booking_status IN ('Approved', 'Scheduled', 'In Use', 'Completed', 'Rescheduled', 'Cancelled'))",
    );
    return rows.map(mapSchedule);
  },

  async createRentalSchedule(
    schedule: Omit<RentalSchedule, "scheduleId">,
    actor?: RentalActor,
  ) {
    const validation = rentalScheduleSchema.safeParse(schedule);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message ?? "Rental schedule is invalid.");
    }
    return withRentalTransaction(async (connection) => {
      const assetLocks = await queryRows<
        Array<RowDataPacket & { rental_asset_id: number }>
      >(
        "SELECT rental_asset_id FROM rental_assets WHERE asset_code = ? FOR UPDATE",
        [schedule.serviceId],
        connection,
      );
      if (!assetLocks[0]) throw new Error("Rental asset was not found.");
      await queryRows(
        `SELECT rental_booking_id
           FROM rental_bookings
          WHERE rental_asset_id = ?
            AND booking_status IN ('Approved', 'Scheduled', 'In Use', 'Rescheduled')
          FOR UPDATE`,
        [assetLocks[0].rental_asset_id],
        connection,
      );
      const row = await bookingByRentalId(schedule.rentalId, connection);
      if (!row) throw new Error("Rental inquiry was not found.");
      const currentStatus = rentalStatusFromBooking(
        row.booking_status,
        parseJson(row.purpose),
      );
      const nextRentalStatus: RentalStatus =
        schedule.status === "Confirmed"
          ? "Scheduled"
          : schedule.status === "In Progress"
            ? "In Progress"
            : schedule.status === "Completed"
              ? "Completed"
              : schedule.status === "Cancelled"
                ? "Cancelled"
                : "Awaiting Confirmation";
      assertRentalStatusTransition(currentStatus, nextRentalStatus);
      const candidate = {
        inquiryId: schedule.inquiryId,
        rentalId: schedule.rentalId,
        serviceId: schedule.serviceId,
        equipmentName: schedule.equipmentName,
        requesterName: schedule.requesterName,
        requesterType: schedule.requesterType,
        date: schedule.date,
        endDate: schedule.endDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        assignedOperator: schedule.assignedOperator,
        serviceLocation: schedule.serviceLocation,
        barangay: schedule.barangay,
        preparationMinutes: schedule.preparationMinutes,
        travelMinutes: schedule.travelMinutes,
        bufferMinutes: schedule.bufferMinutes,
        specialInstructions: schedule.specialInstructions,
      };
      const conflict = await persistedScheduleConflict(
        candidate,
        schedule.rentalId,
        connection,
      );
      if (conflict.hasConflict) throw new RentalConflictError(conflict);

      const meta = parseJson(row.purpose);
      const hadSchedule = Boolean(stringValue(meta, "scheduleId"));
      meta.scheduleId = stringValue(
        meta,
        "scheduleId",
        `SCH-${schedule.rentalId.slice(-4)}`,
      );
      meta.scheduleStatus = schedule.status;
      meta.statusOverride = nextRentalStatus;
      meta.assignedOperator = schedule.assignedOperator ?? "";
      meta.serviceLocation = schedule.serviceLocation;
      meta.serviceBarangay = schedule.barangay;
      meta.preparationMinutes = schedule.preparationMinutes;
      meta.travelMinutes = schedule.travelMinutes;
      meta.bufferMinutes = schedule.bufferMinutes;
      meta.specialInstructions = schedule.specialInstructions ?? "";
      meta.assignedReviewer = actor?.displayName ?? "NFFAC Chairman";
      meta.publicNote =
        schedule.status === "Confirmed"
          ? `Your rental schedule is confirmed from ${schedule.date} ${schedule.startTime} to ${schedule.endDate} ${schedule.endTime}.`
          : `NFFAC proposed a rental schedule from ${schedule.date} ${schedule.startTime} to ${schedule.endDate} ${schedule.endTime}. Please review the schedule.`;
      const pendingReschedule = rescheduleRequestValue(meta);
      if (currentStatus === "Rescheduled" && pendingReschedule) {
        meta.rescheduleRequest = {
          ...pendingReschedule,
          status: "Approved",
        } satisfies RentalRescheduleRequest;
      }
      const nextStatus = bookingStatusFromSchedule(schedule.status);
      const userId = await actorUserId(actor, connection);
      await execute(
        `UPDATE rental_bookings
            SET rental_asset_id = ?, start_datetime = ?, end_datetime = ?,
                booking_status = ?, payment_status = ?, purpose = ?,
                approved_by = ?, approved_at = COALESCE(approved_at, NOW()),
                completed_at = CASE WHEN ? = 'Completed' THEN NOW() ELSE completed_at END
          WHERE rental_booking_id = ?`,
        cleanParams([
          assetLocks[0].rental_asset_id,
          toMysqlDateTime(schedule.date, schedule.startTime),
          toMysqlDateTime(schedule.endDate, schedule.endTime),
          nextStatus,
          bookingPaymentStatusFromPayment(schedule.paymentStatus),
          JSON.stringify(meta),
          userId,
          nextStatus,
          row.rental_booking_id,
        ]),
        connection,
      );
      await addStatusHistory(
        row.rental_booking_id,
        row.booking_status,
        nextStatus,
        currentStatus === "Rescheduled" && schedule.status === "Confirmed"
          ? "The requested rescheduling was approved."
          : schedule.status === "Confirmed"
            ? "The rental schedule was confirmed."
            : "A rental schedule was proposed.",
        actor,
        connection,
      );
      await addRentalAudit(
        currentStatus === "Rescheduled" && schedule.status === "Confirmed"
          ? "Rescheduling Approved"
          : schedule.status === "Confirmed"
            ? "Schedule Confirmed"
            : hadSchedule
              ? "Schedule Proposal Updated"
              : "Schedule Proposed",
        "rental_bookings",
        row.rental_booking_id,
        "Conflict-checked rental schedule saved by the Chairman.",
        currentStatus,
        nextRentalStatus,
        actor,
        connection,
      );
      const requesterRows = row.member_id
        ? await queryRows<Array<RowDataPacket & { user_id: number | null }>>(
            "SELECT user_id FROM member_profiles WHERE member_id = ? LIMIT 1",
            [row.member_id],
            connection,
          )
        : [];
      if (requesterRows[0]?.user_id) {
        await addNotification(
          schedule.status === "Confirmed"
            ? "Rental schedule confirmed"
            : "Rental schedule proposed",
          `${schedule.rentalId}: ${schedule.date} ${schedule.startTime} to ${schedule.endDate} ${schedule.endTime}.`,
          "rental_bookings",
          row.rental_booking_id,
          false,
          requesterRows[0].user_id,
          `rental-notification:schedule:${schedule.status}:${row.rental_booking_id}:${schedule.date}:${schedule.startTime}`,
          connection,
        );
      }
      const updated = await bookingByRentalId(schedule.rentalId, connection);
      if (!updated) throw new Error("Rental schedule was not created.");
      return mapSchedule(updated);
    });
  },

  async updateRentalSchedule(
    scheduleId: string,
    updates: Partial<RentalSchedule>,
    actor?: RentalActor,
  ) {
    const initial = await bookingByScheduleId(scheduleId);
    if (!initial) return undefined;
    const current = mapSchedule(initial);
    const next = { ...current, ...updates, scheduleId };
    return this.createRentalSchedule(
      {
        inquiryId: next.inquiryId,
        rentalId: next.rentalId,
        serviceId: next.serviceId,
        equipmentName: next.equipmentName,
        requesterName: next.requesterName,
        requesterType: next.requesterType,
        date: next.date,
        endDate: next.endDate,
        startTime: next.startTime,
        endTime: next.endTime,
        assignedOperator: next.assignedOperator,
        serviceLocation: next.serviceLocation,
        barangay: next.barangay,
        preparationMinutes: next.preparationMinutes,
        travelMinutes: next.travelMinutes,
        bufferMinutes: next.bufferMinutes,
        specialInstructions: next.specialInstructions,
        status: next.status,
        paymentStatus: next.paymentStatus,
      },
      actor,
    );
  },

  async checkScheduleConflict(schedule: Omit<RentalSchedule, "scheduleId" | "status" | "paymentStatus">): Promise<ScheduleConflict> {
    const validation = rentalScheduleSchema.safeParse(schedule);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message ?? "Rental schedule is invalid.");
    }
    return persistedScheduleConflict(schedule, schedule.rentalId);
  },

  async getEquipmentAvailability(): Promise<EquipmentAvailability[]> {
    const [services, schedules, activeMaintenance] = await Promise.all([
      this.getRentalServices(),
      this.getRentalSchedules(),
      queryRows<
        Array<
          RowDataPacket & {
            asset_code: string;
            description: string;
          }
        >
      >(
        `SELECT a.asset_code, m.description
           FROM rental_maintenance_periods m
           JOIN rental_assets a ON a.rental_asset_id = m.rental_asset_id
          WHERE m.maintenance_status IN ('Scheduled', 'In Progress')
            AND m.start_datetime <= NOW()
            AND m.end_datetime > NOW()`,
      ),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return services.map((service) => {
      const maintenance = activeMaintenance.find(
        (item) => item.asset_code === service.serviceId,
      );
      const currentSchedule = schedules.find(
        (item) =>
          item.serviceId === service.serviceId &&
          item.status === "In Progress",
      );
      const nextSchedule = schedules
        .filter(
          (item) =>
            item.serviceId === service.serviceId &&
            ["Proposed", "Awaiting Confirmation", "Confirmed"].includes(
              item.status,
            ) &&
            item.date >= today,
        )
        .sort((left, right) =>
          `${left.date}${left.startTime}`.localeCompare(
            `${right.date}${right.startTime}`,
          ),
        )[0];
      const status: EquipmentAvailability["status"] =
        maintenance || service.operationalStatus === "Under Maintenance"
          ? "Under Maintenance"
          : service.operationalStatus === "Out of Service" || service.availability === "Unavailable"
            ? "Unavailable"
            : currentSchedule
              ? "In Use"
            : nextSchedule
              ? "Reserved"
              : "Available";
      return {
        serviceId: service.serviceId,
        equipmentName: service.name,
        status,
        nextSchedule: nextSchedule?.date,
        currentRequester:
          currentSchedule?.requesterName ?? nextSchedule?.requesterName,
        maintenanceNote:
          status === "Under Maintenance"
            ? maintenance?.description ?? service.operationalNotes
            : undefined,
      };
    });
  },

  async updateEquipmentAvailability(
    serviceId: string,
    status: EquipmentAvailability["status"],
    actor?: RentalActor,
  ) {
    const service = await this.getRentalServiceById(serviceId);
    if (!service) return undefined;
    const operational: OperationalStatus =
      status === "Under Maintenance"
        ? "Under Maintenance"
        : status === "Unavailable"
          ? "Out of Service"
          : "Ready for Use";
    const availability: RentalService["availability"] =
      status === "Unavailable"
        ? "Unavailable"
        : status === "Available"
          ? "Available"
          : "By Schedule Only";
    await this.updateRentalService(
      serviceId,
      { operationalStatus: operational, availability },
      actor,
    );
    if (status === "In Use") {
      await execute(
        "UPDATE rental_assets SET asset_status = 'In Use' WHERE asset_code = ?",
        [serviceId],
      );
    } else if (status === "Reserved") {
      await execute(
        "UPDATE rental_assets SET asset_status = 'Reserved' WHERE asset_code = ?",
        [serviceId],
      );
    }
    return { serviceId, equipmentName: service.name, status };
  },

  async getRentalMaintenanceRecords(serviceId?: string) {
    const where = serviceId ? "WHERE a.asset_code = ?" : "";
    const rows = await queryRows<MaintenanceRow[]>(
      `SELECT m.*, a.asset_code, a.asset_name,
              u.display_name AS created_by_name
         FROM rental_maintenance_periods m
         JOIN rental_assets a ON a.rental_asset_id = m.rental_asset_id
         LEFT JOIN users u ON u.user_id = m.created_by
        ${where}
        ORDER BY m.start_datetime DESC, m.rental_maintenance_id DESC`,
      serviceId ? [serviceId] : [],
    );
    return rows.map(mapMaintenance);
  },

  async createRentalMaintenanceRecord(
    maintenance: Omit<
      RentalMaintenanceRecord,
      "maintenanceId" | "equipmentName" | "createdBy" | "createdAt"
    >,
    actor?: RentalActor,
  ) {
    if (!maintenance.maintenanceType.trim() || !maintenance.description.trim()) {
      throw new Error("Maintenance type and description are required.");
    }
    if (
      Number.isNaN(Date.parse(maintenance.startAt)) ||
      Number.isNaN(Date.parse(maintenance.endAt)) ||
      Date.parse(maintenance.endAt) <= Date.parse(maintenance.startAt)
    ) {
      throw new Error("Maintenance end date must be after its start date.");
    }
    if ((maintenance.cost ?? 0) < 0) {
      throw new Error("Maintenance cost cannot be negative.");
    }
    return withRentalTransaction(async (connection) => {
      const assets = await queryRows<
        Array<
          RowDataPacket & {
            rental_asset_id: number;
            asset_name: string;
          }
        >
      >(
        `SELECT rental_asset_id, asset_name
           FROM rental_assets
          WHERE asset_code = ?
          FOR UPDATE`,
        [maintenance.serviceId],
        connection,
      );
      const asset = assets[0];
      if (!asset) throw new Error("Rental asset was not found.");
      const conflicts = await queryRows<
        Array<RowDataPacket & { booking_number: string }>
      >(
        `SELECT booking_number
           FROM rental_bookings
          WHERE rental_asset_id = ?
            AND booking_status IN ('Approved', 'Scheduled', 'In Use', 'Rescheduled')
            AND start_datetime < ?
            AND end_datetime > ?
          FOR UPDATE`,
        [
          asset.rental_asset_id,
          maintenance.endAt.replace("T", " ").slice(0, 19),
          maintenance.startAt.replace("T", " ").slice(0, 19),
        ],
        connection,
      );
      if (conflicts.length) {
        throw new RentalConflictError({
          hasConflict: true,
          reasons: [
            `Maintenance conflicts with booking ${conflicts[0].booking_number}.`,
          ],
          conflictingSchedules: [],
          suggestedSlots: [],
        });
      }
      const userId = await actorUserId(actor, connection);
      const result = await execute(
        `INSERT INTO rental_maintenance_periods
          (rental_asset_id, maintenance_type, start_datetime, end_datetime,
           description, technician_provider, cost, internal_note,
           operational_impact, maintenance_status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        cleanParams([
          asset.rental_asset_id,
          maintenance.maintenanceType.trim(),
          maintenance.startAt.replace("T", " ").slice(0, 19),
          maintenance.endAt.replace("T", " ").slice(0, 19),
          maintenance.description.trim(),
          maintenance.technician,
          maintenance.cost,
          maintenance.internalNote,
          maintenance.operationalImpact,
          maintenance.status,
          userId,
        ]),
        connection,
      );
      await addRentalAudit(
        "Maintenance Added",
        "rental_maintenance_periods",
        result.insertId,
        "A rental asset maintenance period was added.",
        undefined,
        maintenance.status,
        actor,
        connection,
      );
      const rows = await queryRows<MaintenanceRow[]>(
        `SELECT m.*, a.asset_code, a.asset_name,
                u.display_name AS created_by_name
           FROM rental_maintenance_periods m
           JOIN rental_assets a ON a.rental_asset_id = m.rental_asset_id
           LEFT JOIN users u ON u.user_id = m.created_by
          WHERE m.rental_maintenance_id = ?`,
        [result.insertId],
        connection,
      );
      return mapMaintenance(rows[0]);
    });
  },

  async completeRentalMaintenance(
    maintenanceId: string,
    actor?: RentalActor,
  ) {
    const numericId = Number(maintenanceId.replace(/^MNT-/, ""));
    if (!Number.isInteger(numericId) || numericId <= 0) return undefined;
    return withRentalTransaction(async (connection) => {
      const rows = await queryRows<MaintenanceRow[]>(
        `SELECT m.*, a.asset_code, a.asset_name,
                u.display_name AS created_by_name
           FROM rental_maintenance_periods m
           JOIN rental_assets a ON a.rental_asset_id = m.rental_asset_id
           LEFT JOIN users u ON u.user_id = m.created_by
          WHERE m.rental_maintenance_id = ?
          FOR UPDATE`,
        [numericId],
        connection,
      );
      if (!rows[0]) return undefined;
      if (rows[0].maintenance_status === "Completed") {
        return mapMaintenance(rows[0]);
      }
      const userId = await actorUserId(actor, connection);
      await execute(
        `UPDATE rental_maintenance_periods
            SET maintenance_status = 'Completed', completed_by = ?,
                completed_at = NOW()
          WHERE rental_maintenance_id = ?`,
        [userId, numericId],
        connection,
      );
      await addRentalAudit(
        "Maintenance Completed",
        "rental_maintenance_periods",
        numericId,
        "Rental asset maintenance was completed.",
        rows[0].maintenance_status,
        "Completed",
        actor,
        connection,
      );
      const updatedRows = await queryRows<MaintenanceRow[]>(
        `SELECT m.*, a.asset_code, a.asset_name,
                u.display_name AS created_by_name
           FROM rental_maintenance_periods m
           JOIN rental_assets a ON a.rental_asset_id = m.rental_asset_id
           LEFT JOIN users u ON u.user_id = m.created_by
          WHERE m.rental_maintenance_id = ?`,
        [numericId],
        connection,
      );
      return updatedRows[0] ? mapMaintenance(updatedRows[0]) : undefined;
    });
  },

  async getRentalPayments() {
    return (await paymentRows()).map(mapPayment);
  },

  async getRentalPaymentById(paymentId: string) {
    const row = await paymentByPaymentId(paymentId);
    return row ? mapPayment(row) : undefined;
  },

  async getRentalPaymentProof(paymentId: string, actor: RentalActor) {
    const row = await paymentByPaymentId(paymentId);
    if (
      !row?.proof_file_path ||
      (actor.role === "member" &&
        (!actor.memberId || row.member_id !== actor.memberId))
    ) {
      return undefined;
    }
    return row.proof_file_path;
  },

  async recordRentalPayment(
    payment: Omit<RentalPayment, "paymentId" | "submittedAt">,
    actor?: RentalActor,
  ) {
    if (payment.amount < 0 || (payment.status === "Paid" && payment.amount <= 0)) {
      throw new Error("A confirmed rental payment must have a positive amount.");
    }
    return withRentalTransaction(async (connection) => {
      const lockRows = await queryRows<
        Array<RowDataPacket & { rental_booking_id: number }>
      >(
        "SELECT rental_booking_id FROM rental_bookings WHERE booking_number = ? FOR UPDATE",
        [payment.rentalId],
        connection,
      );
      if (!lockRows[0]) throw new Error("Rental request was not found.");
      const booking = await bookingByRentalId(payment.rentalId, connection);
      if (!booking) throw new Error("Rental request was not found.");
      const reference =
        payment.gcashReference ||
        `MANUAL-${payment.rentalId}-${Date.now()}`;
      const recordedBy = actor?.displayName ?? payment.recordedBy;
      const result = await execute(
        `INSERT INTO payment_references
          (member_id, submitted_by, payer_name, payer_contact, provider,
           reference_number, payment_purpose, related_entity_type,
           related_entity_id, amount, proof_file_path, validation_status,
           notes, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Rental', 'rental_bookings', ?, ?, ?, ?, ?, ?)`,
        cleanParams([
          booking.member_id,
          actor?.userId,
          payment.requesterName,
          booking.requester_contact,
          payment.paymentMethod,
          reference,
          booking.rental_booking_id,
          payment.amount,
          payment.proofFileName,
          validationFromPaymentStatus(payment.status),
          JSON.stringify({
            recordedBy,
            status: payment.status,
            paymentDate: payment.paymentDate,
            scheduleDate: payment.scheduleDate,
            paymentMethod: payment.paymentMethod,
            receiptNumber: payment.receiptNumber,
            notes: payment.notes,
          }),
          `${payment.paymentDate} 00:00:00`,
        ]),
        connection,
      );
      const paymentId = `PAY-${String(result.insertId).padStart(4, "0")}`;
      const notes = {
        recordedBy,
        status: payment.status,
        paymentDate: payment.paymentDate,
        scheduleDate: payment.scheduleDate,
        paymentMethod: payment.paymentMethod,
        receiptNumber: payment.receiptNumber,
        notes: payment.notes,
        paymentId,
      };
      await execute(
        "UPDATE payment_references SET notes = ? WHERE payment_reference_id = ?",
        [JSON.stringify(notes), result.insertId],
        connection,
      );
      await execute(
        "UPDATE rental_bookings SET payment_reference_id = ?, payment_status = ? WHERE rental_booking_id = ?",
        cleanParams([
          result.insertId,
          bookingPaymentStatusFromPayment(payment.status),
          booking.rental_booking_id,
        ]),
        connection,
      );
      const createdRows = await paymentRows(
        "AND pr.payment_reference_id = ?",
        [result.insertId],
        connection,
      );
      const created = createdRows[0] ? mapPayment(createdRows[0]) : undefined;
      if (!created) throw new Error("Rental payment was not recorded.");
      if (created.status === "Paid") {
        await upsertIncomeRecord(
          created,
          result.insertId,
          booking.rental_booking_id,
          booking.member_id,
          actor,
          connection,
        );
      }
      await addRentalAudit(
        "Payment Recorded",
        "payment_references",
        result.insertId,
        "Rental payment recorded.",
        undefined,
        payment.status,
        actor,
        connection,
      );
      return created;
    });
  },

  async validateRentalPayment(
    paymentId: string,
    status: PaymentStatus,
    note?: string,
    actor?: RentalActor,
    amount?: number,
  ) {
    const initial = await paymentByPaymentId(paymentId);
    if (!initial) return undefined;
    return withRentalTransaction(async (connection) => {
      await queryRows(
        "SELECT payment_reference_id FROM payment_references WHERE payment_reference_id = ? FOR UPDATE",
        [initial.payment_reference_id],
        connection,
      );
      const lockedRows = await paymentRows(
        "AND pr.payment_reference_id = ?",
        [initial.payment_reference_id],
        connection,
      );
      const row = lockedRows[0];
      if (!row) return undefined;
      const current = mapPayment(row);
      const validatedAmount = amount ?? current.amount;
      if (
        status === "Paid" &&
        (!Number.isFinite(validatedAmount) || validatedAmount <= 0)
      ) {
        throw new Error(
          "Enter the cooperative-validated payment amount before approval.",
        );
      }
      if (current.status === "Paid" && status === "Paid") {
        const booking = await bookingByRentalId(current.rentalId, connection);
        const inquiry = booking ? mapBooking(booking) : undefined;
        return {
          payment: current,
          receipt: {
            receiptId: `RCT-${current.rentalId.slice(-4)}`,
            receiptNumber:
              current.receiptNumber ?? `OR-RNT-${current.rentalId.slice(-4)}`,
            rentalId: current.rentalId,
            requesterName: current.requesterName,
            requesterType: inquiry?.requester.requesterType ?? "Member",
            equipmentName: current.equipmentName,
            scheduleDate: current.scheduleDate,
            paymentDate: current.paymentDate,
            amountPaid: current.amount,
            paymentMethod: current.paymentMethod,
            referenceNumber: current.gcashReference,
            recordedBy: current.recordedBy,
            validationStatus: current.status,
            verificationCode: `VRF-${current.rentalId}`,
          } satisfies RentalReceipt,
        };
      }
      const notes = parseJson(row.notes);
      notes.paymentId = paymentId;
      notes.status = status;
      notes.notes = note ?? current.notes ?? "";
      if (status === "Paid") {
        notes.receiptNumber = stringValue(
          notes,
          "receiptNumber",
          `OR-RNT-${row.booking_number.slice(-4)}`,
        );
      }
      const validationStatus = validationFromPaymentStatus(status);
      const userId = await actorUserId(actor, connection);
      await execute(
        `UPDATE payment_references
            SET validation_status = ?, validated_by = ?,
                amount = ?,
                validated_at = CASE
                  WHEN ? = 'Validated' THEN COALESCE(validated_at, NOW())
                  ELSE validated_at
                END,
                rejection_reason = CASE WHEN ? = 'Rejected' THEN ? ELSE rejection_reason END,
                notes = ?
          WHERE payment_reference_id = ?`,
        cleanParams([
          validationStatus,
          userId,
          validatedAmount,
          validationStatus,
          validationStatus,
          note,
          JSON.stringify(notes),
          row.payment_reference_id,
        ]),
        connection,
      );
      const booking = await bookingByRentalId(row.booking_number, connection);
      if (!booking) throw new Error("Linked rental booking was not found.");
      const bookingMeta = parseJson(booking.purpose);
      if (status === "Paid") {
        bookingMeta.statusOverride = "Payment Confirmed";
        bookingMeta.paymentStatusOverride = "Paid";
      } else if (status === "Rejected" || status === "Needs Clarification") {
        bookingMeta.paymentStatusOverride = status;
      }
      await execute(
        "UPDATE rental_bookings SET payment_status = ?, purpose = ? WHERE rental_booking_id = ?",
        cleanParams([
          bookingPaymentStatusFromPayment(status),
          JSON.stringify(bookingMeta),
          booking.rental_booking_id,
        ]),
        connection,
      );
      const updatedRows = await paymentRows(
        "AND pr.payment_reference_id = ?",
        [row.payment_reference_id],
        connection,
      );
      const updated = updatedRows[0] ? mapPayment(updatedRows[0]) : undefined;
      if (!updated) return undefined;
      let receipt: RentalReceipt | undefined;
      if (status === "Paid") {
        await upsertIncomeRecord(
          updated,
          row.payment_reference_id,
          booking.rental_booking_id,
          row.member_id,
          actor,
          connection,
        );
        const inquiry = mapBooking(booking);
        receipt = {
          receiptId: `RCT-${updated.rentalId.slice(-4)}`,
          receiptNumber:
            updated.receiptNumber ?? `OR-RNT-${updated.rentalId.slice(-4)}`,
          rentalId: updated.rentalId,
          requesterName: updated.requesterName,
          requesterType: inquiry.requester.requesterType,
          equipmentName: updated.equipmentName,
          scheduleDate: updated.scheduleDate,
          paymentDate: updated.paymentDate,
          amountPaid: updated.amount,
          paymentMethod: updated.paymentMethod,
          referenceNumber: updated.gcashReference,
          recordedBy: updated.recordedBy,
          validationStatus: updated.status,
          verificationCode: `VRF-${updated.rentalId}`,
        };
        const requesterRows = booking.member_id
          ? await queryRows<Array<RowDataPacket & { user_id: number | null }>>(
              "SELECT user_id FROM member_profiles WHERE member_id = ? LIMIT 1",
              [booking.member_id],
              connection,
            )
          : [];
        await addNotification(
          "Rental payment confirmed",
          `${updated.rentalId} payment was confirmed.`,
          "payment_references",
          row.payment_reference_id,
          false,
          requesterRows[0]?.user_id,
          `rental-notification:payment-confirmed:${row.payment_reference_id}`,
          connection,
        );
      }
      await addStatusHistory(
        booking.rental_booking_id,
        booking.booking_status,
        booking.booking_status,
        `Rental payment status changed from ${current.status} to ${status}.`,
        actor,
        connection,
      );
      await addRentalAudit(
        status === "Paid" ? "Payment Approved" : "Payment Updated",
        "payment_references",
        row.payment_reference_id,
        "Rental payment validation updated.",
        current.status,
        status,
        actor,
        connection,
      );
      return { payment: updated, receipt };
    });
  },

  async uploadRentalPaymentProof(
    rentalId: string,
    storedPath: string,
    reference?: string,
    actor?: RentalActor,
    amount = 0,
    paymentDate = new Date().toISOString().slice(0, 10),
    notes?: string,
  ) {
    const inquiry = await this.getRentalInquiryById(rentalId);
    if (!inquiry) throw new Error("Rental request was not found.");
    const booking = await bookingByRentalId(rentalId);
    if (
      actor?.role === "member" &&
      (!actor.memberId || booking?.member_id !== actor.memberId)
    ) {
      throw new Error("You can upload payment proof only for your own booking.");
    }
    return this.recordRentalPayment({
      rentalId,
      requesterName: inquiry.requester.fullName,
      equipmentName: inquiry.equipmentName,
      scheduleDate: inquiry.preferredDate,
      amount,
      paymentDate,
      paymentMethod: "GCash Reference Upload",
      gcashReference: reference,
      status: "Under Review",
      proofFileName: storedPath,
      recordedBy: actor?.displayName ?? inquiry.requester.fullName,
      notes: notes || "Amount pending cooperative validation.",
    }, actor);
  },

  async getRentalExpenses() {
    const rows = await queryRows<ExpenseRow[]>(
      `SELECT fr.*, fc.category_name, rb.booking_number, a.asset_name
         FROM financial_records fr
         JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
         LEFT JOIN rental_bookings rb ON rb.rental_booking_id = fr.source_record_id
         LEFT JOIN rental_assets a ON a.rental_asset_id = rb.rental_asset_id
        WHERE fr.source_module = 'Rental'
          AND fr.record_type = 'Expense'
          AND fr.record_status = 'Active'
        ORDER BY fr.record_date DESC, fr.financial_record_id DESC`,
    );
    return rows.map(mapExpense);
  },

  async recordRentalExpense(
    expense: Omit<RentalExpense, "expenseId">,
    actor?: RentalActor,
  ) {
    if (!expense.category.trim() || !expense.expenseDate) {
      throw new Error("Expense category and date are required.");
    }
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) {
      throw new Error("Rental expense amount must be positive.");
    }
    return withRentalTransaction(async (connection) => {
      const booking = await bookingByRentalId(expense.rentalId, connection);
      if (!booking) throw new Error("Rental request was not found.");
      const userId = await actorUserId(actor, connection);
      const categoryRows = await queryRows<
        Array<RowDataPacket & { financial_category_id: number }>
      >(
        "SELECT financial_category_id FROM financial_categories WHERE category_code = ? LIMIT 1",
        [expenseCategoryCode(expense.category)],
        connection,
      );
      const categoryId = categoryRows[0]?.financial_category_id;
      if (!categoryId) {
        throw new Error("A matching financial expense category was not found.");
      }
      const result = await execute(
        `INSERT INTO financial_records
          (record_number, member_id, financial_category_id, recorded_by, approved_by, record_type, source_module, source_record_id, amount, record_date, record_status, remarks)
         VALUES (?, ?, ?, ?, ?, 'Expense', 'Rental', ?, ?, ?, 'Active', ?)`,
        cleanParams([
          `FIN-EXP-${randomUUID()}`,
          booking.member_id,
          categoryId,
          userId,
          userId,
          booking.rental_booking_id,
          expense.amount,
          expense.expenseDate,
          JSON.stringify(expense),
        ]),
        connection,
      );
      const expenseId = `EXP-${String(result.insertId).padStart(3, "0")}`;
      await execute(
        "UPDATE financial_records SET record_number = ?, remarks = ? WHERE financial_record_id = ?",
        cleanParams([
          `FIN-${expenseId}`,
          JSON.stringify({ ...expense, expenseId }),
          result.insertId,
        ]),
        connection,
      );
      await addRentalAudit(
        "Expense Recorded",
        "financial_records",
        result.insertId,
        "Rental-related expense recorded.",
        undefined,
        String(expense.amount),
        actor,
        connection,
      );
      return { ...expense, expenseId };
    });
  },

  async getRentalReceipt(receiptId: string) {
    const payments = await this.getRentalPayments();
    const payment = payments.find((item) => item.receiptNumber === receiptId || `RCT-${item.rentalId.slice(-4)}` === receiptId);
    if (!payment || payment.status !== "Paid") return undefined;
    const inquiry = await this.getRentalInquiryById(payment.rentalId);
    return {
      receiptId: `RCT-${payment.rentalId.slice(-4)}`,
      receiptNumber: payment.receiptNumber ?? `OR-RNT-${payment.rentalId.slice(-4)}`,
      rentalId: payment.rentalId,
      requesterName: payment.requesterName,
      requesterType: inquiry?.requester.requesterType ?? "Member",
      equipmentName: payment.equipmentName,
      scheduleDate: payment.scheduleDate,
      paymentDate: payment.paymentDate,
      amountPaid: payment.amount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.gcashReference,
      recordedBy: payment.recordedBy,
      validationStatus: payment.status,
      verificationCode: `VRF-${payment.rentalId}`,
    } satisfies RentalReceipt;
  },

  async getRentalReports(filters?: RentalReportFilter) {
    let inquiries = await this.getRentalInquiries();
    if (filters?.dateFrom) inquiries = inquiries.filter((item) => item.preferredDate >= filters.dateFrom!);
    if (filters?.dateTo) inquiries = inquiries.filter((item) => item.preferredDate <= filters.dateTo!);
    if (filters?.serviceId) inquiries = inquiries.filter((item) => item.serviceId === filters.serviceId);
    if (filters?.requesterType && filters.requesterType !== "All") inquiries = inquiries.filter((item) => item.requester.requesterType === filters.requesterType);
    if (filters?.barangay) inquiries = inquiries.filter((item) => item.serviceBarangay === filters.barangay);
    if (filters?.rentalStatus && filters.rentalStatus !== "All") inquiries = inquiries.filter((item) => item.status === filters.rentalStatus);
    if (filters?.paymentStatus && filters.paymentStatus !== "All") inquiries = inquiries.filter((item) => item.paymentStatus === filters.paymentStatus);
    return inquiries;
  },

  async getRentalOverview(): Promise<RentalOverview> {
    const inquiries = await this.getRentalInquiries();
    const payments = await this.getRentalPayments();
    const expenses = await this.getRentalExpenses();
    const paid = payments.filter((item) => item.status === "Paid");
    const currentMonth = new Date().toISOString().slice(0, 7);
    const counts = new Map<string, number>();
    inquiries.forEach((item) => counts.set(item.equipmentName, (counts.get(item.equipmentName) ?? 0) + 1));
    const mostRequestedEquipment = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No rental data yet";
    return {
      totalIncome: paid.reduce((sum, item) => sum + item.amount, 0),
      currentMonthIncome: paid.filter((item) => item.paymentDate.startsWith(currentMonth)).reduce((sum, item) => sum + item.amount, 0),
      pendingInquiries: inquiries.filter((item) => ["New Inquiry", "Under Review", "Awaiting Information"].includes(item.status)).length,
      awaitingConfirmation: inquiries.filter((item) => item.status === "Awaiting Confirmation").length,
      confirmedSchedules: (await this.getRentalSchedules()).filter((item) => item.status === "Confirmed").length,
      inProgress: inquiries.filter((item) => item.status === "In Progress").length,
      completed: inquiries.filter((item) => item.status === "Completed").length,
      cancelled: inquiries.filter((item) => item.status === "Cancelled").length,
      expenses: expenses.reduce((sum, item) => sum + item.amount, 0),
      mostRequestedEquipment,
    };
  },

  async getRentalAnalytics(): Promise<RentalAnalytics> {
    const inquiries = await this.getRentalInquiries();
    const payments = await this.getRentalPayments();
    const expenses = await this.getRentalExpenses();
    const paid = payments.filter((item) => item.status === "Paid");
    const income = paid.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const completedRentals = inquiries.filter((item) => item.status === "Completed").length;
    const incomeByEquipment = new Map<string, number>();
    paid.forEach((item) => incomeByEquipment.set(item.equipmentName, (incomeByEquipment.get(item.equipmentName) ?? 0) + item.amount));
    const monthlyIncome = new Map<string, number>();
    paid.forEach((item) => {
      const date = new Date(`${item.paymentDate}T00:00:00`);
      const label = date.toLocaleString("en", { month: "short" });
      monthlyIncome.set(label, (monthlyIncome.get(label) ?? 0) + item.amount);
    });
    const expensesByMonth = new Map<string, number>();
    expenses.forEach((item) => {
      const date = new Date(`${item.expenseDate}T00:00:00`);
      const label = date.toLocaleString("en", { month: "short" });
      expensesByMonth.set(label, (expensesByMonth.get(label) ?? 0) + item.amount);
    });
    const sortedIncome = [...incomeByEquipment.entries()].sort((a, b) => b[1] - a[1]);
    return {
      totalIncome: income,
      totalExpenses,
      netIncome: income - totalExpenses,
      averageIncomePerCompletedRental: completedRentals ? income / completedRentals : 0,
      completedRentals,
      paymentCompletionRate: payments.length ? Math.round((paid.length / payments.length) * 100) : 0,
      mostProfitableEquipment: sortedIncome[0]?.[0] ?? "No paid rentals yet",
      highestDemandEquipment: (await this.getRentalOverview()).mostRequestedEquipment,
      monthlyIncome: [...monthlyIncome.entries()].map(([label, value]) => ({ label, value })),
      incomeByEquipment: sortedIncome.map(([label, value]) => ({ label, value })),
      expensesByMonth: [...expensesByMonth.entries()].map(([label, value]) => ({ label, value })),
    };
  },

  async getEquipmentUtilization() {
    const services = await this.getRentalServices();
    const schedules = await this.getRentalSchedules();
    return services.map((service) => {
      const bookings = schedules.filter((item) => item.serviceId === service.serviceId).length;
      return {
        label: service.name,
        usage: Math.min(100, bookings * 18),
        availability: service.operationalStatus === "Under Maintenance" ? 45 : service.availability === "Unavailable" ? 0 : 88,
        bookings,
      };
    });
  },

  async getRentalNotifications() {
    const rows = await queryRows<NotificationRow[]>(
      `SELECT n.*, rb.booking_number, pr.notes AS payment_notes
         FROM notifications n
         LEFT JOIN rental_bookings rb
           ON (n.related_entity_type = 'rental_bookings' AND n.related_entity_id = rb.rental_booking_id)
         LEFT JOIN payment_references pr
           ON (n.related_entity_type = 'payment_references' AND n.related_entity_id = pr.payment_reference_id)
         LEFT JOIN rental_bookings prb
           ON prb.rental_booking_id = pr.related_entity_id
        WHERE n.notification_type = 'Rental'
        ORDER BY n.created_at DESC, n.notification_id DESC`,
    );
    return rows.map((row) => mapNotification({ ...row, booking_number: row.booking_number ?? null }));
  },

  async getRentalAuditEntries() {
    const rows = await queryRows<AuditRow[]>(
      `SELECT al.*, u.display_name
         FROM audit_logs al
         LEFT JOIN users u ON u.user_id = al.user_id
        WHERE al.entity_table IN ('rental_assets', 'rental_bookings', 'rental_status_history', 'rental_pos_records', 'payment_references', 'financial_records')
           OR al.description LIKE '%rental%'
        ORDER BY al.action_time DESC, al.audit_log_id DESC`,
    );
    return rows.map(mapAudit);
  },
};
