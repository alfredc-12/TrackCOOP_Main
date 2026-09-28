export type FinancialCategoryType = "Income" | "Expense" | "Both";
export type FinancialRecordType = "Income" | "Expense" | "Adjustment";
export type FinancialSourceModule =
  | "Manual"
  | "Membership"
  | "Payment"
  | "Share Capital"
  | "Rental"
  | "POS"
  | "Document"
  | "Other";
export type FinancialRecordStatus = "Active" | "Corrected" | "Reversed" | "Voided";
export type OperatingExpenseType =
  | "Salaries"
  | "Fuel"
  | "Electricity"
  | "Repairs"
  | "Office expenses"
  | "Insurance"
  | "Other";

export type FinancialCategory = {
  id: string;
  categoryCode: string;
  categoryName: string;
  categoryType: FinancialCategoryType;
  description: string | null;
  isSystemCategory: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FinancialRecord = {
  id: string;
  recordNumber: string;
  paymentReferenceId: string | null;
  memberId: string | null;
  financialCategoryId: string;
  categoryName: string;
  recordedBy: string;
  approvedBy: string | null;
  recordType: FinancialRecordType;
  sourceModule: FinancialSourceModule;
  sourceRecordId: string | null;
  amount: number;
  recordDate: Date;
  recordStatus: FinancialRecordStatus;
  correctionOfRecordId: string | null;
  reversalOfRecordId: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FinancialCategoryInput = {
  categoryCode: string;
  categoryName: string;
  categoryType: FinancialCategoryType;
  description?: string | null;
  isActive?: boolean;
};

export type UpdateFinancialCategoryInput = Partial<FinancialCategoryInput>;

export type FinancialRecordInput = {
  recordNumber: string;
  paymentReferenceId?: string | null;
  memberId?: string | null;
  financialCategoryId: string;
  recordType: FinancialRecordType;
  sourceModule?: FinancialSourceModule;
  sourceRecordId?: string | null;
  amount: number;
  recordDate: string;
  remarks?: string | null;
};

export type UpdateFinancialRecordInput = Partial<FinancialRecordInput>;

export type OperatingExpenseInput = {
  expenseType: OperatingExpenseType;
  otherDescription?: string | null;
  amount: number;
  expenseDate: string;
  remarks?: string | null;
};

export type OperatingExpenseListQuery = {
  startDate?: string;
  endDate?: string;
};

export type OperatingExpenseRecord = {
  id: string;
  recordNumber: string;
  expenseType: OperatingExpenseType;
  categoryCode: string;
  categoryName: string;
  amount: number;
  expenseDate: string;
  remarks: string | null;
  recordedBy: string;
  approvedBy: string | null;
  createdAt: Date;
};

export type OperatingExpenseTypeTotal = {
  expenseType: OperatingExpenseType;
  total: number;
  count: number;
};

export type OperatingExpenseSummary = {
  items: OperatingExpenseRecord[];
  byType: OperatingExpenseTypeTotal[];
  total: number;
  count: number;
  startDate: string | null;
  endDate: string | null;
};

export type FinancialRecordListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  recordType?: FinancialRecordType;
  recordStatus?: FinancialRecordStatus;
  sortBy: "recordDate" | "amount" | "recordNumber" | "createdAt";
  sortDirection: "asc" | "desc";
};

export type FinancialRecordListResult = {
  records: FinancialRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type FinancialSummary = {
  incomeTotal: number;
  expenseTotal: number;
  adjustmentTotal: number;
  netTotal: number;
  activeRecords: number;
  voidedRecords: number;
};

export type FinancialTrend = {
  month: string;
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
};
