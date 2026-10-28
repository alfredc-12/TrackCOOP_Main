export type MemberActivityQuery = {
  page?: string | number;
  pageSize?: string | number;
  search?: string;
};

export type MemberDashboardQuery = {
  period?: string;
  startDate?: string;
  endDate?: string;
};

export type MemberFinancialCategoryItem = {
  category: string;
  amount: number;
  recordCount: number;
};

export type MemberFinancialTransaction = {
  id: string;
  type: "Income" | "Expense";
  category: string;
  description: string;
  amount: number;
  date: string | Date;
  source: string;
};

export type MemberFinancialSummary = {
  scope: "Member-linked posted activity";
  totalEarnings: number;
  annualInterestEarnings: number;
  totalExpenses: number;
  netResult: number;
  totalPurchases: number;
  totalPatronage: number;
  shareCapitalContributions: number;
  incomeByCategory: MemberFinancialCategoryItem[];
  expenseByCategory: MemberFinancialCategoryItem[];
  transactions: MemberFinancialTransaction[];
  generatedAt: string;
};

export type MemberProfileInput = {
  contact_number?: string | null;
  email?: string | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
};

export type MemberPasswordInput = {
  currentPassword?: string;
  newPassword?: string;
};

export type MemberSupportInput = {
  subject?: string;
  message?: string;
};
