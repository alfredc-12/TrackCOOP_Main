import type {
  EquipmentAvailability,
  InquiryDraft,
  RentalAnalytics,
  RentalAuditEntry,
  RentalExpense,
  RentalInquiry,
  RentalMaintenanceRecord,
  RentalNotification,
  RentalOverview,
  RentalPayment,
  RentalReceipt,
  RentalRescheduleRequest,
  RentalReportFilter,
  RentalSchedule,
  RentalService,
  RentalStatus,
  RentalStatusHistoryEntry,
  PublicRentalBlockedDate,
  PublicRentalInquiryStatus,
  ScheduleConflict,
} from "../_types/rental";

export class RentalApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: "NETWORK" | "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "UPLOAD" | "SERVER",
    public details?: unknown,
  ) {
    super(message);
    this.name = "RentalApiError";
  }
}

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "/api";

function codeForStatus(status: number): RentalApiError["code"] {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 400 || status === 422) return "VALIDATION";
  return "SERVER";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${apiBase}/rental${path}`, {
      ...options,
      headers: options?.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...options?.headers },
    });
    const data = await response.json().catch(() => undefined) as T | { message?: string; errors?: unknown } | undefined;
    if (!response.ok) {
      const errorData = data as { message?: string; errors?: unknown } | undefined;
      throw new RentalApiError(errorData?.message ?? "Rental request failed.", response.status, codeForStatus(response.status), errorData?.errors);
    }
    return data as T;
  } catch (error) {
    if (error instanceof RentalApiError) throw error;
    throw new RentalApiError("Unable to reach the TrackCOOP rental API.", 0, "NETWORK", error);
  }
}

export const rentalApiRepository = {
  getRentalOverview: () => request<RentalOverview>("/overview"),
  getRentalServices: () => request<RentalService[]>("/services"),
  getMemberRentalServices: () => request<RentalService[]>("/member-services"),
  getRentalServiceById: (serviceId: string) => request<RentalService>(`/services/${serviceId}`),
  getPublicRentalBlockedDates: (serviceId: string) =>
    request<PublicRentalBlockedDate[]>(
      `/services/${encodeURIComponent(serviceId)}/booked-dates`,
    ),
  getManagedRentalServices: () => request<RentalService[]>("/assets"),
  getManagedRentalServiceById: (serviceId: string) => request<RentalService>(`/assets/${serviceId}`),
  createRentalService: (service: Omit<RentalService, "updatedAt">) => request<RentalService>("/services", { method: "POST", body: JSON.stringify(service) }),
  updateRentalService: (serviceId: string, updates: Partial<RentalService>) => request<RentalService>(`/services/${serviceId}`, { method: "PATCH", body: JSON.stringify(updates) }),
  archiveRentalService: (serviceId: string) => request<RentalService>(`/services/${serviceId}/archive`, { method: "POST" }),
  submitPublicRentalInquiry: (draft: InquiryDraft) => request<RentalInquiry>("/inquiries/public", { method: "POST", body: JSON.stringify(draft) }),
  submitMemberRentalRequest: (draft: InquiryDraft) => request<RentalInquiry>("/requests/member", { method: "POST", body: JSON.stringify(draft) }),
  getRentalInquiries: () => request<RentalInquiry[]>("/inquiries"),
  getMemberRentalInquiries: () =>
    request<RentalInquiry[]>("/member-inquiries"),
  getMemberRentalInquiryById: (inquiryId: string) =>
    request<RentalInquiry>(`/member-inquiries/${inquiryId}`),
  updateMemberRentalStatus: (
    inquiryId: string,
    status: "Scheduled" | "Rescheduled",
    publicNote: string,
    internalNote?: string,
  ) =>
    request<RentalInquiry>(`/member-inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, publicNote, internalNote }),
    }),
  requestMemberRentalReschedule: (
    inquiryId: string,
    reschedule: Pick<
      RentalRescheduleRequest,
      | "requestedDate"
      | "requestedEndDate"
      | "alternativeDate"
      | "alternativeEndDate"
      | "reason"
      | "note"
    >,
  ) =>
    request<RentalInquiry>(`/member-inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "Rescheduled",
        publicNote: `Reschedule requested for ${reschedule.requestedDate} to ${reschedule.requestedEndDate}; NFFAC will review equipment availability.`,
        internalNote: reschedule.note,
        ...reschedule,
      }),
    }),
  getRentalInquiryById: (inquiryId: string) => request<RentalInquiry>(`/inquiries/${inquiryId}`),
  getRentalStatusHistory: (inquiryId: string) =>
    request<RentalStatusHistoryEntry[]>(`/inquiries/${inquiryId}/history`),
  lookupRentalInquiry: (reference: string, contact: string) => request<PublicRentalInquiryStatus>(`/inquiries/status?reference=${encodeURIComponent(reference)}&contact=${encodeURIComponent(contact)}`),
  reviewRentalInquiry: (inquiryId: string, decision: RentalStatus, publicNote: string, internalNote?: string) => request<RentalInquiry>(`/inquiries/${inquiryId}/review`, { method: "POST", body: JSON.stringify({ decision, publicNote, internalNote }) }),
  updateRentalStatus: (inquiryId: string, status: RentalStatus, reason?: string) => request<RentalInquiry>(`/inquiries/${inquiryId}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) }),
  getRentalSchedules: () => request<RentalSchedule[]>("/schedules"),
  createRentalSchedule: (schedule: Omit<RentalSchedule, "scheduleId">) => request<RentalSchedule>("/schedules", { method: "POST", body: JSON.stringify(schedule) }),
  updateRentalSchedule: (scheduleId: string, updates: Partial<RentalSchedule>) => request<RentalSchedule>(`/schedules/${scheduleId}`, { method: "PATCH", body: JSON.stringify(updates) }),
  checkScheduleConflict: (schedule: Omit<RentalSchedule, "scheduleId" | "status" | "paymentStatus">) => request<ScheduleConflict>("/schedules/conflicts", { method: "POST", body: JSON.stringify(schedule) }),
  getEquipmentAvailability: () => request<EquipmentAvailability[]>("/availability"),
  updateEquipmentAvailability: (serviceId: string, status: EquipmentAvailability["status"]) => request<EquipmentAvailability>(`/availability/${serviceId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getRentalMaintenanceRecords: (serviceId?: string) => request<RentalMaintenanceRecord[]>(`/maintenance${serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : ""}`),
  createRentalMaintenanceRecord: (maintenance: Omit<RentalMaintenanceRecord, "maintenanceId" | "equipmentName" | "createdBy" | "createdAt">) => request<RentalMaintenanceRecord>("/maintenance", { method: "POST", body: JSON.stringify(maintenance) }),
  completeRentalMaintenance: (maintenanceId: string) => request<RentalMaintenanceRecord>(`/maintenance/${maintenanceId}/complete`, { method: "POST" }),
  getRentalPayments: () => request<RentalPayment[]>("/payments"),
  getRentalPaymentById: (paymentId: string) => request<RentalPayment>(`/payments/${paymentId}`),
  getRentalPaymentProofUrl: (paymentId: string) =>
    `${apiBase}/rental/payments/${encodeURIComponent(paymentId)}/proof`,
  recordRentalPayment: (payment: Omit<RentalPayment, "paymentId" | "submittedAt">) => request<RentalPayment>("/payments", { method: "POST", body: JSON.stringify(payment) }),
  validateRentalPayment: (paymentId: string, status: RentalPayment["status"], note?: string, amount?: number) => request<{ payment: RentalPayment; receipt?: RentalReceipt }>(`/payments/${paymentId}/validate`, { method: "POST", body: JSON.stringify({ status, note, amount }) }),
  uploadRentalPaymentProof: async (
    rentalId: string,
    file: File,
    reference?: string,
    details?: { amount?: number; paymentDate?: string; notes?: string },
  ) => {
    const data = new FormData();
    data.append("rentalId", rentalId);
    data.append("proof", file);
    if (reference) data.append("reference", reference);
    if (details?.amount !== undefined) {
      data.append("amount", String(details.amount));
    }
    if (details?.paymentDate) data.append("paymentDate", details.paymentDate);
    if (details?.notes) data.append("notes", details.notes);
    return request<RentalPayment>("/payments/proof", { method: "POST", body: data });
  },
  getRentalExpenses: () => request<RentalExpense[]>("/expenses"),
  recordRentalExpense: (expense: Omit<RentalExpense, "expenseId">) => request<RentalExpense>("/expenses", { method: "POST", body: JSON.stringify(expense) }),
  getRentalReceipt: (receiptId: string) => request<RentalReceipt>(`/receipts/${receiptId}`),
  getRentalReports: (filters?: RentalReportFilter) => request<RentalInquiry[]>(`/reports?filters=${encodeURIComponent(JSON.stringify(filters ?? {}))}`),
  getRentalAnalytics: () => request<RentalAnalytics>("/analytics"),
  getEquipmentUtilization: () => request<Array<{ label: string; usage: number; availability: number; bookings: number }>>("/analytics/utilization"),
  getRentalNotifications: () => request<RentalNotification[]>("/notifications"),
  getRentalAuditEntries: () => request<RentalAuditEntry[]>("/audit"),
};
