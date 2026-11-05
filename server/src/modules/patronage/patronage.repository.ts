import { loadPatronageSources as loadSources, assertRefundSourcesUnchanged } from "./patronage-sources";
import { PATRONAGE_POLICY, PATRONAGE_RATE, assertAnnualPatronage, assertCurrentPatronagePolicy, patronageToday } from "./patronage-policy";
import { patronageCapitalColumns, patronageCapitalTotals } from "./patronage-capital.repository";
import { availablePatronageRefund, moneyCents } from "./patronage-capital.rules";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { calculatePatronageAllocations } from "./patronage-calculator";
import type {
  CreatePatronagePeriodInput,
  PatronageAllocation,
  PatronageMemberSummary,
  PatronageFinancialBasis,
  PatronagePeriod,
} from "./patronage.types";

type PeriodRow = RowDataPacket & {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  refundPool: string | number;
  status: PatronagePeriod["status"];
  notes: string | null;
  finalizedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  totalPatronage: string | number | null;
  purchasePatronage: string | number | null;
  rentalPatronage: string | number | null;
  allocatedRefund: string | number | null;
  memberCount: string | number;
  paidCount: string | number;
};


type AllocationRow = RowDataPacket & {
  id: string;
  periodId: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  purchasePatronage: string | number;
  rentalPatronage: string | number;
  totalPatronage: string | number;
  patronageSharePercent: string | number;
  refundAmount: string | number;
  paymentStatus: PatronageAllocation["paymentStatus"];
  paidAt: Date | null;
  paymentNotes: string | null;
  capitalizedAmount?: string | number;
  pendingCapitalAmount?: string | number;
};

type MemberRow = RowDataPacket & {
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
};

type FinancialBasisRow = RowDataPacket & {
  posIncome: string | number | null;
  rentalIncome: string | number | null;
  posExpenses: string | number | null;
  rentalExpenses: string | number | null;
  otherExpenses: string | number | null;
  adjustments: string | number | null;
  postedRecordCount: string | number;
  unpostedRecordCount: string | number;
};

function mapPeriod(row: PeriodRow): PatronagePeriod {
  return {
    ...row,
    policyVersion: row.policyVersion as string ?? "Legacy",
    refundRate: Number(row.refundRate ?? 0),
    refundPool: Number(row.refundPool),
    totalPatronage: Number(row.totalPatronage ?? 0),
    purchasePatronage: Number(row.purchasePatronage ?? 0),
    rentalPatronage: Number(row.rentalPatronage ?? 0),
    allocatedRefund: Number(row.allocatedRefund ?? 0),
    memberCount: Number(row.memberCount ?? 0),
    paidCount: Number(row.paidCount ?? 0),
  };
}

function mapAllocation(row: AllocationRow): PatronageAllocation {
  return {
    ...row,
    purchasePatronage: Number(row.purchasePatronage),
    rentalPatronage: Number(row.rentalPatronage),
    totalPatronage: Number(row.totalPatronage),
    patronageSharePercent: Number(row.patronageSharePercent),
    refundAmount: Number(row.refundAmount),
    capitalizedAmount: Number(row.capitalizedAmount ?? 0),
    pendingCapitalAmount: Number(row.pendingCapitalAmount ?? 0),
    availableRefund: row.policyVersion === PATRONAGE_POLICY && row.membershipType === "True Member" ? availablePatronageRefund({ ...row, capitalizedAmount: row.capitalizedAmount ?? 0, pendingCapitalAmount: row.pendingCapitalAmount ?? 0 }) : 0,
  };
}

const periodSelect = `SELECT CAST(p.patronage_period_id AS CHAR) AS id,
       p.period_name AS name,
       DATE_FORMAT(p.period_start, '%Y-%m-%d') AS startDate,
       DATE_FORMAT(p.period_end, '%Y-%m-%d') AS endDate,
       p.refund_pool AS refundPool,
       p.calculation_policy AS policyVersion, p.refund_rate AS refundRate,
       p.period_status AS status,
       p.notes,
       p.finalized_at AS finalizedAt,
       p.paid_at AS paidAt,
       p.created_at AS createdAt,
       COALESCE(SUM(a.total_patronage), 0) AS totalPatronage,
       COALESCE(SUM(a.purchase_patronage), 0) AS purchasePatronage,
       COALESCE(SUM(a.rental_patronage), 0) AS rentalPatronage,
       COALESCE(SUM(a.refund_amount), 0) AS allocatedRefund,
       COUNT(a.patronage_allocation_id) AS memberCount,
       SUM(a.payment_status = 'Paid') AS paidCount
  FROM patronage_periods p
  LEFT JOIN patronage_allocations a ON a.patronage_period_id = p.patronage_period_id`;

