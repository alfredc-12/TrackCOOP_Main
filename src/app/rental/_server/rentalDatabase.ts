import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { checkRentalScheduleConflict } from "../_lib/rentalConflict";
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
  RentalNotification,
  RentalOverview,
  RentalPayment,
  RentalReceipt,
  RentalReportFilter,
  RentalSchedule,
  RentalService,
  RentalStatus,
  RequesterType,
  ScheduleConflict,
  ScheduleStatus,
  ServiceVisibility,
} from "../_types/rental";

type DbValue = string | number | boolean | null;
type JsonRecord = Record<string, unknown>;

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

const defaultSafetyReminders = [
  "Follow the assigned operator safety briefing.",
  "Keep children and bystanders away from the operating area.",
  "Report unsafe ground or weather conditions before operation.",
];

async function queryRows<T extends RowDataPacket[]>(sql: string, params: DbValue[] = []) {
  const [rows] = await db.query<T>(sql, params);
  return rows;
}

async function execute(sql: string, params: DbValue[] = []) {
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result;
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

function datePart(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
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

function addMinutes(dateTime: string, minutesToAdd: number) {
  const [date, time] = dateTime.split(" ");
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  const nextHours = Math.floor(total / 60).toString().padStart(2, "0");
  const nextMinutes = (total % 60).toString().padStart(2, "0");
  return `${date} ${nextHours}:${nextMinutes}:00`;
}

function durationToMinutes(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 120;
  const amount = Number(match[1]);
  if (value.toLowerCase().includes("day")) return Math.max(1, amount) * 8 * 60;
  return Math.max(0.5, amount) * 60;
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
    lastMaintenanceDate: service.lastMaintenanceDate ?? "",
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
    imageUrls: [],
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
    lastMaintenanceDate: stringValue(meta, "lastMaintenanceDate") || undefined,
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
    alternativeDate: stringValue(meta, "alternativeDate") || undefined,
    preferredStartTime: stringValue(meta, "preferredStartTime", timePart(row.start_datetime)) || undefined,
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
      ? `/rental/inquiries/${relatedRental}`
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

async function systemUserId() {
  const rows = await queryRows<Array<RowDataPacket & { user_id: number }>>(
    `SELECT u.user_id
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug = 'chairman'
        AND u.account_status = 'Active'
      ORDER BY u.user_id ASC
      LIMIT 1`,
  );
  if (rows[0]) return rows[0].user_id;
  throw new Error("A live Chairman account is required before rental records can be mutated.");
}

async function assetRows(where = "", params: DbValue[] = []) {
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
  );
}

async function bookingRows(where = "", params: DbValue[] = []) {
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
  );
}

async function paymentRows(where = "", params: DbValue[] = []) {
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
  );
}

async function bookingByRentalId(rentalId: string) {
  const rows = await bookingRows("WHERE rb.booking_number = ?", [rentalId]);
  return rows[0];
}

async function bookingByScheduleId(scheduleId: string) {
  const rows = await bookingRows(
    "WHERE rb.booking_number LIKE 'RNT-%' OR rb.booking_number LIKE 'MAINTENANCE-%'",
  );
  return rows.find((row) => mapSchedule(row).scheduleId === scheduleId);
}

async function paymentByPaymentId(paymentId: string) {
  const rows = await paymentRows("");
  return rows.find((row) => mapPayment(row).paymentId === paymentId);
}

async function addRentalAudit(action: string, entityTable: string, recordId: number, details: string, oldStatus?: string, newStatus?: string) {
  const userId = await systemUserId();
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
  );
}

async function addStatusHistory(bookingId: number, oldStatus: BookingRow["booking_status"] | null, newStatus: BookingRow["booking_status"], remarks: string) {
  const userId = await systemUserId();
  await execute(
    "INSERT INTO rental_status_history (rental_booking_id, old_status, new_status, remarks, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, NOW())",
    cleanParams([bookingId, oldStatus, newStatus, remarks, userId]),
  );
}

