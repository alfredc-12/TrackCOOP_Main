import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  MemberShareCapitalProgress,
  ShareCapitalInput,
  ShareCapitalListQuery,
  ShareCapitalListResult,
  ShareCapitalPayment,
  ShareCapitalStatus,
  ShareCapitalSummary,
  UpdateShareCapitalInput,
} from "./share-capital.types";

export const INITIAL_SHARE_CAPITAL = 1_500;
export const FULL_SHARE_CAPITAL = 3_000;
export const MAX_SHARE_CAPITAL = 15_000;

type ShareRow = RowDataPacket & {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  paymentReferenceId: string | null;
  amount: string | number;
  paymentDate: Date;
  paymentStatus: ShareCapitalStatus;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  reversalOfPaymentId: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CountRow = RowDataPacket & { total: number };
type SumRow = RowDataPacket & { total: string | number | null };
type SummaryRow = RowDataPacket & {
  validatedTotal: string | number | null;
  pendingTotal: string | number | null;
  validatedPayments: number;
  membersWithValidatedCapital: number;
};
type ProgressRow = RowDataPacket & {
  memberId: string;
  memberCode: string;
  memberName: string;
  shareCapitalDeadline: Date | null;
  validatedTotal: string | number | null;
};

const sortColumns: Record<ShareCapitalListQuery["sortBy"], string> = {
  paymentDate: "s.payment_date",
  amount: "s.amount",
  createdAt: "s.created_at",
};

function shareSelect() {
  return `SELECT CAST(s.share_payment_id AS CHAR) AS id,
                 CAST(s.member_id AS CHAR) AS memberId,
                 m.member_code AS memberCode,
                 m.full_name AS memberName,
                 CAST(s.payment_reference_id AS CHAR) AS paymentReferenceId,
                 s.amount,
                 s.payment_date AS paymentDate,
                 s.payment_status AS paymentStatus,
                 CAST(s.verified_by AS CHAR) AS verifiedBy,
                 s.verified_at AS verifiedAt,
                 CAST(s.reversal_of_payment_id AS CHAR) AS reversalOfPaymentId,
                 s.remarks,
                 s.created_at AS createdAt,
                 s.updated_at AS updatedAt
            FROM share_capital_payments s
            JOIN member_profiles m ON m.member_id = s.member_id`;
}

function mapShare(row: ShareRow): ShareCapitalPayment {
  return { ...row, amount: Number(row.amount) };
}

function dateOrNull(value: string | null | undefined) {
  return value ?? null;
}

async function getValidatedTotal(
  pool: Pick<Pool, "execute">,
  memberId: string,
  excludingPaymentId?: string,
) {
  const params: string[] = [memberId];
  let excludeSql = "";
  if (excludingPaymentId) {
    excludeSql = " AND share_payment_id <> ?";
    params.push(excludingPaymentId);
  }

  const [rows] = await pool.execute<SumRow[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM share_capital_payments
      WHERE member_id = ? AND payment_status = 'Validated'${excludeSql}`,
    params,
  );

  return Number(rows[0]?.total ?? 0);
}

export interface ShareCapitalRepository {
  list(query: ShareCapitalListQuery): Promise<ShareCapitalListResult>;
  findById(paymentId: string): Promise<ShareCapitalPayment | null>;
  create(input: ShareCapitalInput, auth: AuthContext): Promise<ShareCapitalPayment>;
  update(paymentId: string, input: UpdateShareCapitalInput, auth: AuthContext): Promise<ShareCapitalPayment>;
  memberProgress(memberId: string): Promise<MemberShareCapitalProgress>;
  summary(): Promise<ShareCapitalSummary>;
  validatedTotal(memberId: string, excludingPaymentId?: string): Promise<number>;
}

export function createShareCapitalRepository(pool?: Pool): ShareCapitalRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async list(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];

      if (query.search) {
        where.push("(m.full_name LIKE ? OR m.member_code LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search);
      }
      if (query.memberId) {
        where.push("s.member_id = ?");
        values.push(query.memberId);
      }
      if (query.paymentStatus) {
        where.push("s.payment_status = ?");
        values.push(query.paymentStatus);
      }

      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;

      const [rows] = await databasePool().execute<ShareRow[]>(
        `${shareSelect()}
         ${whereSql}
         ORDER BY ${sortColumns[query.sortBy]} ${orderDirection}, s.share_payment_id DESC
         LIMIT ? OFFSET ?`,
        [...values, query.pageSize, offset],
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total
           FROM share_capital_payments s
           JOIN member_profiles m ON m.member_id = s.member_id
          ${whereSql}`,
        values,
      );

      return {
        payments: rows.map(mapShare),
        total: Number(countRows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async findById(paymentId) {
      const [rows] = await databasePool().execute<ShareRow[]>(
        `${shareSelect()} WHERE s.share_payment_id = ? LIMIT 1`,
        [paymentId],
      );
      return rows[0] ? mapShare(rows[0]) : null;
    },

    async create(input, auth) {
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO share_capital_payments
             (member_id, payment_reference_id, amount, payment_date, payment_status, verified_by, verified_at, remarks)
           VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'Validated' THEN ? ELSE NULL END, CASE WHEN ? = 'Validated' THEN UTC_TIMESTAMP() ELSE NULL END, ?)`,
          [
            input.memberId,
            input.paymentReferenceId ?? null,
            input.amount,
            input.paymentDate,
            input.paymentStatus ?? "Pending",
            input.paymentStatus ?? "Pending",
            auth.user.id,
            input.paymentStatus ?? "Pending",
            input.remarks ?? null,
          ],
        );
        const sharePaymentId = String(result.insertId);
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'share_capital.created', 'share_capital_payments', ?, 'A share capital payment was created.', CAST(? AS JSON))`,
          [auth.user.id, sharePaymentId, JSON.stringify(input)],
        );

        const [rows] = await connection.execute<ShareRow[]>(
          `${shareSelect()} WHERE s.share_payment_id = ? LIMIT 1`,
          [sharePaymentId],
        );
        return mapShare(rows[0]);
      }, databasePool());
    },

    async update(paymentId, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findById(paymentId);
        if (!existing) throw new AppError("Share capital payment was not found", 404, "SHARE_CAPITAL_NOT_FOUND");
        if (existing.paymentStatus === "Reversed") {
          throw new AppError("Reversed share capital payments cannot be edited", 409, "SHARE_CAPITAL_LOCKED");
        }

        const nextStatus = input.paymentStatus ?? existing.paymentStatus;
        await connection.execute(
          `UPDATE share_capital_payments
              SET member_id = COALESCE(?, member_id),
                  payment_reference_id = ?,
                  amount = COALESCE(?, amount),
                  payment_date = COALESCE(?, payment_date),
                  payment_status = ?,
                  verified_by = CASE WHEN ? = 'Validated' AND verified_by IS NULL THEN ? ELSE verified_by END,
                  verified_at = CASE WHEN ? = 'Validated' AND verified_at IS NULL THEN UTC_TIMESTAMP() ELSE verified_at END,
                  remarks = ?
            WHERE share_payment_id = ?`,
          [
            input.memberId ?? null,
            Object.prototype.hasOwnProperty.call(input, "paymentReferenceId")
              ? input.paymentReferenceId ?? null
              : existing.paymentReferenceId,
            input.amount ?? null,
            dateOrNull(input.paymentDate),
            nextStatus,
            nextStatus,
            auth.user.id,
            nextStatus,
            Object.prototype.hasOwnProperty.call(input, "remarks")
              ? input.remarks ?? null
              : existing.remarks,
            paymentId,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'share_capital.updated', 'share_capital_payments', ?, 'A share capital payment was updated.', CAST(? AS JSON))`,
          [auth.user.id, paymentId, JSON.stringify(input)],
        );

        const updated = await this.findById(paymentId);
        if (!updated) throw new AppError("Share capital payment was not found", 404, "SHARE_CAPITAL_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    memberProgress(memberId) {
      return databasePool()
        .execute<ProgressRow[]>(
          `SELECT CAST(m.member_id AS CHAR) AS memberId,
                  m.member_code AS memberCode,
                  m.full_name AS memberName,
                  m.share_capital_deadline AS shareCapitalDeadline,
                  COALESCE(SUM(CASE WHEN s.payment_status = 'Validated' THEN s.amount ELSE 0 END), 0) AS validatedTotal
             FROM member_profiles m
             LEFT JOIN share_capital_payments s ON s.member_id = m.member_id
            WHERE m.member_id = ?
            GROUP BY m.member_id`,
          [memberId],
        )
        .then(([rows]) => {
          const row = rows[0];
          if (!row) throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");
          const validatedTotal = Number(row.validatedTotal ?? 0);
          return {
            memberId: row.memberId,
            memberCode: row.memberCode,
            memberName: row.memberName,
            validatedTotal,
            initialRequirement: INITIAL_SHARE_CAPITAL,
            fullRequirement: FULL_SHARE_CAPITAL,
            maximumAllowed: MAX_SHARE_CAPITAL,
            remainingToInitial: Math.max(0, INITIAL_SHARE_CAPITAL - validatedTotal),
            remainingToFull: Math.max(0, FULL_SHARE_CAPITAL - validatedTotal),
            remainingAllowed: Math.max(0, MAX_SHARE_CAPITAL - validatedTotal),
            initialMet: validatedTotal >= INITIAL_SHARE_CAPITAL,
            fullRequirementMet: validatedTotal >= FULL_SHARE_CAPITAL,
            deadline: row.shareCapitalDeadline,
          };
        });
    },

    async summary() {
      const [rows] = await databasePool().execute<SummaryRow[]>(
        `SELECT COALESCE(SUM(CASE WHEN payment_status = 'Validated' THEN amount ELSE 0 END), 0) AS validatedTotal,
                COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN amount ELSE 0 END), 0) AS pendingTotal,
                SUM(payment_status = 'Validated') AS validatedPayments,
                COUNT(DISTINCT CASE WHEN payment_status = 'Validated' THEN member_id END) AS membersWithValidatedCapital
           FROM share_capital_payments`,
      );
      const row = rows[0];
      return {
        validatedTotal: Number(row?.validatedTotal ?? 0),
        pendingTotal: Number(row?.pendingTotal ?? 0),
        validatedPayments: Number(row?.validatedPayments ?? 0),
        membersWithValidatedCapital: Number(row?.membersWithValidatedCapital ?? 0),
        initialRequirement: INITIAL_SHARE_CAPITAL,
        fullRequirement: FULL_SHARE_CAPITAL,
        maximumAllowed: MAX_SHARE_CAPITAL,
      };
    },

    validatedTotal(memberId, excludingPaymentId) {
      return getValidatedTotal(databasePool(), memberId, excludingPaymentId);
    },
  };
}
