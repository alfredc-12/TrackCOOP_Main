import type { Role } from "@/config/roles";

export type DocumentAccessLevel =
  | "PUBLIC"
  | "MEMBER_ONLY"
  | "ADMIN_ONLY"
  | "BOOKKEEPER_ONLY";

export type DocumentStatus =
  | "ACTIVE"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "ARCHIVED";

export type DocumentRecord = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  category: string;
  documentType: string;
  accessLevel: DocumentAccessLevel;
  status: DocumentStatus;
  fileName: string;
  mimeType: string;
  fileExtension: string;
  fileSizeBytes: number;
  expirationDate: string | null;
  uploadedBy: string;
  uploadedById: string | null;
  uploadedAt: string;
  updatedAt: string;
};

export type DocumentActivity = {
  id: string;
  user: string;
  role: string | null;
  action: string;
  occurredAt: string;
};

export type AuditActivity = {
  id: string;
  action: string;
  description: string | null;
  actor: string;
  occurredAt: string;
};

export type DocumentDetail = DocumentRecord & {
  accessHistory: DocumentActivity[];
  auditHistory: AuditActivity[];
};

export type DocumentSummary = {
  total: number;
  recentlyUploaded: number;
  expiringSoon: number;
  archived: number;
  restricted: number;
};

export type DocumentListResponse = {
  documents: DocumentRecord[];
  summary: DocumentSummary;
  total: number;
  page: number;
  pageSize: number;
  filterOptions: {
    uploaders: Array<{ id: string; name: string }>;
  };
};

export type ReportCategory =
  | "FINANCIAL"
  | "MEMBERSHIP"
  | "RENTAL"
  | "SALES_INVENTORY"
  | "DOCUMENTS"
  | "AUDIT_ADMINISTRATION"
  | "AGENCY_COOPERATIVE";

export type ReportFilterKey =
  | "dateFrom"
  | "dateTo"
  | "year"
  | "month"
  | "barangay"
  | "sector"
  | "membershipType"
  | "paymentStatus"
  | "paymentMethod"
  | "rentalAssetId"
  | "rentalStatus"
  | "productId"
  | "productCategory"
  | "documentCategory"
  | "documentAccessLevel"
  | "relatedModule"
  | "userId"
  | "role"
  | "auditAction";

export type ReportDefinition = {
  key: string;
  name: string;
  category: ReportCategory;
  description: string;
  dataSource: string;
  filters: ReportFilterKey[];
  allowedRoles: Role[];
  configurationRequired?: boolean;
};

export type ReportFilters = Partial<Record<ReportFilterKey, string>>;

export type ReportColumn = {
  key: string;
  label: string;
  format?: "currency" | "date" | "datetime" | "number";
};

export type ReportResult = {
  reportId: string;
  reportReference: string;
  reportKey: string;
  reportName: string;
  category: ReportCategory;
  generatedAt: string;
  generatedBy: string;
  periodLabel: string;
  appliedFilters: ReportFilters;
  summary: Array<{
    label: string;
    value: string | number;
    format?: "currency" | "number";
  }>;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  total: number;
};

export type GeneratedReportRecord = {
  id: string;
  reference: string;
  reportKey: string;
  title: string;
  category: ReportCategory;
  periodLabel: string | null;
  generatedBy: string;
  generatedAt: string;
  outputFormat: string;
  status: string;
  documentId: string | null;
  documentReference: string | null;
  filters: ReportFilters;
};

export type ReportFilterOptions = {
  barangays: string[];
  sectors: string[];
  paymentMethods: string[];
  rentalAssets: Array<{ id: string; label: string }>;
  products: Array<{ id: string; label: string }>;
  productCategories: string[];
  documentCategories: string[];
  relatedModules: string[];
  users: Array<{ id: string; label: string }>;
  roles: Array<{ value: string; label: string }>;
};
