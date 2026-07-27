import { getPool } from "../../db/pool";
import type { RowDataPacket } from "mysql2/promise";
import type { ChairmanDashboardData } from "./dashboard.types";

export class DashboardRepository {
  async getChairmanDashboardData(period?: string): Promise<ChairmanDashboardData> {
    const pool = getPool();

    let dateCondition = "";
    let shareCapitalDateCondition = "";
    let prevDateCondition = "";
    let prevShareCapitalDateCondition = "";
    
    // For members, we find how many joined before the current period to get previous total
    let prevMemberDateCondition = "";
    
    if (period === "30d") {
      dateCondition = " AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
      shareCapitalDateCondition = " AND payment_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
      
      prevDateCondition = " AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)";
      prevShareCapitalDateCondition = " AND payment_date >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND payment_date < DATE_SUB(NOW(), INTERVAL 30 DAY)";
      prevMemberDateCondition = " AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)";
    } else if (period === "year") {
      dateCondition = " AND created_at >= DATE_FORMAT(NOW() ,'%Y-01-01')";
      shareCapitalDateCondition = " AND payment_date >= DATE_FORMAT(NOW() ,'%Y-01-01')";

      prevDateCondition = " AND created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 YEAR), '%Y-01-01') AND created_at < DATE_FORMAT(NOW(), '%Y-01-01')";
      prevShareCapitalDateCondition = " AND payment_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 YEAR), '%Y-01-01') AND payment_date < DATE_FORMAT(NOW(), '%Y-01-01')";
      prevMemberDateCondition = " AND created_at < DATE_FORMAT(NOW() ,'%Y-01-01')";
    } else {
      // Default fallback for 'all' to compare last 30d vs previous 30d for meaningful trends
      prevDateCondition = " AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)";
      prevShareCapitalDateCondition = " AND payment_date >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND payment_date < DATE_SUB(NOW(), INTERVAL 30 DAY)";
      prevMemberDateCondition = " AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)";
    }

    const calculateGrowth = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prev) / prev) * 100);
    };

    // KPIs
    const [[{ totalMembers }]] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) as totalMembers FROM member_profiles WHERE official_member_status = 'Active' AND user_id IS NOT NULL
    `);
    const [[{ prevTotalMembers }]] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) as prevTotalMembers FROM member_profiles WHERE official_member_status = 'Active' AND user_id IS NOT NULL ${prevMemberDateCondition}
    `);

    const [[{ pendingApprovals }]] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) as pendingApprovals FROM membership_applications WHERE application_status IN ('Submitted', 'Under Review', 'Needs Information')
    `);
    const [[{ prevPendingApprovals }]] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) as prevPendingApprovals FROM membership_applications WHERE application_status IN ('Submitted', 'Under Review', 'Needs Information') ${prevDateCondition}
    `);

    const [[{ totalShareCapital }]] = await pool.query<RowDataPacket[]>(`
      SELECT COALESCE(SUM(amount), 0) as totalShareCapital 
      FROM share_capital_payments 
      WHERE payment_status = 'Validated' ${shareCapitalDateCondition}
    `);
    const [[{ prevTotalShareCapital }]] = await pool.query<RowDataPacket[]>(`
      SELECT COALESCE(SUM(amount), 0) as prevTotalShareCapital 
      FROM share_capital_payments 
      WHERE payment_status = 'Validated' ${prevShareCapitalDateCondition}
    `);

    const [[{ totalPosSales }]] = await pool.query<RowDataPacket[]>(`
      SELECT COALESCE(SUM(total_amount), 0) as totalPosSales 
      FROM pos_sales 
      WHERE sale_status = 'Completed' ${dateCondition}
    `);
    const [[{ prevTotalPosSales }]] = await pool.query<RowDataPacket[]>(`
      SELECT COALESCE(SUM(total_amount), 0) as prevTotalPosSales 
      FROM pos_sales 
      WHERE sale_status = 'Completed' ${prevDateCondition}
    `);

    // Member Health Stats
    const [healthRows] = await pool.query<RowDataPacket[]>(`
      SELECT status_label, COUNT(*) as count 
      FROM member_status_indicators 
      GROUP BY status_label
    `);

    const memberHealth = {
      active: 0,
      needsMonitoring: 0,
      inactive: 0,
    };

    for (const row of healthRows) {
      if (row.status_label === 'Active') memberHealth.active = Number(row.count);
      else if (row.status_label === 'Needs Monitoring') memberHealth.needsMonitoring = Number(row.count);
      else if (row.status_label === 'Inactive') memberHealth.inactive = Number(row.count);
    }

    // Revenue Stats
    const [[{ totalRentals }]] = await pool.query<RowDataPacket[]>(`
      SELECT COALESCE(SUM(total_amount), 0) as totalRentals 
      FROM rental_bookings 
      WHERE booking_status = 'Completed' ${dateCondition}
    `);

    // Revenue Trend (Last 6 Months from Financial Summary View)
    const [financialTrend] = await pool.query<RowDataPacket[]>(`
      SELECT 
        DATE_FORMAT(month_start, '%b %Y') as month, 
        total_income as income, 
        total_expense as expenses
      FROM v_financial_monthly_summary
      WHERE month_start >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      ORDER BY month_start ASC
    `);

    const trendMap = new Map<string, { month: string; income: number; expenses: number }>();
    
    // Initialize last 6 months in map
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      trendMap.set(monthStr, { month: monthStr, income: 0, expenses: 0 });
    }

    financialTrend.forEach((row) => {
      if (trendMap.has(row.month)) {
        trendMap.get(row.month)!.income = Number(row.income);
        trendMap.get(row.month)!.expenses = Number(row.expenses);
      }
    });

    const revenueTrend = Array.from(trendMap.values());

    // Action Items (Recent pending applications)
    const [pendingApps] = await pool.query<RowDataPacket[]>(`
      SELECT membership_application_id as application_id, last_name, first_name, created_at 
      FROM membership_applications 
      WHERE application_status IN ('Submitted', 'Under Review', 'Needs Information') 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    const actionItems = pendingApps.map((app) => ({
      id: String(app.application_id),
      type: "Approval" as const,
      title: `Membership Application`,
      description: `${app.first_name} ${app.last_name} applied for membership.`,
      date: app.created_at
    }));

    const [demographicsRows] = await pool.query<RowDataPacket[]>(`
      SELECT barangay, total_members as totalMembers
      FROM v_barangay_member_distribution
      ORDER BY total_members DESC
      LIMIT 5
    `);

    const demographics = demographicsRows.map(row => ({
      barangay: row.barangay,
      totalMembers: Number(row.totalMembers)
    }));

    const [inventoryRows] = await pool.query<RowDataPacket[]>(`
      SELECT product_id as productId, product_name as productName, quantity_on_hand as stock
      FROM v_product_inventory_balance
      ORDER BY quantity_on_hand ASC
      LIMIT 5
    `);

    const inventoryAlerts = inventoryRows.map(row => ({
      productId: String(row.productId),
      productName: row.productName,
      stock: Number(row.stock)
    }));

    const [transactionsRows] = await pool.query<RowDataPacket[]>(`
      SELECT s.share_payment_id as id, m.full_name as memberName, s.amount, s.payment_date as date
      FROM share_capital_payments s
      JOIN member_profiles m ON s.member_id = m.member_id
      WHERE s.payment_status = 'Validated'
      ORDER BY s.payment_date DESC, s.created_at DESC
      LIMIT 5
    `);

    const recentTransactions = transactionsRows.map(row => ({
      id: String(row.id),
      memberName: row.memberName,
      amount: Number(row.amount),
      date: row.date
    }));

    return {
      metrics: {
        totalMembers: Number(totalMembers),
        totalMembersGrowth: calculateGrowth(Number(totalMembers), Number(prevTotalMembers)),
        totalShareCapital: Number(totalShareCapital),
        totalShareCapitalGrowth: calculateGrowth(Number(totalShareCapital), Number(prevTotalShareCapital)),
        pendingApprovals: Number(pendingApprovals),
        pendingApprovalsGrowth: calculateGrowth(Number(pendingApprovals), Number(prevPendingApprovals)),
        totalPosSales: Number(totalPosSales),
        totalPosSalesGrowth: calculateGrowth(Number(totalPosSales), Number(prevTotalPosSales)),
      },
      memberHealth,
      revenue: {
        posSales: Number(totalPosSales),
        rentals: Number(totalRentals),
        loans: 0, // Placeholder if loans module is added later
      },
      revenueTrend,
      demographics,
      inventoryAlerts,
      recentTransactions,
      actionItems,
    };
  }
}
