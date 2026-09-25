import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import type {
  ActionItem,
  ChairmanDashboardData,
  DashboardFilters,
  InventoryAlert,
} from "./dashboard.types";

type CountRow = RowDataPacket & { count: number | string };
type MemberStatsRow = RowDataPacket & {
  total: number | string | null;
  active: number | string | null;
  needsMonitoring: number | string | null;
  inactive: number | string | null;
};
type ShareCapitalProgressRow = RowDataPacket & {
  contributingMembers: number | string | null;
  reachedMinimum: number | string | null;
  reachedMaximum: number | string | null;
  belowMinimum: number | string | null;
};
type RentalCountsRow = RowDataPacket & {
  completed: number | string | null;
  pending: number | string | null;
  upcoming: number | string | null;
};
type StockRow = RowDataPacket & InventoryAlert;

function getDateFilter(period: string | null | undefined, column = "created_at") {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  if (!period || period === "all") return { clause: "", params: [] as Array<string | number> };
  if (period === "today") return { clause: `AND DATE(${column}) = ?`, params: [today] };
  if (period === "week") return { clause: `AND ${column} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`, params: [] };
  if (period === "month") {
    return {
      clause: `AND MONTH(${column}) = MONTH(NOW()) AND YEAR(${column}) = YEAR(NOW())`,
      params: [],
    };
  }
  if (period === "30d") return { clause: `AND ${column} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, params: [] };
  if (period === "quarter") return { clause: `AND ${column} >= DATE_SUB(NOW(), INTERVAL 3 MONTH)`, params: [] };
  if (period === "year") return { clause: `AND YEAR(${column}) = YEAR(NOW())`, params: [] };
  if (period.includes(":")) {
    const [from, to] = period.split(":");
    return { clause: `AND DATE(${column}) BETWEEN ? AND ?`, params: [from, to] };
  }
  return { clause: "", params: [] as Array<string | number> };
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export class DashboardRepository {
  async getChairmanDashboardData(filters: DashboardFilters = {}): Promise<ChairmanDashboardData> {
    const pool = getPool();
    const period = filters.period ?? "all";
    const dateFilter = getDateFilter(period);

    const memberWhere: string[] = ["approval_status = 'Approved'"];
    const memberParams: Array<string | number> = [];
    if (filters.barangay) {
      memberWhere.push("barangay = ?");
      memberParams.push(filters.barangay);
    }
    if (filters.memberStatus) {
      memberWhere.push("official_member_status = ?");
      memberParams.push(filters.memberStatus);
    }
    if (filters.memberType) {
      memberWhere.push("membership_type = ?");
      memberParams.push(filters.memberType);
    }

    const [memberRows] = await pool.query<MemberStatsRow[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN official_member_status = 'Active' THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN official_member_status = 'Needs Monitoring' THEN 1 ELSE 0 END) AS needsMonitoring,
         SUM(CASE WHEN official_member_status = 'Inactive' THEN 1 ELSE 0 END) AS inactive
       FROM member_profiles
       WHERE ${memberWhere.join(" AND ")}`,
      memberParams,
    );
    const memberStats = memberRows[0] ?? { total: 0, active: 0, needsMonitoring: 0, inactive: 0 };

    const newMemberFilter = getDateFilter(period, "approved_at");
    const [newMemberRows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) AS count
         FROM member_profiles
        WHERE approval_status = 'Approved' ${newMemberFilter.clause}`,
      newMemberFilter.params,
    );

    const [memberGrowthRows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(created_at, '%b') AS month_name,
              COUNT(*) AS count
         FROM member_profiles
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-01'), month_name
        ORDER BY DATE_FORMAT(created_at, '%Y-%m-01') DESC`,
    );

    let runningTotal = numberValue(memberStats.total);
    const membershipTrend: { month: string; members: number }[] = [];
    const dateCursor = new Date();
    for (let i = 0; i < 6; i += 1) {
      const d = new Date(dateCursor.getFullYear(), dateCursor.getMonth() - i, 1);
      const month = d.toLocaleDateString("en-US", { month: "short" });
      membershipTrend.unshift({ month, members: runningTotal });
      const row = memberGrowthRows.find((item) => item.month_name === month);
      if (row) runningTotal -= numberValue(row.count);
    }

    const [pendingRows] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS count FROM member_profiles WHERE approval_status = 'Pending'",
    );
    const pendingApprovals = numberValue(pendingRows[0]?.count);

    const [shareCapitalRows] = await pool.query<RowDataPacket[]>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM share_capital_payments WHERE payment_status = 'Validated'",
    );
    const totalShareCapital = numberValue(shareCapitalRows[0]?.total);

    const shareCapitalDateFilter = getDateFilter(period, "payment_date");
    const [shareCapitalPeriodRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) AS periodTotal
         FROM share_capital_payments
        WHERE payment_status = 'Validated' ${shareCapitalDateFilter.clause}`,
      shareCapitalDateFilter.params,
    );
    const shareCapitalThisPeriod = numberValue(shareCapitalPeriodRows[0]?.periodTotal);

    const [shareCapitalProgressRows] = await pool.query<ShareCapitalProgressRow[]>(
      `SELECT
         COUNT(DISTINCT member_id) AS contributingMembers,
         SUM(CASE WHEN total_amount >= 5000 THEN 1 ELSE 0 END) AS reachedMinimum,
         SUM(CASE WHEN total_amount >= 50000 THEN 1 ELSE 0 END) AS reachedMaximum,
         SUM(CASE WHEN total_amount < 5000 THEN 1 ELSE 0 END) AS belowMinimum
       FROM (
         SELECT member_id, SUM(amount) AS total_amount
           FROM share_capital_payments
          WHERE payment_status = 'Validated'
          GROUP BY member_id
       ) sc`,
    );
    const shareCapitalProgress = shareCapitalProgressRows[0] ?? {};

    const [recentShareCapitalRows] = await pool.query<RowDataPacket[]>(
      `SELECT scp.share_payment_id AS id,
              mp.full_name AS memberName,
              scp.amount,
              scp.payment_date AS date,
              scp.payment_reference_id AS reference
         FROM share_capital_payments scp
         JOIN member_profiles mp ON mp.member_id = scp.member_id
        WHERE scp.payment_status = 'Validated'
        ORDER BY scp.payment_date DESC
        LIMIT 8`,
    );

    const [trendRows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(month_start, '%b %Y') AS month,
              total_income AS income,
              total_expense AS expenses
         FROM v_financial_monthly_summary
        WHERE month_start >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        ORDER BY month_start DESC
        LIMIT 12`,
    ).catch(() => [[] as RowDataPacket[]]);
    const revenueTrend = [...trendRows].reverse().map((row) => ({
      month: String(row.month),
      income: numberValue(row.income),
      expenses: numberValue(row.expenses),
    }));

    const [posRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS txCount
         FROM pos_sales
        WHERE sale_status IN ('Paid', 'Completed') ${dateFilter.clause}`,
      dateFilter.params,
    );
    const totalPosSales = numberValue(posRows[0]?.total);
    const posTransactions = numberValue(posRows[0]?.txCount);

    const [rentalRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS txCount
         FROM rental_bookings
        WHERE booking_status = 'Completed' ${dateFilter.clause}`,
      dateFilter.params,
    ).catch(() => [[{ total: 0, txCount: 0 } as RowDataPacket]]);
    const totalRentalIncome = numberValue(rentalRows[0]?.total);

    const [rentalCountRows] = await pool.query<RentalCountsRow[]>(
      `SELECT
         SUM(CASE WHEN booking_status = 'Completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN booking_status IN ('Pending', 'Under Review') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN booking_status = 'Scheduled' THEN 1 ELSE 0 END) AS upcoming
       FROM rental_bookings`,
    ).catch(() => [[{ completed: 0, pending: 0, upcoming: 0 } as RentalCountsRow]]);
    const rentalCounts = rentalCountRows[0] ?? {};

    const totalIncome = totalPosSales + totalRentalIncome + totalShareCapital;
    const totalExpenses = 0;
    const netSurplus = totalIncome - totalExpenses;
    const incomeTotal = totalPosSales + totalRentalIncome + shareCapitalThisPeriod;
    const incomeSources = [
      { source: "Product / POS Sales", amount: totalPosSales, pct: pct(totalPosSales, incomeTotal) },
      { source: "Equipment Rental", amount: totalRentalIncome, pct: pct(totalRentalIncome, incomeTotal) },
      { source: "Share Capital", amount: shareCapitalThisPeriod, pct: pct(shareCapitalThisPeriod, incomeTotal) },
    ];

    const [demographicRows] = await pool.query<RowDataPacket[]>(
      `SELECT barangay,
              COUNT(*) AS totalMembers,
              SUM(CASE WHEN official_member_status = 'Active' THEN 1 ELSE 0 END) AS activeMembers,
              SUM(CASE WHEN official_member_status = 'Needs Monitoring' THEN 1 ELSE 0 END) AS needsMonitoring,
              SUM(CASE WHEN official_member_status = 'Inactive' THEN 1 ELSE 0 END) AS inactiveMembers
         FROM member_profiles
        WHERE approval_status = 'Approved'
          AND barangay IS NOT NULL
          AND barangay <> ''
        GROUP BY barangay
        ORDER BY totalMembers DESC
        LIMIT 10`,
    );

    const [inventoryRows] = await pool.query<StockRow[]>(
      `SELECT CAST(p.product_id AS CHAR) AS productId,
              p.product_name AS productName,
              COALESCE(v.quantity_on_hand, 0) AS stock
         FROM products p
         LEFT JOIN v_product_inventory_balance v ON v.product_id = p.product_id
        WHERE p.product_status <> 'Archived'
          AND COALESCE(v.quantity_on_hand, 0) <= GREATEST(p.reorder_level, 10)
        ORDER BY COALESCE(v.quantity_on_hand, 0) ASC
        LIMIT 10`,
    ).catch(() => [[] as StockRow[]]);
    const inventoryAlerts = inventoryRows.map((row) => ({
      productId: String(row.productId),
      productName: row.productName,
      stock: numberValue(row.stock),
    }));

    const [outOfStockRows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) AS count
         FROM products p
         LEFT JOIN v_product_inventory_balance v ON v.product_id = p.product_id
        WHERE p.product_status <> 'Archived'
          AND COALESCE(v.quantity_on_hand, 0) = 0`,
    ).catch(() => [[{ count: 0 } as CountRow]]);
    const outOfStockCount = numberValue(outOfStockRows[0]?.count);

    const actionItems: ActionItem[] = [];
    if (pendingApprovals > 0) {
      actionItems.push({
        id: "pending-approvals",
        type: "Approval",
        title: `${pendingApprovals} Pending Membership Application${pendingApprovals > 1 ? "s" : ""}`,
        description: "Review and approve pending member applications.",
        date: new Date(),
        module: "Members",
        href: "/portal/chairman/members",
        severity: "warning",
      });
    }
    if (numberValue(memberStats.needsMonitoring) > 0) {
      actionItems.push({
        id: "needs-monitoring",
        type: "Notification",
        title: `${memberStats.needsMonitoring} Member${numberValue(memberStats.needsMonitoring) > 1 ? "s" : ""} Need Monitoring`,
        description: "These members have low share capital or engagement.",
        date: new Date(),
        module: "Member Indicators",
        href: "/portal/chairman/member-indicators",
        severity: "warning",
      });
    }
    if (numberValue(rentalCounts.pending) > 0) {
      actionItems.push({
        id: "pending-rentals",
        type: "Notification",
        title: `${rentalCounts.pending} Rental Request${numberValue(rentalCounts.pending) > 1 ? "s" : ""} Pending`,
        description: "Review and respond to pending rental bookings.",
        date: new Date(),
        module: "Rentals",
        href: "/portal/chairman/rentals",
        severity: "info",
      });
    }
    if (inventoryAlerts.length > 0) {
      actionItems.push({
        id: "low-stock",
        type: "Notification",
        title: `${inventoryAlerts.length} Low Stock Product${inventoryAlerts.length > 1 ? "s" : ""}`,
        description: "Some products are running low. Check inventory.",
        date: new Date(),
        module: "Inventory",
        href: "/portal/chairman/inventory",
        severity: "warning",
      });
    }
    if (outOfStockCount > 0) {
      actionItems.push({
        id: "out-of-stock",
        type: "Notification",
        title: `${outOfStockCount} Out of Stock Product${outOfStockCount > 1 ? "s" : ""}`,
        description: "These products are completely out of stock.",
        date: new Date(),
        module: "Inventory",
        href: "/portal/chairman/inventory",
        severity: "critical",
      });
    }

    const [activityRows] = await pool.query<RowDataPacket[]>(
      `(SELECT 'share_capital' AS type,
               CONCAT('PHP ', FORMAT(scp.amount, 2), ' share capital payment') AS title,
               mp.full_name AS actor,
               CAST(scp.payment_reference_id AS CHAR) AS reference,
               scp.payment_date AS activityDate,
               '/portal/chairman/share-capital' AS href
          FROM share_capital_payments scp
          JOIN member_profiles mp ON mp.member_id = scp.member_id
         WHERE scp.payment_status = 'Validated'
         ORDER BY scp.payment_date DESC
         LIMIT 5)
       UNION ALL
       (SELECT 'membership' AS type,
               CONCAT('Membership application - ', approval_status) AS title,
               full_name AS actor,
               CAST(member_id AS CHAR) AS reference,
               created_at AS activityDate,
               '/portal/chairman/members' AS href
          FROM member_profiles
         ORDER BY created_at DESC
         LIMIT 5)
       ORDER BY activityDate DESC
       LIMIT 15`,
    );

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        period,
        barangay: filters.barangay ?? null,
        memberStatus: filters.memberStatus ?? null,
        memberType: filters.memberType ?? null,
      },
      metrics: {
        totalMembers: numberValue(memberStats.total),
        newMembersThisPeriod: numberValue(newMemberRows[0]?.count),
        totalMembersGrowth: 0,
        totalShareCapital,
        shareCapitalThisPeriod,
        totalShareCapitalGrowth: 0,
        pendingApprovals,
        pendingActionsCount: actionItems.length,
        totalPosSales,
        totalPosSalesGrowth: 0,
        totalRentalIncome,
        totalIncome,
        totalExpenses,
        netSurplus,
        posTransactions,
      },
      memberHealth: {
        active: numberValue(memberStats.active),
        needsMonitoring: numberValue(memberStats.needsMonitoring),
        inactive: numberValue(memberStats.inactive),
      },
      shareCapitalProgress: {
        total: totalShareCapital,
        thisPeriod: shareCapitalThisPeriod,
        contributingMembers: numberValue(shareCapitalProgress.contributingMembers),
        reachedMinimum: numberValue(shareCapitalProgress.reachedMinimum),
        reachedMaximum: numberValue(shareCapitalProgress.reachedMaximum),
        belowMinimum: numberValue(shareCapitalProgress.belowMinimum),
        totalMembers: numberValue(memberStats.total),
      },
      revenueTrend,
      membershipTrend,
      incomeSources,
      demographics: demographicRows.map((row) => ({
        barangay: String(row.barangay),
        totalMembers: numberValue(row.totalMembers),
        activeMembers: numberValue(row.activeMembers),
        needsMonitoring: numberValue(row.needsMonitoring),
        inactiveMembers: numberValue(row.inactiveMembers),
      })),
      operationsSnapshot: {
        pos: { totalSales: totalPosSales, transactions: posTransactions },
        rental: {
          totalIncome: totalRentalIncome,
          completed: numberValue(rentalCounts.completed),
          pending: numberValue(rentalCounts.pending),
          upcoming: numberValue(rentalCounts.upcoming),
        },
        inventory: { lowStock: inventoryAlerts.length, outOfStock: outOfStockCount, alerts: inventoryAlerts },
      },
      inventoryAlerts,
      recentTransactions: recentShareCapitalRows.map((row) => ({
        id: String(row.id),
        memberName: String(row.memberName ?? ""),
        amount: numberValue(row.amount),
        date: row.date as string | Date,
        reference: row.reference ? String(row.reference) : undefined,
      })),
      actionItems,
      recentActivity: activityRows.map((row) => ({
        type: String(row.type),
        title: String(row.title),
        actor: String(row.actor ?? ""),
        reference: String(row.reference ?? ""),
        activityDate: row.activityDate as string | Date,
        href: String(row.href),
      })),
    };
  }
}
