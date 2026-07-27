export type DashboardMetrics = {
  totalMembers: number;
  totalMembersGrowth: number;
  totalShareCapital: number;
  totalShareCapitalGrowth: number;
  pendingApprovals: number;
  pendingApprovalsGrowth: number;
  totalPosSales: number;
  totalPosSalesGrowth: number;
};

export type MemberHealthStats = {
  active: number;
  needsMonitoring: number;
  inactive: number;
};

export type RevenueStats = {
  posSales: number;
  rentals: number;
  loans: number;
};

export type ActionItem = {
  id: string;
  type: "Approval" | "Notification";
  title: string;
  description: string;
  date: string | Date;
};

export type RevenueTrendItem = {
  month: string;
  income: number;
  expenses: number;
};

export type DemographicData = {
  barangay: string;
  totalMembers: number;
};

export type InventoryAlert = {
  productId: string;
  productName: string;
  stock: number;
};

export type TransactionItem = {
  id: string;
  memberName: string;
  amount: number;
  date: string | Date;
};

export type ChairmanDashboardData = {
  metrics: DashboardMetrics;
  memberHealth: MemberHealthStats;
  revenue: RevenueStats;
  revenueTrend: RevenueTrendItem[];
  demographics: DemographicData[];
  inventoryAlerts: InventoryAlert[];
  recentTransactions: TransactionItem[];
  actionItems: ActionItem[];
};
