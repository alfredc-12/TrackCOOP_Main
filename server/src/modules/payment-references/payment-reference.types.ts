export type PaymentPurpose =
  | "Associate Membership Fee"
  | "Share Capital"
  | "Rental"
  | "POS/Product"
  | "Preorder"
  | "Bulk Order"
  | "Document/Certificate"
  | "Other";

export type ValidationStatus =
  | "Pending"
  | "Validated"
  | "Rejected"
  | "Needs Clarification"
  | "Reversed";

export type PaymentReference = {
  id: string;
  memberId: string | null;
  submittedBy: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerContact: string | null;
  provider: string;
  referenceNumber: string;
  paymentPurpose: PaymentPurpose;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  amount: number;
  proofFilePath: string | null;
  validationStatus: ValidationStatus;
  paymentChannel: "PayMongo" | "Manual GCash" | "Cash" | "Bank Transfer" | "Other";
  gatewayEnvironment: "Test" | "Live" | "Manual";
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
  gatewayStatus: string | null;
  gatewayPaymentMethod: string | null;
  gatewayFeeAmount: number | null;
  gatewayNetAmount: number | null;
  paidAt: Date | null;
  webhookReceivedAt: Date | null;
  validationSource: "Manual Bookkeeper" | "PayMongo Webhook" | "System" | null;
  validatedBy: string | null;
  validatedAt: Date | null;
  rejectionReason: string | null;
  notes: string | null;
  submittedAt: Date;
  updatedAt: Date;
};

export type PaymentReferenceListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  validationStatus?: ValidationStatus;
  paymentPurpose?: PaymentPurpose;
  paymentChannel?: PaymentReference["paymentChannel"];
  validationSource?: NonNullable<PaymentReference["validationSource"]>;
  gatewayOnly?: boolean;
  manualOnly?: boolean;
  failedEvents?: boolean;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  sortBy: "submittedAt" | "amount" | "referenceNumber" | "paidAt";
  sortDirection: "asc" | "desc";
};

export type PaymentReferenceListItem = PaymentReference & {
  memberCode: string | null;
  memberName: string | null;
  applicationCode: string | null;
  applicationName: string | null;
  failedGatewayEvents: number;
};

export type PaymentReferenceListResult = {
  paymentReferences: PaymentReference[];
  total: number;
  page: number;
  pageSize: number;
};

export type PaymentValidationListResult = {
  items: PaymentReferenceListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type PaymentReferenceSummary = {
  total: number;
  pendingManual: number;
  needsClarification: number;
  validatedToday: number;
  paymongoTestPayments: number;
  rejected: number;
  validatedAmount: number;
};

export type PaymentValidationHistoryEntry = {
  id: string;
  oldStatus: ValidationStatus | null;
  newStatus: ValidationStatus;
  validationSource: NonNullable<PaymentReference["validationSource"]>;
  reason: string | null;
  changedBy: string | null;
  changedByName: string | null;
  gatewayEventId: string | null;
  changedAt: Date;
};

export type PaymentGatewayEventSummary = {
  id: string;
  eventType: string;
  checkoutId: string | null;
  paymentId: string | null;
  paymentIntentId: string | null;
  livemode: boolean;
  processingStatus: "Received" | "Processing" | "Processed" | "Ignored" | "Failed";
  retryCount: number;
  signatureVerified: boolean;
  eligibleForRetry: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  amount: number | null;
  currency: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paidAt: Date | null;
  receivedAt: Date;
  processedAt: Date | null;
};

export type PaymentCheckoutAttemptSummary = {
  id: string;
  attemptNumber: number;
  checkoutId: string;
  gatewayStatus: string | null;
  gatewayEnvironment: "Test" | "Live";
  amount: number;
  currency: "PHP";
  lastCheckedAt: Date | null;
  reusableUntil: Date;
  supersededAt: Date | null;
  completedAt: Date | null;
  active: boolean;
};

export type PaymentReceiptSummary = {
  receiptNumber: string;
  processingStatus: "Pending" | "Processing" | "Generated" | "Failed";
  documentId: string | null;
  attemptCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  generatedAt: Date | null;
  reversedAt: Date | null;
  reversalNote: string | null;
} | null;

export type PaymentPostingSummary = {
  financialRecordId: string | null;
  financialRecordNumber: string | null;
  financialRecordStatus: "Active" | "Corrected" | "Reversed" | "Voided" | null;
  shareCapitalPaymentId: string | null;
  shareCapitalStatus: "Pending" | "Validated" | "Rejected" | "Reversed" | null;
  membershipRequirementId: string | null;
  membershipRequirementStatus: "Pending" | "Submitted" | "Verified" | "Rejected" | "Waived" | null;
  membershipApplicationStatus: string | null;
  warnings: string[];
};

export type PaymentReferenceDetail = PaymentReference & {
  memberCode: string | null;
  memberName: string | null;
  applicationCode?: string | null;
  applicationName?: string | null;
  submittedByName: string | null;
  validatedByName: string | null;
  validationHistory: PaymentValidationHistoryEntry[];
  gatewayEvents: PaymentGatewayEventSummary[];
  checkoutAttempts?: PaymentCheckoutAttemptSummary[];
  activeAttemptId?: string | null;
  receipt?: PaymentReceiptSummary;
  posting: PaymentPostingSummary;
};

export type GatewayRetryResult = {
  gatewayEventId: string;
  paymentReferenceId: string;
  processingStatus: "Processed";
  retryCount: number;
  alreadyProcessed: boolean;
  receiptStatus: "Pending" | "Processing" | "Generated" | "Failed" | null;
  receiptErrorCode: string | null;
};

export type PaymentReferenceInput = {
  memberId?: string | null;
  submittedBy?: string | null;
  payerName?: string | null;
  payerEmail?: string | null;
  payerContact?: string | null;
  provider?: string;
  referenceNumber: string;
  paymentPurpose: PaymentPurpose;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  amount: number;
  proofFilePath?: string | null;
  notes?: string | null;
};

export type UpdatePaymentReferenceInput = Partial<PaymentReferenceInput>;
export type ReviewPaymentReferenceInput = { reason?: string | null };
export type ReversePaymentReferenceInput = { reason: string; confirmation: string };
export type RetryGatewayEventInput = { note: string };
