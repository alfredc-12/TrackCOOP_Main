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
  PatronageSourceAmount,
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

type SourceRow = RowDataPacket & {
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  purchasePatronage: string | number | null;
  rentalPatronage: string | number | null;
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
  };
}

const periodSelect = `SELECT CAST(p.patronage_period_id AS CHAR) AS id,
       p.period_name AS name,
       DATE_FORMAT(p.period_start, '%Y-%m-%d') AS startDate,
       DATE_FORMAT(p.period_end, '%Y-%m-%d') AS endDate,
       p.refund_pool AS refundPool,
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

async function loadSources(
  connection: Pick<PoolConnection, "execute">,
  startDate: string,
  endDate: string,
  memberId?: string,
): Promise<PatronageSourceAmount[]> {
  const memberFilter = memberId ? " AND m.member_id = ?" : "";
  const params: Array<string> = [startDate, endDate, startDate, endDate];
  if (memberId) params.push(memberId);
  const [rows] = await connection.execute<SourceRow[]>(
    `SELECT CAST(m.member_id AS CHAR) AS memberId,
            m.member_code AS memberCode,
            m.full_name AS memberName,
            m.membership_type AS membershipType,
            COALESCE(pos.purchasePatronage, 0) AS purchasePatronage,
            COALESCE(rental.rentalPatronage, 0) AS rentalPatronage
       FROM member_profiles m
       LEFT JOIN (
         SELECT member_id, SUM(total_amount) AS purchasePatronage
           FROM pos_sales
          WHERE member_id IS NOT NULL
            AND payment_status = 'Paid'
            AND sale_status IN ('Paid', 'Completed')
            AND sale_date >= ?
            AND sale_date < DATE_ADD(?, INTERVAL 1 DAY)
          GROUP BY member_id
       ) pos ON pos.member_id = m.member_id
       LEFT JOIN (
         SELECT member_id, SUM(total_amount) AS rentalPatronage
           FROM rental_bookings
          WHERE member_id IS NOT NULL
            AND booking_status = 'Completed'
            AND payment_status = 'Paid'
            AND COALESCE(completed_at, end_datetime, created_at) >= ?
            AND COALESCE(completed_at, end_datetime, created_at) < DATE_ADD(?, INTERVAL 1 DAY)
          GROUP BY member_id
       ) rental ON rental.member_id = m.member_id
      WHERE m.approval_status = 'Approved'
        AND m.official_member_status = 'Active'
        AND m.membership_type IN ('Associate', 'True Member')${memberFilter}
      ORDER BY m.full_name ASC`,
    params,
  );

  return rows.map((row) => ({
    ...row,
    purchasePatronage: Number(row.purchasePatronage ?? 0),
    rentalPatronage: Number(row.rentalPatronage ?? 0),
  }));
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
              a.payment_notes AS paymentNotes
         FROM patronage_allocations a
         JOIN member_profiles m ON m.member_id = a.member_id
        WHERE a.patronage_period_id = ?
        ORDER BY a.total_patronage DESC, m.full_name ASC`,
      [periodId],
    );
    return rows.map(mapAllocation);
  }

  return {
    async financialBasis(startDate, endDate) {
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
        postedRecordCount: Number(row?.postedRecordCount ?? 0),
        unpostedRecordCount: Number(row?.unpostedRecordCount ?? 0),
      };
    },

    async overview(periodId) {
      const [periodRows] = await databasePool().execute<PeriodRow[]>(
        `${periodSelect} GROUP BY p.patronage_period_id ORDER BY p.period_end DESC, p.patronage_period_id DESC`,
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
      return withTransaction(async (connection) => {
        const [overlaps] = await connection.execute<RowDataPacket[]>(
          `SELECT patronage_period_id FROM patronage_periods
            WHERE period_start <= ? AND period_end >= ? LIMIT 1`,
          [input.endDate, input.startDate],
        );
        if (overlaps.length) {
          throw new AppError("This date range overlaps an existing patronage period.", 409, "PATRONAGE_PERIOD_OVERLAP");
        }

        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO patronage_periods
             (period_name, period_start, period_end, refund_pool, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [input.name, input.startDate, input.endDate, input.refundPool, input.notes ?? null, auth.user.id],
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
      }, databasePool());
    },

    async recalculate(periodId, auth) {
      return withTransaction(async (connection) => {
        const period = await loadPeriod(connection, periodId);
        if (!period) throw new AppError("Patronage period was not found.", 404, "PATRONAGE_PERIOD_NOT_FOUND");
        if (period.status !== "Draft") {
          throw new AppError("Only draft patronage periods can be recalculated.", 409, "PATRONAGE_PERIOD_LOCKED");
        }

        const calculated = calculatePatronageAllocations(
          await loadSources(connection, period.startDate, period.endDate),
          period.refundPool,
        );
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
        const period = await loadPeriod(connection, periodId);
        if (!period) throw new AppError("Patronage period was not found.", 404, "PATRONAGE_PERIOD_NOT_FOUND");
        if (period.status !== "Draft") {
          throw new AppError("Only draft patronage periods can be finalized.", 409, "PATRONAGE_PERIOD_LOCKED");
        }
        if (period.memberCount === 0 || period.totalPatronage <= 0) {
          throw new AppError("Calculate at least one eligible member allocation before finalizing.", 409, "PATRONAGE_ALLOCATIONS_REQUIRED");
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
        const [rows] = await connection.execute<Array<RowDataPacket & { periodId: string; periodStatus: string }>>(
          `SELECT CAST(a.patronage_period_id AS CHAR) AS periodId, p.period_status AS periodStatus
             FROM patronage_allocations a
             JOIN patronage_periods p ON p.patronage_period_id = a.patronage_period_id
            WHERE a.patronage_allocation_id = ? FOR UPDATE`,
          [allocationId],
        );
        const record = rows[0];
        if (!record) throw new AppError("Patronage allocation was not found.", 404, "PATRONAGE_ALLOCATION_NOT_FOUND");
        if (record.periodStatus === "Draft") {
          throw new AppError("Finalize the period before recording refund payments.", 409, "PATRONAGE_PERIOD_NOT_FINALIZED");
        }
        await connection.execute(
          `UPDATE patronage_allocations
              SET payment_status = 'Paid', paid_at = UTC_TIMESTAMP(), paid_by = ?, payment_notes = ?
            WHERE patronage_allocation_id = ?`,
          [auth.user.id, notes, allocationId],
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
          [auth.user.id, allocationId, JSON.stringify({ notes })],
        );
        const [updatedRows] = await connection.execute<AllocationRow[]>(
          `SELECT CAST(a.patronage_allocation_id AS CHAR) AS id,
                  CAST(a.patronage_period_id AS CHAR) AS periodId,
                  CAST(a.member_id AS CHAR) AS memberId,
                  m.member_code AS memberCode, m.full_name AS memberName, m.membership_type AS membershipType,
                  a.purchase_patronage AS purchasePatronage, a.rental_patronage AS rentalPatronage,
                  a.total_patronage AS totalPatronage, a.patronage_share_percent AS patronageSharePercent,
                  a.refund_amount AS refundAmount, a.payment_status AS paymentStatus,
                  a.paid_at AS paidAt, a.payment_notes AS paymentNotes
             FROM patronage_allocations a JOIN member_profiles m ON m.member_id = a.member_id
            WHERE a.patronage_allocation_id = ?`,
          [allocationId],
        );
        return mapAllocation(updatedRows[0]);
      }, databasePool());
    },

    async memberSummary(auth) {
      const [members] = await databasePool().execute<MemberRow[]>(
        `SELECT CAST(member_id AS CHAR) AS memberId, member_code AS memberCode,
                full_name AS memberName, membership_type AS membershipType
           FROM member_profiles WHERE user_id = ? LIMIT 1`,
        [auth.user.id],
      );
      const member = members[0];
      if (!member) throw new AppError("Member profile is required.", 403, "MEMBER_PROFILE_REQUIRED");

      const year = new Date().getUTCFullYear();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const source = (await loadSources(databasePool(), startDate, endDate, member.memberId))[0];
      const purchasePatronage = source?.purchasePatronage ?? 0;
      const rentalPatronage = source?.rentalPatronage ?? 0;

      const [historyRows] = await databasePool().execute<Array<RowDataPacket & {
        periodId: string; periodName: string; startDate: string; endDate: string;
        periodStatus: PatronagePeriod["status"]; totalPatronage: string | number;
        refundAmount: string | number; paymentStatus: PatronageAllocation["paymentStatus"]; paidAt: Date | null;
      }>>(
        `SELECT CAST(p.patronage_period_id AS CHAR) AS periodId, p.period_name AS periodName,
                DATE_FORMAT(p.period_start, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(p.period_end, '%Y-%m-%d') AS endDate,
                p.period_status AS periodStatus, a.total_patronage AS totalPatronage,
                a.refund_amount AS refundAmount, a.payment_status AS paymentStatus, a.paid_at AS paidAt
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
      }));
      const allocatedTotal = history.reduce((sum, row) => sum + row.refundAmount, 0);
      const paidTotal = history.filter((row) => row.paymentStatus === "Paid").reduce((sum, row) => sum + row.refundAmount, 0);

      return {
        member: { code: member.memberCode, name: member.memberName, membershipType: member.membershipType },
        currentYear: { startDate, endDate, purchasePatronage, rentalPatronage, totalPatronage: purchasePatronage + rentalPatronage },
        refunds: { allocatedTotal, paidTotal, pendingTotal: allocatedTotal - paidTotal },
        history,
      };
    },
  };
}
