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
  | "Needs Clarification";

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
  sortBy: "submittedAt" | "amount" | "referenceNumber";
  sortDirection: "asc" | "desc";
};

export type PaymentReferenceListResult = {
  paymentReferences: PaymentReference[];
  total: number;
  page: number;
  pageSize: number;
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

export type ReviewPaymentReferenceInput = {
  reason?: string | null;
};
