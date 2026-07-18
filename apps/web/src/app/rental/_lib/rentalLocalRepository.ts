import { rentalDemoState } from "../_data/rentalDemoData";
import type {
  EquipmentAvailability,
  InquiryDraft,
  RentalAnalytics,
  RentalAuditEntry,
  RentalDemoState,
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
} from "../_types/rental";
import { checkRentalScheduleConflict } from "./rentalConflict";

const STORAGE_KEY = "trackcoop-rental-demo-v1";

function cloneSeed() {
  return structuredClone(rentalDemoState);
}

function readState(): RentalDemoState {
  if (typeof window === "undefined") return cloneSeed();
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return cloneSeed();
  try {
    return JSON.parse(stored) as RentalDemoState;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return cloneSeed();
  }
}

function saveState(state: RentalDemoState) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function addAudit(state: RentalDemoState, entry: Omit<RentalAuditEntry, "auditId" | "createdAt" | "status">) {
  state.auditEntries.unshift({
    ...entry,
    auditId: nextId("AUD", state.auditEntries.length),
    createdAt: new Date().toISOString(),
    status: "Success",
  });
}

function generateRentalReference(inquiries: RentalInquiry[]) {
  const year = new Date().getFullYear();
  const maximum = inquiries
    .map((item) => Number(item.inquiryId.match(/(\d{4})$/)?.[1] ?? 0))
    .reduce((max, value) => Math.max(max, value), 0);
  return `RNT-${year}-${String(maximum + 1).padStart(4, "0")}`;
}

function serviceAvailability(service: RentalService): EquipmentAvailability["status"] {
  if (service.operationalStatus === "Under Maintenance") return "Under Maintenance";
  if (service.operationalStatus === "Out of Service" || service.availability === "Unavailable") return "Unavailable";
  return service.upcomingBookings ? "Reserved" : "Available";
}

