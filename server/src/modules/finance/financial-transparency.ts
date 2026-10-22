import type { Pool, RowDataPacket } from "mysql2/promise";

export type FinancialTransparencyQuery = {
  period?: string;
  startDate?: string;
  endDate?: string;
};

type BreakdownRow = RowDataPacket & {
  recordType?: string;
  category?: string | null;
  amount?: number | string | null;
  recordCount?: number | string | null;
};

type SourceRow = RowDataPacket & {
  sourceModule?: string;
  amount?: number | string | null;
};

export type FinancialTransparencyItem = {
  category: string;
  amount: number;
  recordCount: number;
};

export type FinancialTransparencyComparison = {
  label: string;
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
};

export type FinancialTransparencySummary = {
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  incomeByCategory: FinancialTransparencyItem[];
  expenseByCategory: FinancialTransparencyItem[];
  incomeBySource: Array<{ sourceModule: string; amount: number }>;
  generatedAt: string;
  comparison: FinancialTransparencyComparison | null;
};

function validDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function dateFilter(query: FinancialTransparencyQuery) {
  if (query.period === "year") {
    return { clause: "AND YEAR(fr.record_date) = YEAR(CURRENT_DATE())", params: [] as string[] };
  }
  if (query.period === "month") {
    return {
      clause: "AND YEAR(fr.record_date) = YEAR(CURRENT_DATE()) AND MONTH(fr.record_date) = MONTH(CURRENT_DATE())",
      params: [],
    };
  }
  if (query.period === "30d") {
    return { clause: "AND fr.record_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)", params: [] as string[] };
  }
  if (query.period === "custom") {
    if (validDate(query.startDate) && validDate(query.endDate) && query.startDate! <= query.endDate!) {
      return {
        clause: "AND fr.record_date BETWEEN ? AND ?",
        params: [query.startDate!, query.endDate!],
      };
    }
    return { clause: "AND 1 = 0", params: [] as string[] };
  }
  return { clause: "", params: [] as string[] };
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousDateFilter(query: FinancialTransparencyQuery) {
  if (query.period === "year") {
    return {
      clause: "AND YEAR(fr.record_date) = YEAR(CURRENT_DATE()) - 1",
      params: [] as string[],
      label: "Previous year",
    };
  }
  if (query.period === "month") {
    return {
      clause: "AND fr.record_date >= DATE_SUB(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND fr.record_date < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')",
      params: [] as string[],
      label: "Previous month",
    };
  }
  if (query.period === "30d") {
    return {
      clause: "AND fr.record_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY) AND fr.record_date < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)",
      params: [] as string[],
      label: "Previous 30 days",
    };
  }
  if (query.period === "custom" && validDate(query.startDate) && validDate(query.endDate) && query.startDate! <= query.endDate!) {
    const duration = Math.round((Date.parse(`${query.endDate}T00:00:00Z`) - Date.parse(`${query.startDate}T00:00:00Z`)) / 86400000) + 1;
    const previousEnd = shiftDate(query.startDate!, -1);
    const previousStart = shiftDate(previousEnd, -(duration - 1));
    return {
      clause: "AND fr.record_date BETWEEN ? AND ?",
      params: [previousStart, previousEnd],
      label: "Previous period",
    };
  }
  return null;
}

const postedOperatingIncome = `
  fr.source_module <> 'Share Capital'
  AND UPPER(COALESCE(fc.category_code, '')) <> 'SHARE_CAPITAL'
  AND UPPER(COALESCE(fc.category_name, '')) NOT LIKE '%SHARE CAPITAL%'
`;

async function queryFinancialSummary(pool: Pool, filter: ReturnType<typeof dateFilter>) {
  const [breakdownRows] = await pool.query<BreakdownRow[]>(
    `SELECT fr.record_type AS recordType,
            COALESCE(NULLIF(fc.category_name, ''), 'Uncategorized') AS category,
            COALESCE(SUM(fr.amount), 0) AS amount,
            COUNT(*) AS recordCount
       FROM financial_records fr
       LEFT JOIN financial_categories fc
         ON fc.financial_category_id = fr.financial_category_id
      WHERE fr.record_status = 'Active'
        AND fr.approved_by IS NOT NULL
        AND fr.record_type IN ('Income', 'Expense')
        AND (
          fr.record_type = 'Expense'
          OR (${postedOperatingIncome})
        )
        ${filter.clause}
      GROUP BY fr.record_type, COALESCE(NULLIF(fc.category_name, ''), 'Uncategorized')
      ORDER BY fr.record_type ASC, amount DESC`,
    filter.params,
  );
  const [sourceRows] = await pool.query<SourceRow[]>(
    `SELECT fr.source_module AS sourceModule,
            COALESCE(SUM(fr.amount), 0) AS amount
       FROM financial_records fr
       LEFT JOIN financial_categories fc
         ON fc.financial_category_id = fr.financial_category_id
      WHERE fr.record_status = 'Active'
        AND fr.approved_by IS NOT NULL
        AND fr.record_type = 'Income'
        AND ${postedOperatingIncome}
        ${filter.clause}
      GROUP BY fr.source_module
      ORDER BY amount DESC`,
    filter.params,
  );

  const incomeByCategory = breakdownRows
    .filter((row) => row.recordType === "Income")
    .map((row) => ({
      category: String(row.category || "Uncategorized"),
      amount: Number(row.amount || 0),
      recordCount: Number(row.recordCount || 0),
    }));
  const expenseByCategory = breakdownRows
    .filter((row) => row.recordType === "Expense")
    .map((row) => ({
      category: String(row.category || "Uncategorized"),
      amount: Number(row.amount || 0),
      recordCount: Number(row.recordCount || 0),
    }));
  const incomeTotal = incomeByCategory.reduce((total, item) => total + item.amount, 0);
  const expenseTotal = expenseByCategory.reduce((total, item) => total + item.amount, 0);

  return {
    incomeTotal,
    expenseTotal,
    netTotal: incomeTotal - expenseTotal,
    incomeByCategory,
    expenseByCategory,
    incomeBySource: sourceRows.map((row) => ({
      sourceModule: String(row.sourceModule || "Other"),
      amount: Number(row.amount || 0),
    })),
  };
}

export async function getFinancialTransparency(
  pool: Pool,
  query: FinancialTransparencyQuery = {},
): Promise<FinancialTransparencySummary> {
  const current = await queryFinancialSummary(pool, dateFilter(query));
  const previous = previousDateFilter(query);
  const previousSummary = previous ? await queryFinancialSummary(pool, previous) : null;

  return {
    ...current,
    generatedAt: new Date().toISOString(),
    comparison: previous && previousSummary
      ? {
          label: previous.label,
          incomeTotal: previousSummary.incomeTotal,
          expenseTotal: previousSummary.expenseTotal,
          netTotal: previousSummary.netTotal,
        }
      : null,
  };
}
