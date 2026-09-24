export type DashboardFilters = {
  period?: string;
  barangay?: string | null;
  memberStatus?: string | null;
  memberType?: string | null;
};

export type DashboardMetrics = {
  totalMembers: number;
  newMembersThisPeriod: number;
  totalMembersGrowth: number;
  totalShareCapital: number;
  shareCapitalThisPeriod: number;
  totalShareCapitalGrowth: number;
  pendingApprovals: number;
  pendingActionsCount: number;
  totalPosSales: number;
  totalPosSalesGrowth: number;
  totalRentalIncome: number;
  totalIncome: number;
  totalExpenses: number;
  netSurplus: number;
  posTransactions: number;
};

export type MemberHealthStats = {
  active: number;
  needsMonitoring: number;
  inactive: number;
};

export type ShareCapitalProgress = {
  total: number;
  thisPeriod: number;
  contributingMembers: number;
  reachedMinimum: number;
  reachedMaximum: number;
  belowMinimum: number;
  totalMembers: number;
};

export type RevenueTrendItem = {
  month: string;
  income: number;
  expenses: number;
};

export type IncomeSource = {
  source: string;
  amount: number;
  pct: number;
};

export type DemographicData = {
  barangay: string;
  totalMembers: number;
  activeMembers: number;
  needsMonitoring: number;
  inactiveMembers: number;
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
  reference?: string;
};

export type OperationsSnapshot = {
  pos: { totalSales: number; transactions: number };
  rental: { totalIncome: number; completed: number; pending: number; upcoming: number };
  inventory: { lowStock: number; outOfStock: number; alerts: InventoryAlert[] };
};

export type ActionItem = {
  id: string;
  type: "Approval" | "Notification";
  title: string;
  description: string;
  date: string | Date;
  module: string;
  href: string;
  severity: "critical" | "warning" | "info";
};

export type ActivityItem = {
  type: string;
  title: string;
  actor: string;
  reference: string;
  activityDate: string | Date;
  href: string;
};

export type ChairmanDashboardData = {
  generatedAt: string;
  filters: { period: string; barangay: string | null; memberStatus: string | null; memberType: string | null };
  metrics: DashboardMetrics;
  memberHealth: MemberHealthStats;
  shareCapitalProgress: ShareCapitalProgress;
  revenueTrend: RevenueTrendItem[];
  membershipTrend: { month: string; members: number }[];
  incomeSources: IncomeSource[];
  demographics: DemographicData[];
  operationsSnapshot: OperationsSnapshot;
  inventoryAlerts: InventoryAlert[];
  recentTransactions: TransactionItem[];
  actionItems: ActionItem[];
  recentActivity: ActivityItem[];
};