export const rentalLocalRepository = {
  async getRentalOverview(): Promise<RentalOverview> {
    const state = readState();
    const paid = state.payments.filter((item) => item.status === "Paid");
    return {
      totalIncome: paid.reduce((sum, item) => sum + item.amount, 0),
      currentMonthIncome: paid.filter((item) => item.paymentDate.startsWith("2026-07")).reduce((sum, item) => sum + item.amount, 0),
      pendingInquiries: state.inquiries.filter((item) => ["New Inquiry", "Under Review", "Awaiting Information"].includes(item.status)).length,
      awaitingConfirmation: state.inquiries.filter((item) => item.status === "Awaiting Confirmation").length,
      confirmedSchedules: state.schedules.filter((item) => item.status === "Confirmed").length,
      inProgress: state.inquiries.filter((item) => item.status === "In Progress").length,
      completed: state.inquiries.filter((item) => item.status === "Completed").length,
      cancelled: state.inquiries.filter((item) => item.status === "Cancelled").length,
      expenses: state.expenses.reduce((sum, item) => sum + item.amount, 0),
      mostRequestedEquipment: "Farm Tractor",
    };
  },
  async getRentalServices() { return readState().services; },
  async getRentalServiceById(serviceId: string) { return readState().services.find((item) => item.serviceId === serviceId); },
  async createRentalService(service: Omit<RentalService, "updatedAt">) {
    const state = readState();
    const created = { ...service, updatedAt: new Date().toISOString() };
    state.services.unshift(created);
    addAudit(state, { user: "TrackCOOP Admin", role: "Admin", action: "Added Rental Service", equipmentName: created.name, recordAffected: "Rental Service", newValue: created.serviceId, details: "Rental service created in demonstration mode." });
    saveState(state);
    return created;
  },
  async updateRentalService(serviceId: string, updates: Partial<RentalService>) {
    const state = readState();
    const index = state.services.findIndex((item) => item.serviceId === serviceId);
    if (index < 0) return undefined;
    const previous = state.services[index];
    const updated = { ...previous, ...updates, serviceId, updatedAt: new Date().toISOString() };
    state.services[index] = updated;
    addAudit(state, { user: "TrackCOOP Admin", role: "Admin", action: "Edited Rental Service", equipmentName: updated.name, recordAffected: "Rental Service", previousValue: previous.availability, newValue: updated.availability, details: "Rental service updated in demonstration mode." });
    saveState(state);
    return updated;
  },
  async archiveRentalService(serviceId: string) { return this.updateRentalService(serviceId, { operationalStatus: "Archived", visibility: "Hidden" }); },
  async submitPublicRentalInquiry(draft: InquiryDraft) {
    const state = readState();
    const service = state.services.find((item) => item.serviceId === draft.serviceId);
    if (!service) throw new Error("Selected rental service was not found.");
    const reference = generateRentalReference(state.inquiries);
    const now = new Date().toISOString();
    const created: RentalInquiry = {
      inquiryId: reference,
      rentalId: reference,
      requester: {
        requesterId: `REQ-${reference.slice(-4)}`,
        fullName: draft.fullName,
        requesterType: draft.requesterType,
        contactNumber: draft.contactNumber,
        email: draft.email || undefined,
        completeAddress: draft.completeAddress,
        barangay: draft.barangay,
        municipality: draft.municipality,
        preferredContactMethod: draft.preferredContactMethod,
      },
      serviceId: service.serviceId,
      equipmentName: service.name,
      intendedUse: draft.intendedUse,
      preferredDate: draft.preferredDate,
      alternativeDate: draft.alternativeDate || undefined,
      preferredStartTime: draft.preferredStartTime,
      estimatedDuration: draft.estimatedDuration,
      estimatedUsage: draft.estimatedUsage,
      unitOfMeasurement: draft.unitOfMeasurement,
      serviceLocation: draft.serviceLocation,
      serviceBarangay: draft.serviceBarangay,
      requestDescription: draft.requestDescription,
      specialInstructions: draft.specialInstructions || undefined,
      additionalNotes: draft.additionalNotes || undefined,
      attachmentNames: [draft.attachmentName, draft.membershipProofName].filter((item): item is string => Boolean(item)),
      status: "New Inquiry",
      paymentStatus: "Pending",
      scheduleStatus: "Not scheduled",
      publicNote: "NFFAC received your inquiry and will review availability, schedule, pricing, and rental conditions.",
      submittedAt: now,
      updatedAt: now,
    };
    state.inquiries.unshift(created);
    state.notifications.unshift({ notificationId: nextId("NTF", state.notifications.length), type: "Inquiry Received", title: "New rental inquiry received", message: `${created.requester.fullName} requested ${created.equipmentName}.`, createdAt: now, rentalId: reference, read: false, href: `/rental/inquiries/${reference}` });
    addAudit(state, { user: "Public requester", role: "Public", action: "Submitted Inquiry", rentalId: reference, equipmentName: created.equipmentName, recordAffected: "Rental Inquiry", newValue: "New Inquiry", details: "Public rental inquiry submitted." });
    saveState(state);
    return created;
  },
  async submitMemberRentalRequest(draft: InquiryDraft) { return this.submitPublicRentalInquiry({ ...draft, requesterType: "Member" }); },
  async getRentalInquiries() { return readState().inquiries; },
  async getRentalInquiryById(inquiryId: string) { return readState().inquiries.find((item) => item.inquiryId === inquiryId || item.rentalId === inquiryId); },
  async lookupRentalInquiry(reference: string, contact: string) {
    return readState().inquiries.find((item) => item.inquiryId.toLowerCase() === reference.trim().toLowerCase() && item.requester.contactNumber.replace(/\D/g, "") === contact.replace(/\D/g, ""));
  },
  async reviewRentalInquiry(inquiryId: string, decision: RentalStatus, publicNote: string, internalNote?: string) {
    const state = readState();
    const inquiry = state.inquiries.find((item) => item.inquiryId === inquiryId);
    if (!inquiry) return undefined;
    const previous = inquiry.status;
    inquiry.status = decision;
    inquiry.publicNote = publicNote;
    inquiry.internalNote = internalNote;
    inquiry.updatedAt = new Date().toISOString();
    addAudit(state, { user: "TrackCOOP Admin", role: "Admin", action: decision === "Rejected" ? "Rejected Request" : "Reviewed Inquiry", rentalId: inquiry.rentalId, equipmentName: inquiry.equipmentName, recordAffected: "Inquiry status", previousValue: previous, newValue: decision, details: "Inquiry review decision saved." });
    saveState(state);
    return inquiry;
  },
  async updateRentalStatus(inquiryId: string, status: RentalStatus) { return this.reviewRentalInquiry(inquiryId, status, `Your rental request status is now ${status}.`); },
  async getRentalSchedules() { return readState().schedules; },
  async createRentalSchedule(schedule: Omit<RentalSchedule, "scheduleId">) {
    const state = readState();
    const conflict = checkRentalScheduleConflict(schedule, state.schedules, state.services);
    if (conflict.hasConflict) throw Object.assign(new Error("Schedule conflict detected."), { conflict });
    const created = { ...schedule, scheduleId: nextId("SCH", state.schedules.length) };
    state.schedules.push(created);
    const inquiry = state.inquiries.find((item) => item.inquiryId === created.inquiryId);
    if (inquiry) { inquiry.status = created.status === "Confirmed" ? "Scheduled" : "Awaiting Confirmation"; inquiry.scheduleStatus = created.status; inquiry.updatedAt = new Date().toISOString(); }
    addAudit(state, { user: "TrackCOOP Admin", role: "Admin", action: "Created Schedule", rentalId: created.rentalId, equipmentName: created.equipmentName, recordAffected: "Schedule", newValue: `${created.date} ${created.startTime}-${created.endTime}`, details: "Rental schedule created." });
    saveState(state);
    return created;
  },
  async updateRentalSchedule(scheduleId: string, updates: Partial<RentalSchedule>) {
    const state = readState();
    const index = state.schedules.findIndex((item) => item.scheduleId === scheduleId);
    if (index < 0) return undefined;
    state.schedules[index] = { ...state.schedules[index], ...updates, scheduleId };
    saveState(state);
    return state.schedules[index];
  },
  async checkScheduleConflict(schedule: Omit<RentalSchedule, "scheduleId" | "status" | "paymentStatus">) {
    const state = readState();
    return checkRentalScheduleConflict(schedule, state.schedules, state.services);
  },
  async getEquipmentAvailability(): Promise<EquipmentAvailability[]> {
    const state = readState();
    return state.services.map((service) => ({ serviceId: service.serviceId, equipmentName: service.name, status: serviceAvailability(service), nextSchedule: state.schedules.find((item) => item.serviceId === service.serviceId && item.status !== "Cancelled")?.date, maintenanceNote: service.operationalStatus === "Under Maintenance" ? service.operationalNotes : undefined }));
  },
  async updateEquipmentAvailability(serviceId: string, status: EquipmentAvailability["status"]) {
    const state = readState();
    const service = state.services.find((item) => item.serviceId === serviceId);
    if (!service) return undefined;
    service.availability = status === "Unavailable" ? "Unavailable" : status === "Available" ? "Available" : "By Schedule Only";
    service.operationalStatus = status === "Under Maintenance" ? "Under Maintenance" : "Ready for Use";
    saveState(state);
    return { serviceId, equipmentName: service.name, status };
  },
  async getRentalPayments() { return readState().payments; },
  async getRentalPaymentById(paymentId: string) { return readState().payments.find((item) => item.paymentId === paymentId); },
  async recordRentalPayment(payment: Omit<RentalPayment, "paymentId" | "submittedAt">) {
    const state = readState();
    const created = { ...payment, paymentId: nextId("PAY", state.payments.length), submittedAt: new Date().toISOString() };
    state.payments.unshift(created);
    saveState(state);
    return created;
  },
  async validateRentalPayment(paymentId: string, status: RentalPayment["status"], note?: string) {
    const state = readState();
    const payment = state.payments.find((item) => item.paymentId === paymentId);
    if (!payment) return undefined;
    const previous = payment.status;
    payment.status = status;
    payment.notes = note ?? payment.notes;
    let receipt: RentalReceipt | undefined;
    if (status === "Paid") {
      payment.receiptNumber ??= `OR-RNT-${payment.rentalId.slice(-4)}`;
      const inquiry = state.inquiries.find((item) => item.rentalId === payment.rentalId);
      if (inquiry) { inquiry.paymentStatus = "Paid"; inquiry.status = inquiry.status === "Payment Under Review" ? "Payment Confirmed" : inquiry.status; }
      receipt = { receiptId: `RCT-${payment.rentalId.slice(-4)}`, receiptNumber: payment.receiptNumber, rentalId: payment.rentalId, requesterName: payment.requesterName, requesterType: inquiry?.requester.requesterType ?? "Member", equipmentName: payment.equipmentName, scheduleDate: payment.scheduleDate, paymentDate: payment.paymentDate, amountPaid: payment.amount, paymentMethod: payment.paymentMethod, referenceNumber: payment.gcashReference, recordedBy: "NFFAC Bookkeeper", validationStatus: "Paid", verificationCode: `VRF-${payment.rentalId}` };
      const existing = state.receipts.findIndex((item) => item.receiptId === receipt?.receiptId);
      if (existing >= 0) state.receipts[existing] = receipt; else state.receipts.push(receipt);
    }
    addAudit(state, { user: "NFFAC Bookkeeper", role: "Bookkeeper", action: status === "Paid" ? "Confirmed Payment" : "Rejected Payment", rentalId: payment.rentalId, equipmentName: payment.equipmentName, recordAffected: "Payment", previousValue: previous, newValue: status, details: note ?? "Payment validation updated." });
    saveState(state);
    return { payment, receipt };
  },
  async uploadRentalPaymentProof(rentalId: string, file: File, reference?: string) {
    const state = readState();
    const inquiry = state.inquiries.find((item) => item.rentalId === rentalId);
    if (!inquiry) throw new Error("Rental request was not found.");
    const payment: RentalPayment = { paymentId: nextId("PAY", state.payments.length), rentalId, requesterName: inquiry.requester.fullName, equipmentName: inquiry.equipmentName, scheduleDate: inquiry.preferredDate, amount: 0, paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: "GCash Reference Upload", gcashReference: reference, status: "Under Review", proofFileName: file.name, recordedBy: inquiry.requester.fullName, submittedAt: new Date().toISOString(), notes: "Amount pending cooperative-validated payment record." };
    state.payments.unshift(payment);
    inquiry.paymentStatus = "Under Review";
    inquiry.status = "Payment Under Review";
    saveState(state);
    return payment;
  },
  async getRentalExpenses() { return readState().expenses; },
  async recordRentalExpense(expense: Omit<RentalExpense, "expenseId">) {
    const state = readState();
    const created = { ...expense, expenseId: nextId("EXP", state.expenses.length) };
    state.expenses.unshift(created);
    addAudit(state, { user: expense.encodedBy, role: "Bookkeeper", action: "Recorded Expense", rentalId: expense.rentalId, equipmentName: expense.equipmentName, recordAffected: "Rental Expense", newValue: String(expense.amount), details: expense.description });
    saveState(state);
    return created;
  },
  async getRentalReceipt(receiptId: string) { return readState().receipts.find((item) => item.receiptId === receiptId || item.receiptNumber === receiptId); },
  async getRentalReports(filters?: RentalReportFilter) { void filters; return readState().inquiries; },
  async getRentalAnalytics(): Promise<RentalAnalytics> {
    const state = readState();
    const income = state.payments.filter((item) => item.status === "Paid").reduce((sum, item) => sum + item.amount, 0);
    const expenses = state.expenses.reduce((sum, item) => sum + item.amount, 0);
    const completed = state.inquiries.filter((item) => item.status === "Completed").length;
    return { totalIncome: income, totalExpenses: expenses, netIncome: income - expenses, averageIncomePerCompletedRental: completed ? income / completed : 0, completedRentals: completed, paymentCompletionRate: state.payments.length ? Math.round(state.payments.filter((item) => item.status === "Paid").length / state.payments.length * 100) : 0, mostProfitableEquipment: "Farm Tractor", highestDemandEquipment: "Farm Tractor", monthlyIncome: [{ label: "Feb", value: 1800 }, { label: "Mar", value: 2400 }, { label: "Apr", value: 3150 }, { label: "May", value: 2900 }, { label: "Jun", value: 3800 }, { label: "Jul", value: income }], incomeByEquipment: [{ label: "Farm Tractor", value: 4500 }, { label: "Water Pump", value: 2000 }, { label: "Grass Cutter", value: 750 }], expensesByMonth: [{ label: "May", value: 950 }, { label: "Jun", value: 1300 }, { label: "Jul", value: expenses }] };
  },
  async getEquipmentUtilization() { return readState().services.map((service, index) => ({ label: service.name, usage: 72 - index * 6, availability: 88 - index * 3, bookings: service.upcomingBookings })); },
  async getRentalNotifications(): Promise<RentalNotification[]> { return readState().notifications; },
  async getRentalAuditEntries(): Promise<RentalAuditEntry[]> { return readState().auditEntries; },
  async resetDemoData() { if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY); return cloneSeed(); },
};
