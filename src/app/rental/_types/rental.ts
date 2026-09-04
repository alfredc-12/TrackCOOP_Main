export const RENTAL_STATUSES = [
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
] as const;

export const PAYMENT_STATUSES = [
  "Pending",
  "Under Review",
  "Partially Paid",
  "Paid",
  "Rejected",
  "Refunded",
  "Needs Clarification",
] as const;

export type RentalStatus = (typeof RENTAL_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type RequesterType = "Member" | "Public or Non-member";
export type UserRole = "Chairman" | "Bookkeeper" | "Member" | "Public";
export type AvailabilityStatus =
  | "Available"
  | "Limited Availability"
  | "Unavailable"
  | "By Schedule Only";
export type OperationalStatus =
  | "Ready for Use"
  | "Under Maintenance"
  | "Out of Service"
  | "Archived";
export type ServiceVisibility = "Public" | "Member-only" | "Internal only" | "Hidden";

export interface RentalService {
  serviceId: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  imageUrl?: string;
  imageUrls: string[];
  availability: AvailabilityStatus;
  operationalStatus: OperationalStatus;
  visibility: ServiceVisibility;
  unitOfUsage: string;
  suitableActivity: string;
  capacity: string;
  serviceArea: string;
  operatorRequirement: string;
  operationalNotes: string;
  safetyReminders: string[];
  upcomingBookings: number;
  createdAt?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  assetCondition?: string;
  internalNotes?: string;
  availableDays?: string[];
  availableStartTime?: string;
  availableEndTime?: string;
  maximumBookingsPerDay?: number;
  preparationMinutes?: number;
  travelMinutes?: number;
  bufferMinutes?: number;
  assignedCustodian?: string;
  publicTitle?: string;
  publicDescription?: string;
  publicNotes?: string;
  publicAvailabilityMessage?: string;
  featured?: boolean;
  standardRate?: number | null;
  memberRate?: number | null;
  nonMemberRate?: number | null;
  gasolineHandling?: string | null;
  depositRequirement?: number | null;
  cancellationPolicy?: string | null;
  reschedulingPolicy?: string | null;
  paymentDeadline?: string | null;
  updatedAt: string;
}

export interface RentalRequester {
  requesterId: string;
  fullName: string;
  requesterType: RequesterType;
  memberId?: string;
  contactNumber: string;
  email?: string;
  completeAddress: string;
  barangay: string;
  municipality: string;
}

export interface BookingDraft {
  clientRequestId?: string;
  fullName: string;
  requesterType: RequesterType;
  contactNumber: string;
  email: string;
  completeAddress: string;
  barangay: string;
  municipality: string;
  serviceId: string;
  intendedUse: string;
  preferredDate: string;
  preferredEndDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  requestDescription: string;
  notes: string;
  attachmentName?: string;
  membershipProofName?: string;
  dataPrivacyConsent: boolean;
  accuracyConfirmation: boolean;
  contactConsent: boolean;
  preferredPaymentMethod?: "Cash" | "Online";
}

export interface PublicRentalInquiryStatus {
  inquiryId: string;
  equipmentName: string;
  submittedAt: string;
  status: RentalStatus;
  scheduleStatus: string;
  paymentStatus: PaymentStatus;
  confirmedSchedule?: {
    date: string;
    endDate: string;
    startTime: string;
    endTime: string;
  };
  publicNote: string;
  updatedAt: string;
}

export interface PublicRentalBlockedDate {
  date: string;
  startDate: string;
  endDate: string;
  status: "Approved" | "Scheduled" | "In Use" | "Rescheduled" | "Maintenance";
  reason: string;
}

export interface RentalRescheduleRequest {
  requestedDate: string;
  requestedEndDate?: string;
  alternativeDate?: string;
  alternativeEndDate?: string;
  reason: string;
  note?: string;
  requestedAt: string;
  status: "Pending" | "Approved";
}

export interface RentalInquiry {
  inquiryId: string;
  rentalId: string;
  requester: RentalRequester;
  serviceId: string;
  equipmentName: string;
  intendedUse: string;
  preferredDate: string;
  preferredEndDate: string;
  alternativeDate?: string;
  alternativeEndDate?: string;
  preferredStartTime?: string;
  preferredEndTime?: string;
  estimatedDuration: string;
  estimatedUsage: string;
  unitOfMeasurement: string;
  serviceLocation: string;
  serviceBarangay: string;
  requestDescription: string;
  specialInstructions?: string;
  additionalNotes?: string;
  attachmentNames: string[];
  status: RentalStatus;
  paymentStatus: PaymentStatus;
  scheduleStatus: string;
  assignedReviewer?: string;
  rescheduleRequest?: RentalRescheduleRequest;
  preferredPaymentMethod?: "Cash" | "Online";
  publicNote: string;
  internalNote?: string;
  submittedAt: string;
  updatedAt: string;
}

export type ScheduleStatus =
  | "Proposed"
  | "Awaiting Confirmation"
  | "Confirmed"
  | "In Progress"
  | "Completed"
  | "Cancelled"
  | "Maintenance";

export interface RentalSchedule {
  scheduleId: string;
  inquiryId: string;
  rentalId: string;
  serviceId: string;
  equipmentName: string;
  requesterName: string;
  requesterType: RequesterType;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  assignedOperator?: string;
  serviceLocation: string;
  barangay: string;
  preparationMinutes: number;
  travelMinutes: number;
  bufferMinutes: number;
  specialInstructions?: string;
  status: ScheduleStatus;
  paymentStatus: PaymentStatus;
}

export interface ScheduleConflict {
  hasConflict: boolean;
  reasons: string[];
  conflictingSchedules: RentalSchedule[];
  suggestedSlots: string[];
}

export type PaymentMethod =
  | "Direct GCash"
  | "GCash Reference Upload"
  | "Cash"
  | "Bank Transfer"
  | "Other Approved Method";

export interface RentalPayment {
  paymentId: string;
  rentalId: string;
  requesterName: string;
  equipmentName: string;
  scheduleDate: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  gcashReference?: string;
  receiptNumber?: string;
  status: PaymentStatus;
  notes?: string;
  proofFileName?: string;
  recordedBy: string;
  submittedAt: string;
}

export interface RentalExpense {
  expenseId: string;
  rentalId: string;
  expenseDate: string;
  equipmentName: string;
  category: string;
  amount: number;
  payee: string;
  paymentMethod: string;
  referenceNumber?: string;
  receiptFileName?: string;
  description: string;
  remarks?: string;
  encodedBy: string;
}

export interface RentalReceipt {
  receiptId: string;
  receiptNumber: string;
  rentalId: string;
  requesterName: string;
  requesterType: RequesterType;
  equipmentName: string;
  scheduleDate: string;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  recordedBy: string;
  validationStatus: PaymentStatus;
  verificationCode: string;
}

export interface RentalNotification {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  rentalId?: string;
  read: boolean;
  href?: string;
}

export interface RentalAuditEntry {
  auditId: string;
  createdAt: string;
  user: string;
  role: UserRole;
  action: string;
  rentalId?: string;
  equipmentName?: string;
  recordAffected: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  status: "Success" | "Pending" | "Rejected";
  details: string;
}

export interface RentalStatusHistoryEntry {
  historyId: string;
  inquiryId: string;
  previousStatus?: string;
  newStatus: string;
  remarks?: string;
  changedBy: string;
  changedAt: string;
}

export interface RentalReportFilter {
  reportType: string;
  dateFrom?: string;
  dateTo?: string;
  serviceId?: string;
  requesterType?: RequesterType | "All";
  barangay?: string;
  rentalStatus?: RentalStatus | "All";
  paymentStatus?: PaymentStatus | "All";
  expenseCategory?: string;
}

export interface EquipmentAvailability {
  serviceId: string;
  equipmentName: string;
  status: "Available" | "Reserved" | "In Use" | "Under Maintenance" | "Unavailable";
  nextSchedule?: string;
  currentRequester?: string;
  maintenanceNote?: string;
}

export interface RentalMaintenanceRecord {
  maintenanceId: string;
  serviceId: string;
  equipmentName: string;
  maintenanceType: string;
  startAt: string;
  endAt: string;
  description: string;
  technician?: string;
  cost?: number;
  internalNote?: string;
  operationalImpact: "Limited Availability" | "Unavailable" | "Out of Service";
  status: "Scheduled" | "In Progress" | "Completed" | "Cancelled";
  createdBy: string;
  createdAt: string;
  completedAt?: string;
}

export interface RentalOverview {
  totalIncome: number;
  currentMonthIncome: number;
  pendingInquiries: number;
  awaitingConfirmation: number;
  confirmedSchedules: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  expenses: number;
  mostRequestedEquipment: string;
}

export interface RentalAnalytics {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  averageIncomePerCompletedRental: number;
  completedRentals: number;
  paymentCompletionRate: number;
  mostProfitableEquipment: string;
  highestDemandEquipment: string;
  monthlyIncome: Array<{ label: string; value: number }>;
  incomeByEquipment: Array<{ label: string; value: number }>;
  expensesByMonth: Array<{ label: string; value: number }>;
}

export interface IncomeLedgerPayload {
  transactionSource: "Rental Income";
  transactionType: "Income";
  relatedRentalId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  receiptNumber?: string;
  transactionDate: string;
  encodedBy: string;
}

export interface ExpenseLedgerPayload {
  transactionSource: "Rental-Related Expense";
  transactionType: "Expense";
  relatedRentalId: string;
  expenseCategory: string;
  amount: number;
  referenceNumber?: string;
  transactionDate: string;
  encodedBy: string;
}
