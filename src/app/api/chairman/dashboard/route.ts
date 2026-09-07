import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { requireApiUser } from "@/lib/next-api-auth";
import type { RowDataPacket } from "mysql2";

export const dynamic = 'force-dynamic';

function getDateFilter(period: string | null): { clause: string; params: (string | number)[] } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  
  if (!period || period === "all") return { clause: "", params: [] };
  if (period === "today") return { clause: "AND DATE(created_at) = ?", params: [today] };
  if (period === "week") return { clause: "AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)", params: [] };
  if (period === "month") return { clause: "AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())", params: [] };
  if (period === "30d") return { clause: "AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)", params: [] };
  if (period === "quarter") return { clause: "AND created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)", params: [] };
  if (period === "year") return { clause: "AND YEAR(created_at) = YEAR(NOW())", params: [] };
  // custom: "YYYY-MM-DD:YYYY-MM-DD"
  if (period.includes(":")) {
    const [from, to] = period.split(":");
    return { clause: "AND DATE(created_at) BETWEEN ? AND ?", params: [from, to] };
  }
  return { clause: "", params: [] };
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser(["chairman"]);
  if (response) return response;
  void user;

  const sp = req.nextUrl.searchParams;
  const period = sp.get("period");
  const barangay = sp.get("barangay");
  const memberStatus = sp.get("memberStatus");
  const memberType = sp.get("memberType");

  const dateFilter = getDateFilter(period);

  try {
    // ── Member counts ──────────────────────────────────────────────
    const memberWhere: string[] = ["1=1"];
    const memberParams: (string | number)[] = [];
    if (barangay) { memberWhere.push("barangay = ?"); memberParams.push(barangay); }
    if (memberStatus) { memberWhere.push("official_member_status = ?"); memberParams.push(memberStatus); }
    if (memberType) { memberWhere.push("membership_type = ?"); memberParams.push(memberType); }

    const [memberRows] = await db.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN official_member_status = 'Active' THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN official_member_status = 'Needs Monitoring' THEN 1 ELSE 0 END) AS needsMonitoring,
         SUM(CASE WHEN official_member_status = 'Inactive' THEN 1 ELSE 0 END) AS inactive
       FROM member_profiles
       WHERE approval_status = 'Approved' AND ${memberWhere.join(" AND ")}`,
      memberParams
    );
    const memberStats = memberRows[0] ?? { total: 0, active: 0, needsMonitoring: 0, inactive: 0 };

    // ── New members this period ────────────────────────────────────
    const newMemberFilter = getDateFilter(period);
    const [newMemberRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM member_profiles
       WHERE approval_status = 'Approved' ${newMemberFilter.clause ? newMemberFilter.clause.replace("AND created_at", "AND approved_at") : ""}`,
      newMemberFilter.params
    );
    const newMembersThisPeriod = Number((newMemberRows as RowDataPacket[])[0]?.count ?? 0);

    // ── Membership trend (last 6 months) ──────────────────────────
    const [memberGrowthRows] = await db.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(created_at, '%b') AS month_name, 
              COUNT(*) AS count 
       FROM member_profiles 
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m-01'), month_name
       ORDER BY DATE_FORMAT(created_at, '%Y-%m-01') DESC`
    );
    
    let runningTotal = Number(memberStats.total);
    const membershipTrend = [];
    const dateCursor = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(dateCursor.getFullYear(), dateCursor.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
      
      membershipTrend.unshift({ month: monthStr, members: runningTotal });
      
      const row = (memberGrowthRows as any[]).find(r => r.month_name === monthStr);
      if (row) {
        runningTotal -= row.count; 
      }
    }

    // ── Member health (Active, Needs Monitoring, Inactive) ─────────────────────────────────────────
    const [pendingRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM member_profiles WHERE approval_status = 'Pending'`
    );
    const pendingApprovals = Number(pendingRows[0]?.count ?? 0);

    // ── Share capital ─────────────────────────────────────────────
    const [scRows] = await db.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM share_capital_payments WHERE status = 'Validated'`
    );
    const totalShareCapital = Number(scRows[0]?.total ?? 0);

    const [scPeriodRows] = await db.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) AS periodTotal FROM share_capital_payments
       WHERE status = 'Validated' ${dateFilter.clause}`,
      dateFilter.params
    );
    const shareCapitalThisPeriod = Number(scPeriodRows[0]?.periodTotal ?? 0);

    // Share capital progress
    const [scProgressRows] = await db.query<RowDataPacket[]>(
      `SELECT
         COUNT(DISTINCT member_id) AS contributingMembers,
         SUM(CASE WHEN total_amount >= 5000 THEN 1 ELSE 0 END) AS reachedMinimum,
         SUM(CASE WHEN total_amount >= 50000 THEN 1 ELSE 0 END) AS reachedMaximum,
         SUM(CASE WHEN total_amount < 5000 THEN 1 ELSE 0 END) AS belowMinimum
       FROM (
         SELECT member_id, SUM(amount) AS total_amount
         FROM share_capital_payments WHERE payment_status = 'Validated'
         GROUP BY member_id
       ) sc`
    );
    const scProgress = scProgressRows[0] ?? {};

    // ── Recent share capital payments ─────────────────────────────
    const [recentScRows] = await db.query<RowDataPacket[]>(
      `SELECT scp.share_payment_id AS id,
              CONCAT(mp.first_name, ' ', mp.last_name) AS memberName,
              scp.amount, scp.payment_date AS date, scp.payment_reference_id AS reference
       FROM share_capital_payments scp
       JOIN member_profiles mp ON mp.member_id = scp.member_id
       WHERE scp.payment_status = 'Validated'
       ORDER BY scp.payment_date DESC LIMIT 8`
    );

    // ── Revenue trend (last 12 months) ────────────────────────────
    const [trendRows] = await db.query<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(month_date, '%b %Y') AS month,
         COALESCE(income, 0) AS income,
         COALESCE(expenses, 0) AS expenses
       FROM (
         SELECT DATE_FORMAT(payment_date, '%Y-%m-01') AS month_date,
                SUM(amount) AS income, 0 AS expenses
         FROM share_capital_payments WHERE payment_status = 'Validated'
         GROUP BY DATE_FORMAT(payment_date, '%Y-%m-01')
       ) t
       ORDER BY month_date DESC LIMIT 12`
    );
    const revenueTrend = [...trendRows].reverse();

    // ── POS sales ─────────────────────────────────────────────────
    const [posRows] = await db.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS txCount
       FROM pos_sales WHERE sale_status = 'Completed' ${dateFilter.clause}`,
      dateFilter.params
    );
    const totalPosSales = Number(posRows[0]?.total ?? 0);
    const posTransactions = Number(posRows[0]?.txCount ?? 0);

    // ── Rental income ─────────────────────────────────────────────
    const [rentalRows] = await db.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS txCount
       FROM rental_payments WHERE payment_status = 'Paid' ${dateFilter.clause}`,
      dateFilter.params
    ).catch(() => [[{ total: 0, txCount: 0 }]]);
    const totalRentalIncome = Number((rentalRows as RowDataPacket[])[0]?.total ?? 0);

    // ── Rental counts ─────────────────────────────────────────────
    const [rentalCountRows] = await db.query<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status IN ('Pending', 'Under Review') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) AS upcoming
       FROM rental_bookings`
    ).catch(() => [[{ completed: 0, pending: 0, upcoming: 0 }]]);
    const rentalCounts = (rentalCountRows as RowDataPacket[])[0] ?? {};

    // ── Income / Expenses totals ──────────────────────────────────
    const totalIncome = totalPosSales + totalRentalIncome + totalShareCapital;
    const totalExpenses = 0; // Expense tracking not yet implemented
    const netSurplus = totalIncome - totalExpenses;

    // ── Income sources ────────────────────────────────────────────
    const incomeTotal = totalPosSales + totalRentalIncome || 1;
    const incomeSources = [
      { source: "Product / POS Sales", amount: totalPosSales, pct: Math.round((totalPosSales / incomeTotal) * 100) },
      { source: "Equipment Rental", amount: totalRentalIncome, pct: Math.round((totalRentalIncome / incomeTotal) * 100) },
      { source: "Share Capital", amount: shareCapitalThisPeriod, pct: 0 },
    ];

    // ── Demographics (top barangays) ──────────────────────────────
    const [demoRows] = await db.query<RowDataPacket[]>(
      `SELECT barangay, COUNT(*) AS totalMembers,
              SUM(CASE WHEN official_member_status = 'Active' THEN 1 ELSE 0 END) AS activeMembers,
              SUM(CASE WHEN official_member_status = 'Needs Monitoring' THEN 1 ELSE 0 END) AS needsMonitoring,
              SUM(CASE WHEN official_member_status = 'Inactive' THEN 1 ELSE 0 END) AS inactiveMembers
       FROM member_profiles
       WHERE approval_status = 'Approved' AND barangay IS NOT NULL AND barangay <> ''
       GROUP BY barangay ORDER BY totalMembers DESC LIMIT 10`
    );

    // ── Inventory alerts ──────────────────────────────────────────
    const [invRows] = await db.query<RowDataPacket[]>(
      `SELECT product_id AS productId, product_name AS productName, stock_quantity AS stock
       FROM products WHERE stock_quantity <= 10 AND is_active = 1
       ORDER BY stock_quantity ASC LIMIT 10`
    ).catch(() => [[]]);

    const lowStockCount = (invRows as RowDataPacket[]).length;
    const [outOfStockRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM products WHERE stock_quantity = 0 AND is_active = 1`
    ).catch(() => [[{ count: 0 }]]);
    const outOfStockCount = Number((outOfStockRows as RowDataPacket[])[0]?.count ?? 0);

    // ── Action items ──────────────────────────────────────────────
    const actionItems: Array<{ id: string; type: string; title: string; description: string; date: Date; module: string; href: string; severity: string }> = [];
    
    if (pendingApprovals > 0) {
      actionItems.push({ id: "pending-approvals", type: "Approval", title: `${pendingApprovals} Pending Membership Application${pendingApprovals > 1 ? "s" : ""}`, description: "Review and approve pending member applications.", date: new Date(), module: "Members", href: "/portal/chairman/members", severity: "warning" });
    }
    if (Number(memberStats.needsMonitoring) > 0) {
      actionItems.push({ id: "needs-monitoring", type: "Notification", title: `${memberStats.needsMonitoring} Member${Number(memberStats.needsMonitoring) > 1 ? "s" : ""} Need Monitoring`, description: "These members have low share capital or engagement.", date: new Date(), module: "Member Indicators", href: "/portal/chairman/member-indicators", severity: "warning" });
    }
    if (Number(rentalCounts.pending) > 0) {
      actionItems.push({ id: "pending-rentals", type: "Notification", title: `${rentalCounts.pending} Rental Request${Number(rentalCounts.pending) > 1 ? "s" : ""} Pending`, description: "Review and respond to pending rental bookings.", date: new Date(), module: "Rentals", href: "/portal/chairman/rentals", severity: "info" });
    }
    if (lowStockCount > 0) {
      actionItems.push({ id: "low-stock", type: "Notification", title: `${lowStockCount} Low Stock Item${lowStockCount > 1 ? "s" : ""}`, description: "Some products are running low. Check inventory.", date: new Date(), module: "Inventory", href: "/portal/chairman/inventory", severity: "warning" });
    }
    if (outOfStockCount > 0) {
      actionItems.push({ id: "out-of-stock", type: "Notification", title: `${outOfStockCount} Out of Stock Item${outOfStockCount > 1 ? "s" : ""}`, description: "These products are completely out of stock.", date: new Date(), module: "Inventory", href: "/portal/chairman/inventory", severity: "critical" });
    }

    // ── Recent activity ───────────────────────────────────────────
    const [activityRows] = await db.query<RowDataPacket[]>(
      `(SELECT 'share_capital' AS type,
               CONCAT('₱', FORMAT(scp.amount, 2), ' share capital payment') AS title,
               CONCAT(mp.first_name, ' ', mp.last_name) AS actor,
               scp.reference_number AS reference,
               scp.payment_date AS activityDate,
               '/portal/chairman/share-capital' AS href
        FROM share_capital_payments scp
        JOIN member_profiles mp ON mp.member_id = scp.member_id
        WHERE scp.payment_status = 'Validated'
        ORDER BY scp.payment_date DESC LIMIT 5)
       UNION ALL
       (SELECT 'membership' AS type,
               CONCAT('Membership application — ', approval_status) AS title,
               CONCAT(first_name, ' ', last_name) AS actor,
               CAST(member_id AS CHAR) AS reference,
               created_at AS activityDate,
               '/portal/chairman/members' AS href
        FROM member_profiles
        ORDER BY created_at DESC LIMIT 5)
       ORDER BY activityDate DESC LIMIT 15`
    );

    return ok({
      generatedAt: new Date().toISOString(),
      filters: { period: period ?? "all", barangay, memberStatus, memberType },
      metrics: {
        totalMembers: Number(memberStats.total),
        newMembersThisPeriod,
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
        active: Number(memberStats.active),
        needsMonitoring: Number(memberStats.needsMonitoring),
        inactive: Number(memberStats.inactive),
      },
      shareCapitalProgress: {
        total: totalShareCapital,
        thisPeriod: shareCapitalThisPeriod,
        contributingMembers: Number(scProgress.contributingMembers ?? 0),
        reachedMinimum: Number(scProgress.reachedMinimum ?? 0),
        reachedMaximum: Number(scProgress.reachedMaximum ?? 0),
        belowMinimum: Number(scProgress.belowMinimum ?? 0),
        totalMembers: Number(memberStats.total),
      },
      revenueTrend,
      membershipTrend,
      incomeSources,
      demographics: demoRows,
      operationsSnapshot: {
        pos: { totalSales: totalPosSales, transactions: posTransactions },
        rental: { totalIncome: totalRentalIncome, completed: Number(rentalCounts.completed ?? 0), pending: Number(rentalCounts.pending ?? 0), upcoming: Number(rentalCounts.upcoming ?? 0) },
        inventory: { lowStock: lowStockCount, outOfStock: outOfStockCount, alerts: invRows },
      },
      inventoryAlerts: invRows,
      recentTransactions: recentScRows,
      actionItems,
      recentActivity: activityRows,
    });
  } catch (err: unknown) {
    console.error("[chairman/dashboard]", err);
    return fail("Failed to load dashboard data.", 500);
  }
}