async function addNotification(title: string, message: string, relatedType: string, relatedId: number, isRead = false) {
  const userId = await systemUserId();
  await execute(
    "INSERT INTO notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id, is_read, created_at) VALUES (?, 'Rental', ?, ?, ?, ?, ?, NOW())",
    cleanParams([userId, title, message, relatedType, relatedId, isRead]),
  );
}

function nextReferenceNumber(count: number) {
  return `RNT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
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

async function upsertIncomeRecord(payment: RentalPayment, paymentReferenceId: number, bookingId: number, memberId: number | null) {
  const userId = await systemUserId();
  const categoryId = await rentalCategoryId("RENTAL_INCOME");
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
  );
}

export const rentalDatabase = {
  async getRentalServices() {
    return (await assetRows()).map(mapAsset);
  },

  async getRentalServiceById(serviceId: string) {
    return (await assetRows("WHERE a.asset_code = ?", [serviceId])).map(mapAsset)[0];
  },

  async createRentalService(service: Omit<RentalService, "updatedAt">) {
    const userId = await systemUserId();
    await execute(
      `INSERT INTO rental_assets
        (asset_code, asset_name, asset_type, category, description, rate_unit, deposit_amount, asset_status, public_visibility, created_by)
       VALUES (?, ?, 'Equipment', ?, ?, 'Custom', 0.00, ?, ?, ?)`,
      cleanParams([
        service.serviceId,
        service.name,
        service.category,
        serviceDescriptionPayload(service),
        assetStatusFromService(service),
        service.visibility === "Hidden" ? 0 : 1,
        userId,
      ]),
    );
    const created = await this.getRentalServiceById(service.serviceId);
    if (!created) throw new Error("Rental service was not created.");
    await addRentalAudit("Added Rental Service", "rental_assets", Number((await assetRows("WHERE a.asset_code = ?", [service.serviceId]))[0]?.rental_asset_id ?? 0), "Rental service created.", undefined, service.serviceId);
    return created;
  },

  async updateRentalService(serviceId: string, updates: Partial<RentalService>) {
    const existing = await this.getRentalServiceById(serviceId);
    if (!existing) return undefined;
    const next = { ...existing, ...updates, serviceId };
    await execute(
      `UPDATE rental_assets
          SET asset_name = ?, category = ?, description = ?, asset_status = ?, public_visibility = ?
        WHERE asset_code = ?`,
      cleanParams([
        next.name,
        next.category,
        serviceDescriptionPayload(next),
        assetStatusFromService(next),
        next.visibility === "Hidden" ? 0 : 1,
        serviceId,
      ]),
    );
    const updated = await this.getRentalServiceById(serviceId);
    if (updated) {
      const rows = await assetRows("WHERE a.asset_code = ?", [serviceId]);
      await addRentalAudit("Edited Rental Service", "rental_assets", rows[0]?.rental_asset_id ?? 0, "Rental service updated.", existing.availability, updated.availability);
    }
    return updated;
  },

  async archiveRentalService(serviceId: string) {
    return this.updateRentalService(serviceId, { operationalStatus: "Archived", visibility: "Hidden", availability: "Unavailable" });
  },

  async submitRentalInquiry(draft: InquiryDraft, member = false) {
    const assets = await assetRows("WHERE a.asset_code = ?", [draft.serviceId]);
    const asset = assets[0];
    if (!asset) throw new Error("Selected rental service was not found.");
    const countRows = await queryRows<Array<RowDataPacket & { count_value: number }>>(
      "SELECT COUNT(*) AS count_value FROM rental_bookings WHERE booking_number LIKE CONCAT('RNT-', YEAR(CURDATE()), '-%')",
    );
    const bookingNumber = nextReferenceNumber(Number(countRows[0]?.count_value ?? 0));
    const start = toMysqlDateTime(draft.preferredDate, draft.preferredStartTime || "08:00");
    const end = addMinutes(start, durationToMinutes(draft.estimatedDuration));
    const userId = await systemUserId();
    const purpose = JSON.stringify({
      ...draft,
      requesterType: member ? "Member" : draft.requesterType,
      scheduleStatus: "Not scheduled",
      publicNote: "NFFAC received your inquiry and will review availability, schedule, pricing, and rental conditions.",
      attachmentNames: [draft.attachmentName, draft.membershipProofName].filter(Boolean),
    });
    await execute(
      `INSERT INTO rental_bookings
        (booking_number, rental_asset_id, requester_name, requester_contact, purpose, start_datetime, end_datetime, booking_status, total_amount, payment_status, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Inquiry', 0.00, 'Unpaid', ?)`,
      cleanParams([bookingNumber, asset.rental_asset_id, draft.fullName, draft.contactNumber, purpose, start, end, userId]),
    );
    const booking = await bookingByRentalId(bookingNumber);
    if (!booking) throw new Error("Rental inquiry was not created.");
    await addStatusHistory(booking.rental_booking_id, null, "Inquiry", "Public rental inquiry submitted.");
    await addNotification("New rental inquiry received", `${draft.fullName} requested ${asset.asset_name}.`, "rental_bookings", booking.rental_booking_id);
    await addRentalAudit("Submitted Inquiry", "rental_bookings", booking.rental_booking_id, "Public rental inquiry submitted.", undefined, "Inquiry");
    return mapBooking(booking);
  },

  async getRentalInquiries() {
    return (await bookingRows("WHERE rb.booking_number LIKE 'RNT-%'")).map(mapBooking);
  },

  async getRentalInquiryById(inquiryId: string) {
    const row = await bookingByRentalId(inquiryId);
    return row ? mapBooking(row) : undefined;
  },

  async lookupRentalInquiry(reference: string, contact: string) {
    const inquiries = await this.getRentalInquiries();
    const digits = contact.replace(/\D/g, "");
    return inquiries.find((item) => item.inquiryId.toLowerCase() === reference.trim().toLowerCase() && item.requester.contactNumber.replace(/\D/g, "") === digits);
  },

  async reviewRentalInquiry(inquiryId: string, decision: RentalStatus, publicNote: string, internalNote?: string) {
    const row = await bookingByRentalId(inquiryId);
    if (!row) return undefined;
    const meta = parseJson(row.purpose);
    meta.publicNote = publicNote;
    meta.internalNote = internalNote ?? "";
    meta.assignedReviewer = "NFFAC Chairman";
    meta.statusOverride = decision;
    const nextStatus = bookingStatusFromRental(decision);
    await execute(
      "UPDATE rental_bookings SET booking_status = ?, purpose = ?, approved_by = ?, approved_at = COALESCE(approved_at, NOW()) WHERE rental_booking_id = ?",
      cleanParams([nextStatus, JSON.stringify(meta), await systemUserId(), row.rental_booking_id]),
    );
    await addStatusHistory(row.rental_booking_id, row.booking_status, nextStatus, publicNote);
    await addRentalAudit(decision === "Rejected" ? "Rejected Request" : "Reviewed Inquiry", "rental_bookings", row.rental_booking_id, "Inquiry review decision saved.", row.booking_status, nextStatus);
    return this.getRentalInquiryById(inquiryId);
  },

  async updateRentalStatus(inquiryId: string, status: RentalStatus) {
    return this.reviewRentalInquiry(inquiryId, status, `Your rental request status is now ${status}.`);
  },

  async getRentalSchedules() {
    const rows = await bookingRows(
      "WHERE rb.booking_number LIKE 'MAINTENANCE-%' OR (rb.booking_number LIKE 'RNT-%' AND rb.booking_status IN ('Approved', 'Scheduled', 'In Use', 'Completed', 'Rescheduled', 'Cancelled'))",
    );
    return rows.map(mapSchedule);
  },

  async createRentalSchedule(schedule: Omit<RentalSchedule, "scheduleId">) {
    const row = await bookingByRentalId(schedule.rentalId);
    if (!row) throw new Error("Rental inquiry was not found.");
    const meta = parseJson(row.purpose);
    meta.scheduleId = stringValue(meta, "scheduleId", `SCH-${schedule.rentalId.slice(-4)}`);
    meta.scheduleStatus = schedule.status;
    meta.assignedOperator = schedule.assignedOperator ?? "";
    meta.serviceLocation = schedule.serviceLocation;
    meta.serviceBarangay = schedule.barangay;
    meta.preparationMinutes = schedule.preparationMinutes;
    meta.travelMinutes = schedule.travelMinutes;
    meta.bufferMinutes = schedule.bufferMinutes;
    meta.specialInstructions = schedule.specialInstructions ?? "";
    const nextStatus = bookingStatusFromSchedule(schedule.status);
    await execute(
      `UPDATE rental_bookings
          SET start_datetime = ?, end_datetime = ?, booking_status = ?, payment_status = ?, purpose = ?, approved_by = ?, approved_at = COALESCE(approved_at, NOW())
        WHERE rental_booking_id = ?`,
      cleanParams([
        toMysqlDateTime(schedule.date, schedule.startTime),
        toMysqlDateTime(schedule.date, schedule.endTime),
        nextStatus,
        bookingPaymentStatusFromPayment(schedule.paymentStatus),
        JSON.stringify(meta),
        await systemUserId(),
        row.rental_booking_id,
      ]),
    );
    await addStatusHistory(row.rental_booking_id, row.booking_status, nextStatus, "Rental schedule created.");
    await addRentalAudit("Created Schedule", "rental_bookings", row.rental_booking_id, "Rental schedule created.", row.booking_status, nextStatus);
    const updated = await bookingByRentalId(schedule.rentalId);
    if (!updated) throw new Error("Rental schedule was not created.");
    return mapSchedule(updated);
  },

  async updateRentalSchedule(scheduleId: string, updates: Partial<RentalSchedule>) {
    const row = await bookingByScheduleId(scheduleId);
    if (!row) return undefined;
    const current = mapSchedule(row);
    const next = { ...current, ...updates, scheduleId };
    const meta = parseJson(row.purpose);
    meta.scheduleId = scheduleId;
    meta.scheduleStatus = next.status;
    meta.assignedOperator = next.assignedOperator ?? "";
    meta.serviceLocation = next.serviceLocation;
    meta.serviceBarangay = next.barangay;
    meta.preparationMinutes = next.preparationMinutes;
    meta.travelMinutes = next.travelMinutes;
    meta.bufferMinutes = next.bufferMinutes;
    meta.specialInstructions = next.specialInstructions ?? "";
    const nextStatus = bookingStatusFromSchedule(next.status);
    await execute(
      "UPDATE rental_bookings SET start_datetime = ?, end_datetime = ?, booking_status = ?, payment_status = ?, purpose = ? WHERE rental_booking_id = ?",
      cleanParams([
        toMysqlDateTime(next.date, next.startTime),
        toMysqlDateTime(next.date, next.endTime),
        nextStatus,
        bookingPaymentStatusFromPayment(next.paymentStatus),
        JSON.stringify(meta),
        row.rental_booking_id,
      ]),
    );
    const updated = await bookingByScheduleId(scheduleId);
    return updated ? mapSchedule(updated) : undefined;
  },

  async checkScheduleConflict(schedule: Omit<RentalSchedule, "scheduleId" | "status" | "paymentStatus">): Promise<ScheduleConflict> {
    const schedules = await this.getRentalSchedules();
    const services = await this.getRentalServices();
    return checkRentalScheduleConflict(schedule, schedules, services);
  },

  async getEquipmentAvailability(): Promise<EquipmentAvailability[]> {
    const services = await this.getRentalServices();
    const schedules = await this.getRentalSchedules();
    return services.map((service) => {
      const nextSchedule = schedules.find((item) => item.serviceId === service.serviceId && item.status !== "Cancelled");
      const status: EquipmentAvailability["status"] =
        service.operationalStatus === "Under Maintenance"
          ? "Under Maintenance"
          : service.operationalStatus === "Out of Service" || service.availability === "Unavailable"
            ? "Unavailable"
            : nextSchedule
              ? "Reserved"
              : "Available";
      return {
        serviceId: service.serviceId,
        equipmentName: service.name,
        status,
        nextSchedule: nextSchedule?.date,
        currentRequester: nextSchedule?.requesterName,
        maintenanceNote: status === "Under Maintenance" ? service.operationalNotes : undefined,
      };
    });
  },

  async updateEquipmentAvailability(serviceId: string, status: EquipmentAvailability["status"]) {
    const service = await this.getRentalServiceById(serviceId);
    if (!service) return undefined;
    const operational: OperationalStatus = status === "Under Maintenance" ? "Under Maintenance" : status === "Unavailable" ? "Out of Service" : "Ready for Use";
    const availability: RentalService["availability"] = status === "Unavailable" ? "Unavailable" : status === "Available" ? "Available" : "By Schedule Only";
    await this.updateRentalService(serviceId, { operationalStatus: operational, availability });
    return { serviceId, equipmentName: service.name, status };
  },

  async getRentalPayments() {
    return (await paymentRows()).map(mapPayment);
  },

  async getRentalPaymentById(paymentId: string) {
    const row = await paymentByPaymentId(paymentId);
    return row ? mapPayment(row) : undefined;
  },

  async recordRentalPayment(payment: Omit<RentalPayment, "paymentId" | "submittedAt">) {
    const booking = await bookingByRentalId(payment.rentalId);
    if (!booking) throw new Error("Rental request was not found.");
    const reference = payment.gcashReference || `MANUAL-${payment.rentalId}-${Date.now()}`;
    const result = await execute(
      `INSERT INTO payment_references
        (member_id, payer_name, payer_contact, provider, reference_number, payment_purpose, related_entity_type, related_entity_id, amount, proof_file_path, validation_status, notes, submitted_at)
       VALUES (?, ?, ?, ?, ?, 'Rental', 'rental_bookings', ?, ?, ?, ?, ?, ?)`,
      cleanParams([
        booking.member_id,
        payment.requesterName,
        booking.requester_contact,
        payment.paymentMethod,
        reference,
        booking.rental_booking_id,
        payment.amount,
        payment.proofFileName,
        validationFromPaymentStatus(payment.status),
        JSON.stringify({
          recordedBy: payment.recordedBy,
          status: payment.status,
          paymentDate: payment.paymentDate,
          scheduleDate: payment.scheduleDate,
          paymentMethod: payment.paymentMethod,
          receiptNumber: payment.receiptNumber,
          notes: payment.notes,
        }),
        `${payment.paymentDate} 00:00:00`,
      ]),
    );
    const paymentId = `PAY-${String(result.insertId).padStart(4, "0")}`;
    const notes = {
      recordedBy: payment.recordedBy,
      status: payment.status,
      paymentDate: payment.paymentDate,
      scheduleDate: payment.scheduleDate,
      paymentMethod: payment.paymentMethod,
      receiptNumber: payment.receiptNumber,
      notes: payment.notes,
      paymentId,
    };
    await execute("UPDATE payment_references SET notes = ? WHERE payment_reference_id = ?", [JSON.stringify(notes), result.insertId]);
    await execute(
      "UPDATE rental_bookings SET payment_reference_id = ?, payment_status = ? WHERE rental_booking_id = ?",
      cleanParams([result.insertId, bookingPaymentStatusFromPayment(payment.status), booking.rental_booking_id]),
    );
    const created = await this.getRentalPaymentById(paymentId);
    if (!created) throw new Error("Rental payment was not recorded.");
    if (created.status === "Paid") await upsertIncomeRecord(created, result.insertId, booking.rental_booking_id, booking.member_id);
    await addRentalAudit("Recorded Payment", "payment_references", result.insertId, "Rental payment recorded.", undefined, payment.status);
    return created;
  },

  async validateRentalPayment(paymentId: string, status: PaymentStatus, note?: string) {
    const row = await paymentByPaymentId(paymentId);
    if (!row) return undefined;
    const current = mapPayment(row);
    const notes = parseJson(row.notes);
    notes.paymentId = paymentId;
    notes.status = status;
    notes.notes = note ?? current.notes ?? "";
    if (status === "Paid") {
      notes.receiptNumber = stringValue(notes, "receiptNumber", `OR-RNT-${row.booking_number.slice(-4)}`);
    }
    await execute(
      "UPDATE payment_references SET validation_status = ?, validated_by = ?, validated_at = CASE WHEN ? = 'Validated' THEN NOW() ELSE validated_at END, notes = ? WHERE payment_reference_id = ?",
      cleanParams([validationFromPaymentStatus(status), await systemUserId(), validationFromPaymentStatus(status), JSON.stringify(notes), row.payment_reference_id]),
    );
    const bookingMeta = parseJson(row.purpose);
    if (status === "Paid") {
      bookingMeta.statusOverride = "Payment Confirmed";
      bookingMeta.paymentStatusOverride = "Paid";
    } else if (status === "Rejected" || status === "Needs Clarification") {
      bookingMeta.paymentStatusOverride = status;
    }
    await execute(
      "UPDATE rental_bookings SET payment_status = ?, purpose = ? WHERE rental_booking_id = ?",
      cleanParams([bookingPaymentStatusFromPayment(status), JSON.stringify(bookingMeta), row.related_entity_id ?? 0]),
    );
    const updated = await this.getRentalPaymentById(paymentId);
    if (!updated) return undefined;
    let receipt: RentalReceipt | undefined;
    if (status === "Paid") {
      await upsertIncomeRecord(updated, row.payment_reference_id, Number(row.related_entity_id ?? 0), row.member_id);
      receipt = await this.getRentalReceipt(`RCT-${updated.rentalId.slice(-4)}`);
      await addNotification("Rental payment confirmed", `${updated.rentalId} payment was confirmed.`, "payment_references", row.payment_reference_id, false);
    }
    await addRentalAudit(status === "Paid" ? "Confirmed Payment" : "Updated Payment", "payment_references", row.payment_reference_id, "Payment validation updated.", current.status, status);
    return { payment: updated, receipt };
  },

  async uploadRentalPaymentProof(rentalId: string, fileName: string, reference?: string) {
    const inquiry = await this.getRentalInquiryById(rentalId);
    if (!inquiry) throw new Error("Rental request was not found.");
    return this.recordRentalPayment({
      rentalId,
      requesterName: inquiry.requester.fullName,
      equipmentName: inquiry.equipmentName,
      scheduleDate: inquiry.preferredDate,
      amount: 0,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "GCash Reference Upload",
      gcashReference: reference,
      status: "Under Review",
      proofFileName: fileName,
      recordedBy: inquiry.requester.fullName,
      notes: "Amount pending cooperative-validated payment record.",
    });
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

  async recordRentalExpense(expense: Omit<RentalExpense, "expenseId">) {
    const booking = await bookingByRentalId(expense.rentalId);
    if (!booking) throw new Error("Rental request was not found.");
    const userId = await systemUserId();
    const categoryId = await rentalCategoryId(expenseCategoryCode(expense.category));
    const result = await execute(
      `INSERT INTO financial_records
        (record_number, member_id, financial_category_id, recorded_by, approved_by, record_type, source_module, source_record_id, amount, record_date, record_status, remarks)
       VALUES (?, ?, ?, ?, ?, 'Expense', 'Rental', ?, ?, ?, 'Active', ?)`,
      cleanParams([
        `FIN-EXP-${Date.now()}`,
        booking.member_id,
        categoryId,
        userId,
        userId,
        booking.rental_booking_id,
        expense.amount,
        expense.expenseDate,
        JSON.stringify(expense),
      ]),
    );
    const expenseId = `EXP-${String(result.insertId).padStart(3, "0")}`;
    await execute(
      "UPDATE financial_records SET record_number = ?, remarks = ? WHERE financial_record_id = ?",
      cleanParams([`FIN-${expenseId}`, JSON.stringify({ ...expense, expenseId }), result.insertId]),
    );
    await addRentalAudit("Recorded Expense", "financial_records", result.insertId, "Rental expense recorded.", undefined, String(expense.amount));
    return { ...expense, expenseId };
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