async function loadPeriod(connection: Pick<PoolConnection, "execute">, periodId: string) {
  const [rows] = await connection.execute<PeriodRow[]>(
    `${periodSelect} WHERE p.patronage_period_id = ? GROUP BY p.patronage_period_id LIMIT 1`,
    [periodId],
  );
  return rows[0] ? mapPeriod(rows[0]) : null;
}


export interface PatronageRepository {
  financialBasis(startDate: string, endDate: string): Promise<PatronageFinancialBasis>;
  overview(periodId?: string): Promise<{ periods: PatronagePeriod[]; selectedPeriod: PatronagePeriod | null; allocations: PatronageAllocation[] }>;
  createPeriod(input: CreatePatronagePeriodInput, auth: AuthContext): Promise<PatronagePeriod>;
  recalculate(periodId: string, auth: AuthContext): Promise<PatronagePeriod>;
  finalize(periodId: string, auth: AuthContext): Promise<PatronagePeriod>;
  markPaid(allocationId: string, notes: string | null, auth: AuthContext): Promise<PatronageAllocation>;
  memberSummary(auth: AuthContext): Promise<PatronageMemberSummary>;
}

export function createPatronageRepository(pool?: Pool): PatronageRepository {
  const databasePool = () => pool ?? getPool();

  async function allocationsForPeriod(periodId: string) {
    const [rows] = await databasePool().execute<AllocationRow[]>(
      `SELECT CAST(a.patronage_allocation_id AS CHAR) AS id,
              CAST(a.patronage_period_id AS CHAR) AS periodId,
              CAST(a.member_id AS CHAR) AS memberId,
              m.member_code AS memberCode,
              m.full_name AS memberName,
              m.membership_type AS membershipType,
              a.purchase_patronage AS purchasePatronage,
              a.rental_patronage AS rentalPatronage,
              a.total_patronage AS totalPatronage,
              a.patronage_share_percent AS patronageSharePercent,
              a.refund_amount AS refundAmount,
              a.payment_status AS paymentStatus,
              a.paid_at AS paidAt,
              a.payment_notes AS paymentNotes, p.calculation_policy AS policyVersion, ${patronageCapitalColumns}
         FROM patronage_allocations a
         JOIN patronage_periods p ON p.patronage_period_id = a.patronage_period_id
         JOIN member_profiles m ON m.member_id = a.member_id
        WHERE a.patronage_period_id = ?
        ORDER BY a.patronage_allocation_id DESC`,
      [periodId],
    );
    return rows.map(mapAllocation);
  }

  return {
    async financialBasis(startDate, endDate) {
      assertAnnualPatronage(startDate, endDate);
      const eligibleSources = await loadSources(databasePool(), startDate, endDate);
      const eligibleMemberPatronage = eligibleSources.reduce(
        (sum, item) => sum + item.purchasePatronage + item.rentalPatronage,
        0,
      );
      const [rows] = await databasePool().execute<FinancialBasisRow[]>(
        `SELECT
           COALESCE(SUM(CASE WHEN approved_by IS NOT NULL AND record_status = 'Active' AND source_module = 'POS' AND record_type = 'Income' THEN amount ELSE 0 END), 0) AS posIncome,
           COALESCE(SUM(CASE WHEN approved_by IS NOT NULL AND record_status = 'Active' AND source_module = 'Rental' AND record_type = 'Income' THEN amount ELSE 0 END), 0) AS rentalIncome,
           COALESCE(SUM(CASE WHEN approved_by IS NOT NULL AND record_status = 'Active' AND source_module = 'POS' AND record_type = 'Expense' THEN amount ELSE 0 END), 0) AS posExpenses,
           COALESCE(SUM(CASE WHEN approved_by IS NOT NULL AND record_status = 'Active' AND source_module = 'Rental' AND record_type = 'Expense' THEN amount ELSE 0 END), 0) AS rentalExpenses,
           COALESCE(SUM(CASE WHEN approved_by IS NOT NULL AND record_status = 'Active' AND source_module NOT IN ('POS', 'Rental') AND record_type = 'Expense' THEN amount ELSE 0 END), 0) AS otherExpenses,
           COALESCE(SUM(CASE WHEN approved_by IS NOT NULL AND record_status = 'Active' AND record_type = 'Adjustment' THEN amount ELSE 0 END), 0) AS adjustments,
           SUM(approved_by IS NOT NULL AND record_status = 'Active' AND (source_module IN ('POS', 'Rental') OR record_type IN ('Expense', 'Adjustment'))) AS postedRecordCount,
           SUM(approved_by IS NULL AND record_status = 'Active' AND (source_module IN ('POS', 'Rental') OR record_type IN ('Expense', 'Adjustment'))) AS unpostedRecordCount
         FROM financial_records
        WHERE record_date >= ? AND record_date < DATE_ADD(?, INTERVAL 1 DAY)`,
        [startDate, endDate],
      );
      const row = rows[0];
      const posIncome = Number(row?.posIncome ?? 0);
      const rentalIncome = Number(row?.rentalIncome ?? 0);
      const posExpenses = Number(row?.posExpenses ?? 0);
      const rentalExpenses = Number(row?.rentalExpenses ?? 0);
      const otherExpenses = Number(row?.otherExpenses ?? 0);
      const adjustments = Number(row?.adjustments ?? 0);
      const totalOperatingIncome = posIncome + rentalIncome;
      const totalOperatingExpenses = posExpenses + rentalExpenses + otherExpenses;
      return {
        startDate,
        endDate,
        posIncome,
        rentalIncome,
        totalOperatingIncome,
        posExpenses,
        rentalExpenses,
        otherExpenses,
        totalOperatingExpenses,
        adjustments,
        netOperatingSurplus: totalOperatingIncome - totalOperatingExpenses + adjustments,
        eligibleMemberPatronage,
        estimatedRefund: calculatePatronageAllocations(eligibleSources).reduce((sum, item) => sum + moneyCents(item.refundAmount), 0) / 100,
        refundRate: PATRONAGE_RATE,
        eligibleMemberCount: eligibleSources.filter((item) => item.purchasePatronage + item.rentalPatronage > 0).length,
        postedRecordCount: Number(row?.postedRecordCount ?? 0),
        unpostedRecordCount: Number(row?.unpostedRecordCount ?? 0),
      };
    },

    async overview(periodId) {
      const [periodRows] = await databasePool().execute<PeriodRow[]>(
        `${periodSelect} GROUP BY p.patronage_period_id ORDER BY p.patronage_period_id DESC`,
      );
      const periods = periodRows.map(mapPeriod);
      const selectedPeriod = periods.find((period) => period.id === periodId) ?? periods[0] ?? null;
      return {
        periods,
        selectedPeriod,
        allocations: selectedPeriod ? await allocationsForPeriod(selectedPeriod.id) : [],
      };
    },

    async createPeriod(input, auth) {
      assertAnnualPatronage(input.startDate, input.endDate);
      try { return await withTransaction(async (connection) => {
        const [duplicateNames] = await connection.execute<RowDataPacket[]>(
          `SELECT patronage_period_id FROM patronage_periods
            WHERE LOWER(TRIM(period_name)) = LOWER(TRIM(?)) LIMIT 1`,
          [input.name],
        );
        if (duplicateNames.length) {
          throw new AppError(
            "A patronage period with this name already exists. Review the existing year; refunds cannot be duplicated.",
            409,
            "PATRONAGE_PERIOD_NAME_DUPLICATE",
            [{ code: "PATRONAGE_PERIOD_NAME_DUPLICATE", field: "name", message: "This period name is already used." }],
          );
        }

        const [overlaps] = await connection.execute<RowDataPacket[]>(
          `SELECT patronage_period_id FROM patronage_periods
            WHERE period_start <= ? AND period_end >= ? LIMIT 1`,
          [input.endDate, input.startDate],
        );
        if (overlaps.length) {
          throw new AppError("This calendar year overlaps an existing patronage period. Reconcile any legacy allocations before creating another refund.", 409, "PATRONAGE_PERIOD_OVERLAP");
        }

        const calculated = calculatePatronageAllocations(
          await loadSources(connection, input.startDate, input.endDate),
        );
        if (calculated.length === 0) {
          throw new AppError(
            "No completed, fully paid equipment rentals after True Member eligibility were found for this calendar year.",
            409,
            "PATRONAGE_NO_ELIGIBLE_MEMBER_USAGE",
          );
        }
        const computedRefund = calculated.reduce((sum, item) => sum + moneyCents(item.refundAmount), 0) / 100;
        if (input.refundPool !== undefined && moneyCents(input.refundPool) !== moneyCents(computedRefund)) {
          throw new AppError(
            "The refund total is fixed at 3% of each eligible True Member’s paid equipment rentals. It cannot be entered manually.",
            409,
            "PATRONAGE_POOL_EXCEEDS_MEMBER_USAGE",
          );
        }

        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO patronage_periods
             (period_name, period_start, period_end, refund_pool, notes, created_by, calculation_policy, refund_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [input.name, input.startDate, input.endDate, computedRefund, input.notes ?? null, auth.user.id, PATRONAGE_POLICY, PATRONAGE_RATE],
        );
        const periodId = String(result.insertId);
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'patronage.period_created', 'patronage_periods', ?, 'A patronage refund period was created.', ?)`,
          [auth.user.id, periodId, JSON.stringify(input)],
        );
        const period = await loadPeriod(connection, periodId);
        if (!period) throw new AppError("Patronage period was not found.", 404, "PATRONAGE_PERIOD_NOT_FOUND");
        return period;
      }, databasePool()); } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") throw new AppError("A refund period already exists for this year or name.", 409, "PATRONAGE_PERIOD_DUPLICATE");
        throw error;
      }
    },

    async recalculate(periodId, auth) {
      return withTransaction(async (connection) => {
        await connection.execute("SELECT patronage_period_id FROM patronage_periods WHERE patronage_period_id = ? FOR UPDATE", [periodId]);
        const period = await loadPeriod(connection, periodId);
        if (!period) throw new AppError("Patronage period was not found.", 404, "PATRONAGE_PERIOD_NOT_FOUND");
        if (period.status !== "Draft") {
          throw new AppError("Only draft patronage periods can be recalculated.", 409, "PATRONAGE_PERIOD_LOCKED");
        }

        assertAnnualPatronage(period.startDate, period.endDate);
        const [used] = await connection.execute<RowDataPacket[]>(`SELECT a.patronage_allocation_id FROM patronage_allocations a WHERE a.patronage_period_id = ? AND (a.payment_status = 'Paid' OR EXISTS (SELECT 1 FROM patronage_capital_transfers t WHERE t.patronage_allocation_id = a.patronage_allocation_id)) LIMIT 1`, [periodId]);
        if (used.length) throw new AppError("This period contains payments or transfer history and needs manual review.", 409, "PATRONAGE_HISTORY_LOCKED");
        const calculated = calculatePatronageAllocations(await loadSources(connection, period.startDate, period.endDate));
        if (calculated.length === 0) {
          throw new AppError(
            "No completed, fully paid equipment rentals after True Member eligibility were found for this calendar year.",
            409,
            "PATRONAGE_NO_ELIGIBLE_MEMBER_USAGE",
          );
        }
        const computedRefund = calculated.reduce((sum, item) => sum + moneyCents(item.refundAmount), 0) / 100;
        await connection.execute(`UPDATE patronage_periods SET refund_pool = ?, calculation_policy = ?, refund_rate = ? WHERE patronage_period_id = ?`, [computedRefund, PATRONAGE_POLICY, PATRONAGE_RATE, periodId]);
        await connection.execute("DELETE FROM patronage_allocations WHERE patronage_period_id = ?", [periodId]);
        for (const item of calculated) {
          await connection.execute(
            `INSERT INTO patronage_allocations
               (patronage_period_id, member_id, purchase_patronage, rental_patronage,
                total_patronage, patronage_share_percent, refund_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [periodId, item.memberId, item.purchasePatronage, item.rentalPatronage, item.totalPatronage, item.patronageSharePercent, item.refundAmount],
          );
        }
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'patronage.recalculated', 'patronage_periods', ?, 'Patronage allocations were recalculated.', ?)`,
          [auth.user.id, periodId, JSON.stringify({ memberCount: calculated.length })],
        );
        const updated = await loadPeriod(connection, periodId);
        if (!updated) throw new AppError("Patronage period was not found.", 404, "PATRONAGE_PERIOD_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async finalize(periodId, auth) {
      return withTransaction(async (connection) => {
        await connection.execute("SELECT patronage_period_id FROM patronage_periods WHERE patronage_period_id = ? FOR UPDATE", [periodId]);
        const period = await loadPeriod(connection, periodId);
        if (!period) throw new AppError("Patronage period was not found.", 404, "PATRONAGE_PERIOD_NOT_FOUND");
        if (period.status !== "Draft") {
          throw new AppError("Only draft patronage periods can be finalized.", 409, "PATRONAGE_PERIOD_LOCKED");
        }
        if (period.memberCount === 0 || period.totalPatronage <= 0) {
          throw new AppError("Calculate at least one eligible member allocation before finalizing.", 409, "PATRONAGE_ALLOCATIONS_REQUIRED");
        }
        assertAnnualPatronage(period.startDate, period.endDate, true);
        assertCurrentPatronagePolicy(period.policyVersion);
        const current = calculatePatronageAllocations(await loadSources(connection, period.startDate, period.endDate));
        const [saved] = await connection.execute<AllocationRow[]>(`SELECT CAST(member_id AS CHAR) AS memberId, purchase_patronage AS purchasePatronage, rental_patronage AS rentalPatronage, refund_amount AS refundAmount FROM patronage_allocations WHERE patronage_period_id = ?`, [periodId]);
        if (current.length !== saved.length || current.some((item) => !saved.some((row) => row.memberId === item.memberId && moneyCents(row.purchasePatronage) === 0 && moneyCents(row.rentalPatronage) === moneyCents(item.rentalPatronage) && moneyCents(row.refundAmount) === moneyCents(item.refundAmount))) || moneyCents(period.refundPool) !== current.reduce((sum, item) => sum + moneyCents(item.refundAmount), 0)) {
          throw new AppError("Rental payments or eligibility changed. Recalculate the yearly refunds and review them before finalizing.", 409, "PATRONAGE_RECALCULATION_REQUIRED");
        }
        await connection.execute(
          `UPDATE patronage_periods
              SET period_status = 'Finalized', finalized_by = ?, finalized_at = UTC_TIMESTAMP()
            WHERE patronage_period_id = ?`,
          [auth.user.id, periodId],
        );
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description)
           VALUES (?, 'patronage.finalized', 'patronage_periods', ?, 'Patronage allocations were finalized and locked.')`,
          [auth.user.id, periodId],
        );
        const updated = await loadPeriod(connection, periodId);
        if (!updated) throw new AppError("Patronage period was not found.", 404, "PATRONAGE_PERIOD_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async markPaid(allocationId, notes, auth) {
      return withTransaction(async (connection) => {
        const [rows] = await connection.execute<Array<RowDataPacket & { periodId: string; periodStatus: string; policyVersion: string; membershipType: string; paymentStatus: string; refundAmount: number | string }>>(
          `SELECT CAST(a.patronage_period_id AS CHAR) AS periodId, p.period_status AS periodStatus,
                  a.refund_amount AS refundAmount, a.payment_status AS paymentStatus,
                  p.calculation_policy AS policyVersion, m.membership_type AS membershipType
             FROM patronage_allocations a
             JOIN patronage_periods p ON p.patronage_period_id = a.patronage_period_id
             JOIN member_profiles m ON m.member_id = a.member_id
            WHERE a.patronage_allocation_id = ? FOR UPDATE`,
          [allocationId],
        );
        const record = rows[0];
        if (!record) throw new AppError("Patronage allocation was not found.", 404, "PATRONAGE_ALLOCATION_NOT_FOUND");
        if (record.periodStatus === "Draft") {
          throw new AppError("Finalize the period before recording refund payments.", 409, "PATRONAGE_PERIOD_NOT_FINALIZED");
        }
        if (record.paymentStatus === "Paid") {
          throw new AppError("This patronage refund is already recorded as paid.", 409, "PATRONAGE_REFUND_ALREADY_PAID");
        }
        assertCurrentPatronagePolicy(record.policyVersion as string);
        if (record.membershipType !== "True Member") throw new AppError("Patronage refunds are for True Members only.", 403, "MEMBER_PATRONAGE_NOT_ELIGIBLE");
        await assertRefundSourcesUnchanged(connection, allocationId);
        const totals = await patronageCapitalTotals(connection, allocationId);
        if (totals.pendingCapitalAmount > 0) {
          throw new AppError("Review the pending Share Capital transfer before recording a cash payout.", 409, "PATRONAGE_TRANSFER_PENDING");
        }
        const cashAmount = availablePatronageRefund({ ...record, ...totals });
        if (cashAmount <= 0) throw new AppError("No refund remains for cash payout.", 409, "PATRONAGE_REFUND_UNAVAILABLE");
        const payoutNotes = `Cash paid: ${cashAmount.toFixed(2)}. Added to Share Capital: ${totals.capitalizedAmount.toFixed(2)}.${notes ? ` ${notes}` : ""}`;
        await connection.execute(
          `UPDATE patronage_allocations
              SET payment_status = 'Paid', paid_at = UTC_TIMESTAMP(), paid_by = ?, payment_notes = ?
            WHERE patronage_allocation_id = ?`,
          [auth.user.id, payoutNotes, allocationId],
        );
        const [pendingRows] = await connection.execute<Array<RowDataPacket & { pending: number | string }>>(
          `SELECT SUM(payment_status = 'Pending') AS pending
             FROM patronage_allocations WHERE patronage_period_id = ?`,
          [record.periodId],
        );
        if (Number(pendingRows[0]?.pending ?? 0) === 0) {
          await connection.execute(
            `UPDATE patronage_periods SET period_status = 'Paid', paid_at = UTC_TIMESTAMP()
              WHERE patronage_period_id = ?`,
            [record.periodId],
          );
        }
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'patronage.refund_paid', 'patronage_allocations', ?, 'A member patronage refund was marked paid.', ?)`,
          [auth.user.id, allocationId, JSON.stringify({ notes, cashAmount, capitalizedAmount: totals.capitalizedAmount })],
        );
        const [updatedRows] = await connection.execute<AllocationRow[]>(
          `SELECT CAST(a.patronage_allocation_id AS CHAR) AS id,
                  CAST(a.patronage_period_id AS CHAR) AS periodId,
                  CAST(a.member_id AS CHAR) AS memberId,
                  m.member_code AS memberCode, m.full_name AS memberName, m.membership_type AS membershipType,
                  a.purchase_patronage AS purchasePatronage, a.rental_patronage AS rentalPatronage,
                  a.total_patronage AS totalPatronage, a.patronage_share_percent AS patronageSharePercent,
                  a.refund_amount AS refundAmount, a.payment_status AS paymentStatus,
                  a.paid_at AS paidAt, a.payment_notes AS paymentNotes, ${patronageCapitalColumns}
             FROM patronage_allocations a JOIN member_profiles m ON m.member_id = a.member_id
            WHERE a.patronage_allocation_id = ? FOR UPDATE`,
          [allocationId],
        );
        return mapAllocation(updatedRows[0]);
      }, databasePool());
    },

    async memberSummary(auth) {
      const [members] = await databasePool().execute<MemberRow[]>(
        `SELECT CAST(member_id AS CHAR) AS memberId, member_code AS memberCode,
                full_name AS memberName, membership_type AS membershipType,
                DATE_FORMAT(true_member_since, '%Y-%m-%d') AS trueMemberSince
           FROM member_profiles
          WHERE user_id = ?
            AND approval_status = 'Approved'
            AND official_member_status = 'Active'
            AND membership_type IN ('Associate', 'True Member')
          LIMIT 1`,
        [auth.user.id],
      );
      const member = members[0];
      if (!member) throw new AppError(
        "Only active Associate and True Members can view patronage refunds.",
        403,
        "MEMBER_PATRONAGE_NOT_ELIGIBLE",
      );

      const year = Number(patronageToday().slice(0, 4));
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const source = (await loadSources(databasePool(), startDate, endDate, member.memberId))[0];
      const purchasePatronage = 0;
      const eligible = member.membershipType === "True Member" && Boolean(member.trueMemberSince);
      const eligibilityMessage = member.membershipType !== "True Member" ? "Associate Members do not earn patronage refunds. Only equipment rentals after becoming a True Member qualify." : !member.trueMemberSince ? "Your True Member effective date is missing. Ask the cooperative office to complete it before rental refunds can be computed." : `Eligible equipment rentals must start on or after ${member.trueMemberSince}. POS products do not earn a refund.`;
      const rentalPatronage = source?.rentalPatronage ?? 0;

      const [historyRows] = await databasePool().execute<Array<RowDataPacket & {
        policyVersion: string; periodId: string; periodName: string; startDate: string; endDate: string;
        periodStatus: PatronagePeriod["status"]; totalPatronage: string | number;
        capitalizedAmount: string | number; pendingCapitalAmount: string | number; refundAmount: string | number; paymentStatus: PatronageAllocation["paymentStatus"]; paidAt: Date | null;
      }>>(
        `SELECT CAST(p.patronage_period_id AS CHAR) AS periodId, p.period_name AS periodName,
                DATE_FORMAT(p.period_start, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(p.period_end, '%Y-%m-%d') AS endDate,
                p.calculation_policy AS policyVersion,
                p.period_status AS periodStatus, a.total_patronage AS totalPatronage,
                a.refund_amount AS refundAmount, a.payment_status AS paymentStatus, a.paid_at AS paidAt, ${patronageCapitalColumns}
           FROM patronage_allocations a
           JOIN patronage_periods p ON p.patronage_period_id = a.patronage_period_id
          WHERE a.member_id = ? AND p.period_status IN ('Finalized', 'Paid')
          ORDER BY p.period_end DESC, p.patronage_period_id DESC`,
        [member.memberId],
      );
      const history = historyRows.map((row) => ({
        ...row,
        totalPatronage: Number(row.totalPatronage),
        refundAmount: Number(row.refundAmount),
        capitalizedAmount: Number(row.capitalizedAmount ?? 0),
        pendingCapitalAmount: Number(row.pendingCapitalAmount ?? 0),
      }));
      const allocatedTotal = history.reduce((sum, row) => sum + row.refundAmount, 0);
      const capitalizedTotal = history.reduce((sum, row) => sum + row.capitalizedAmount, 0);
      const pendingCapitalTotal = eligible ? history.filter((row) => row.policyVersion === PATRONAGE_POLICY && row.paymentStatus === "Pending").reduce((sum, row) => sum + row.pendingCapitalAmount, 0) : 0;
      const paidTotal = history.filter((row) => row.paymentStatus === "Paid").reduce((sum, row) => sum + row.refundAmount - row.capitalizedAmount, 0);

      return {
        member: { code: member.memberCode, name: member.memberName, membershipType: member.membershipType, eligible, trueMemberSince: member.trueMemberSince as string | null, eligibilityMessage },
        currentYear: { startDate, endDate, purchasePatronage, rentalPatronage, totalPatronage: rentalPatronage, refundRate: PATRONAGE_RATE, estimatedRefund: calculatePatronageAllocations(source ? [source] : []).reduce((sum, item) => sum + item.refundAmount, 0) },
        refunds: { allocatedTotal, paidTotal, capitalizedTotal, pendingCapitalTotal, pendingTotal: eligible ? history.filter((row) => row.policyVersion === PATRONAGE_POLICY && row.paymentStatus === "Pending").reduce((sum, row) => sum + Math.max(0, moneyCents(row.refundAmount) - moneyCents(row.capitalizedAmount)), 0) / 100 : 0 },
        history,
      };
    },
  };
}
