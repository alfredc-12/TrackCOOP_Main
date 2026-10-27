export type SeasonStatus = "Draft" | "Active" | "Closed";
export type ProductionStatus = "Draft" | "Recorded" | "Verified" | "Harvested" | "Cancelled";

export type SeasonInput = {
  seasonName: string;
  seasonType: string;
  seasonYear: number;
  startDate: string;
  endDate: string;
  description?: string | null;
};

export type ProductionRecordInput = {
  seasonId: string;
  memberId?: string | null;
  barangay?: string | null;
  sector: string;
  cropName: string;
  areaPlanted?: number | null;
  areaUnit?: string | null;
  quantityProduced: number;
  quantityUnit: string;
  productionCost?: number;
  harvestDate?: string | null;
  productionStatus?: ProductionStatus;
  remarks?: string | null;
};

export type Season = SeasonInput & {
  id: string;
  seasonStatus: SeasonStatus;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  productionRecordCount: number;
};

export type ProductionRecord = ProductionRecordInput & {
  id: string;
  memberName: string | null;
  seasonName: string;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SeasonListQuery = {
  page: number;
  pageSize: number;
  status?: SeasonStatus;
};

export type ProductionListQuery = {
  page: number;
  pageSize: number;
  seasonId?: string;
  status?: ProductionStatus;
};

export type SeasonalAnalyticsQuery = {
  seasonId?: string;
  startDate?: string;
  endDate?: string;
};

export type SeasonalAnalytics = {
  season: Season | null;
  summary: {
    productionQuantity: number;
    productionCost: number;
    salesTotal: number;
    salesTransactions: number;
    incomeTotal: number;
    expenseTotal: number;
    netResult: number;
    profitMargin: number;
  };
  productionByCrop: Array<{ cropName: string; sector: string; quantityProduced: number; productionCost: number; records: number }>;
  financialByCategory: Array<{ categoryName: string; recordType: "Income" | "Expense"; amount: number; records: number }>;
  monthlyTrend: Array<{ month: string; productionQuantity: number; salesTotal: number; incomeTotal: number; expenseTotal: number; netResult: number }>;
};
