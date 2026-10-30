import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { env } from "../../config/env";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { MAX_SHARE_CAPITAL } from "../share-capital/share-capital.constants";
import { assertPatronageCapitalAmount, availablePatronageRefund, moneyCents } from "./patronage-capital.rules";
import type { PatronageCapitalDecision, PatronageCapitalOverview, PatronageCapitalRequest, PatronageCapitalTransfer } from "./patronage-capital.types";

type Database = Pool | PoolConnection;
type TransferRow = RowDataPacket & Omit<PatronageCapitalTransfer, "amount"> & { amount: string | number; requestedBy: string; requestKey: string };
type AllocationRow = RowDataPacket & { id: string; memberId: string; periodId: string; periodName: string; periodStatus: string; paymentStatus: string; refundAmount: number | string };

export const patronageCapitalColumns = `
  COALESCE((SELECT SUM(t.amount) FROM patronage_capital_transfers t
    WHERE t.patronage_allocation_id = a.patronage_allocation_id AND t.transfer_status = 'Approved'), 0) AS capitalizedAmount,
  COALESCE((SELECT SUM(t.amount) FROM patronage_capital_transfers t
    WHERE t.patronage_allocation_id = a.patronage_allocation_id AND t.transfer_status = 'Pending'), 0) AS pendingCapitalAmount`;

export async function patronageCapitalTotals(connection: Database, allocationId: string) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE WHEN transfer_status = 'Approved' THEN amount ELSE 0 END), 0) AS capitalizedAmount,
            COALESCE(SUM(CASE WHEN transfer_status = 'Pending' THEN amount ELSE 0 END), 0) AS pendingCapitalAmount
       FROM patronage_capital_transfers WHERE patronage_allocation_id = ?`, [allocationId],
  );
  return { capitalizedAmount: Number(rows[0]?.capitalizedAmount ?? 0), pendingCapitalAmount: Number(rows[0]?.pendingCapitalAmount ?? 0) };
}

const transferSelect = `SELECT CAST(t.transfer_id AS CHAR) AS id,
       CAST(t.patronage_allocation_id AS CHAR) AS allocationId, CAST(t.member_id AS CHAR) AS memberId,
       m.full_name AS memberName, m.member_code AS memberCode, p.period_name AS periodName,
       t.amount, t.transfer_status AS status, t.requested_at AS requestedAt, t.processed_at AS processedAt,
       t.processing_notes AS notes, CAST(t.share_capital_transaction_id AS CHAR) AS capitalTransactionId,
       CAST(t.requested_by AS CHAR) AS requestedBy, t.request_key AS requestKey
  FROM patronage_capital_transfers t JOIN member_profiles m ON m.member_id = t.member_id
  JOIN patronage_allocations a ON a.patronage_allocation_id = t.patronage_allocation_id
  JOIN patronage_periods p ON p.patronage_period_id = a.patronage_period_id`;

function mapTransfer(row: TransferRow): PatronageCapitalTransfer {
  return { id: row.id, allocationId: row.allocationId, memberId: row.memberId, memberName: row.memberName,
    memberCode: row.memberCode, periodName: row.periodName, amount: Number(row.amount), status: row.status,
    requestedAt: row.requestedAt, processedAt: row.processedAt, notes: row.notes, capitalTransactionId: row.capitalTransactionId };
}

async function memberByUser(connection: Database, userId: string, lock = false) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT CAST(member_id AS CHAR) AS id FROM member_profiles
      WHERE user_id = ? AND approval_status = 'Approved' AND official_member_status = 'Active'
        AND membership_type IN ('Associate', 'True Member') LIMIT 1${lock ? " FOR UPDATE" : ""}`, [userId],
  );
  if (!rows[0]) throw new AppError("An active linked member profile is required.", 403, "MEMBER_PATRONAGE_NOT_ELIGIBLE");
  return String(rows[0].id);
}

async function allocation(connection: Database, id: string, memberId: string) {
  const [rows] = await connection.execute<AllocationRow[]>(
    `SELECT CAST(a.patronage_allocation_id AS CHAR) AS id, CAST(a.member_id AS CHAR) AS memberId,
            CAST(a.patronage_period_id AS CHAR) AS periodId, p.period_name AS periodName,
            p.period_status AS periodStatus, a.payment_status AS paymentStatus, a.refund_amount AS refundAmount
       FROM patronage_allocations a JOIN patronage_periods p ON p.patronage_period_id = a.patronage_period_id
      WHERE a.patronage_allocation_id = ? AND a.member_id = ? LIMIT 1 FOR UPDATE`, [id, memberId],
  );
  if (!rows[0]) throw new AppError("Patronage refund was not found.", 404, "PATRONAGE_REFUND_NOT_FOUND");
  return rows[0];
}

async function capacity(connection: Database, memberId: string, lock = false) {
  const [accounts] = await connection.execute<RowDataPacket[]>(
    `SELECT CAST(share_capital_account_id AS CHAR) AS id, current_balance AS balance
       FROM share_capital_accounts WHERE member_id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`, [memberId],
  );
  if (!accounts[0]) throw new AppError("Please ask the cooperative office to set up your Share Capital ledger.", 409, "SHARE_CAPITAL_ACCOUNT_REQUIRED");
  const [settings] = await connection.execute<RowDataPacket[]>(
    `SELECT setting_value AS value FROM system_settings WHERE setting_key = 'membership.maximum_share_capital' LIMIT 1`,
  );
  const maximum = Number(settings[0]?.value ?? MAX_SHARE_CAPITAL);
  if (!Number.isFinite(maximum) || maximum <= 0) throw new AppError("Share Capital limit is not configured.", 409, "SHARE_CAPITAL_LIMIT_REQUIRED");
  // Use the same lifetime rules as QRPH checkout reuse; expired attempts do not reserve capital.
  const [pending] = await connection.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(pr.amount), 0) AS amount FROM payment_references pr
      WHERE pr.member_id = ? AND pr.payment_purpose = 'Share Capital'
        AND pr.related_entity_type = 'member_profile' AND pr.payment_channel = 'PayMongo'
        AND pr.validation_status IN ('Pending', 'Needs Clarification')
        AND (
          EXISTS (SELECT 1 FROM payment_gateway_checkout_attempts a
            WHERE a.payment_reference_id = pr.payment_reference_id
              AND a.payment_gateway_checkout_attempt_id = (SELECT MAX(latest.payment_gateway_checkout_attempt_id)
                FROM payment_gateway_checkout_attempts latest WHERE latest.payment_reference_id = pr.payment_reference_id)
              AND a.checkout_url IS NOT NULL AND a.reusable_until > UTC_TIMESTAMP()
              AND a.superseded_at IS NULL AND a.completed_at IS NULL
              AND LOWER(COALESCE(a.gateway_status, 'active')) NOT IN ('expired', 'paid', 'cancelled', 'canceled'))
          OR (NOT EXISTS (SELECT 1 FROM payment_gateway_checkout_attempts a WHERE a.payment_reference_id = pr.payment_reference_id)
            AND pr.submitted_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE))
        )`, [memberId, env.PAYMONGO_CHECKOUT_REUSE_MINUTES],
  );
  return { accountId: String(accounts[0].id), currentCapital: Number(accounts[0].balance),
    availableCapacity: Math.max(0, moneyCents(maximum) - moneyCents(accounts[0].balance) - moneyCents(pending[0]?.amount ?? 0)) / 100 };
}

async function audit(connection: Database, action: string, id: string, auth: AuthContext, values: unknown) {
  await connection.execute(
    `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values)
     VALUES (?, ?, 'patronage_capital_transfers', ?, 'Patronage refund Share Capital transfer.', ?)`,
    [auth.user.id, action, id, JSON.stringify(values)],
  );
}

export interface PatronageCapitalRepository {
  overview(auth: AuthContext): Promise<PatronageCapitalOverview>;
  list(): Promise<PatronageCapitalTransfer[]>;
  request(input: PatronageCapitalRequest, auth: AuthContext): Promise<PatronageCapitalTransfer>;
  decide(id: string, input: PatronageCapitalDecision, auth: AuthContext): Promise<PatronageCapitalTransfer>;
}

export function createPatronageCapitalRepository(pool?: Pool): PatronageCapitalRepository {
  const database = () => pool ?? getPool();
  return {
    async overview(auth) {
      const memberId = await memberByUser(database(), auth.user.id);
      const capital = await capacity(database(), memberId);
      const [refunds] = await database().execute<Array<AllocationRow & { capitalizedAmount: number; pendingCapitalAmount: number }>>(
        `SELECT CAST(a.patronage_allocation_id AS CHAR) AS id, p.period_name AS periodName,
                a.refund_amount AS refundAmount, a.payment_status AS paymentStatus, ${patronageCapitalColumns}
           FROM patronage_allocations a JOIN patronage_periods p ON p.patronage_period_id = a.patronage_period_id
          WHERE a.member_id = ? AND p.period_status = 'Finalized' AND a.payment_status = 'Pending'
          ORDER BY p.period_end, a.patronage_allocation_id`, [memberId],
      );
      const [transfers] = await database().execute<TransferRow[]>(`${transferSelect} WHERE t.member_id = ? ORDER BY t.transfer_id DESC`, [memberId]);
      return { currentCapital: capital.currentCapital, availableCapacity: capital.availableCapacity,
        refunds: refunds.map((row) => ({ allocationId: row.id, periodName: row.periodName, availableAmount: availablePatronageRefund(row) })).filter((row) => row.availableAmount > 0),
        transfers: transfers.map(mapTransfer) };
    },
    async list() {
      const [rows] = await database().execute<TransferRow[]>(`${transferSelect} ORDER BY t.transfer_status = 'Pending' DESC, t.transfer_id DESC`);
      return rows.map(mapTransfer);
    },
    async request(input, auth) {
      return withTransaction(async (connection) => {
        // All contribution paths serialize on the member before touching their account.
        const memberId = await memberByUser(connection, auth.user.id, true);
        const refund = await allocation(connection, input.allocationId, memberId);
        const [existing] = await connection.execute<TransferRow[]>(`${transferSelect} WHERE t.request_key = ? LIMIT 1`, [input.requestKey]);
        if (existing[0]) {
          if (existing[0].memberId !== memberId || existing[0].allocationId !== input.allocationId || moneyCents(existing[0].amount) !== moneyCents(input.amount)) {
            throw new AppError("This request key has already been used for a different transfer.", 409, "PATRONAGE_REQUEST_CONFLICT");
          }
          return mapTransfer(existing[0]);
        }
        if (refund.periodStatus !== "Finalized") throw new AppError("Only a finalized, unpaid refund can be used.", 409, "PATRONAGE_REFUND_UNAVAILABLE");
        const totals = await patronageCapitalTotals(connection, input.allocationId);
        const capital = await capacity(connection, memberId, true);
        assertPatronageCapitalAmount(input.amount, availablePatronageRefund({ ...refund, ...totals }), capital.availableCapacity);
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO patronage_capital_transfers (patronage_allocation_id, member_id, amount, request_key, requested_by)
           VALUES (?, ?, ?, ?, ?)`, [input.allocationId, memberId, input.amount, input.requestKey, auth.user.id],
        );
        const id = String(result.insertId);
        await audit(connection, "patronage.capital_requested", id, auth, input);
        const [rows] = await connection.execute<TransferRow[]>(`${transferSelect} WHERE t.transfer_id = ?`, [id]);
        return mapTransfer(rows[0]);
      }, database());
    },
    async decide(id, input, auth) {
      // Find identity first; then use the same member -> allocation -> account lock order.
      const [found] = await database().execute<TransferRow[]>(`${transferSelect} WHERE t.transfer_id = ?`, [id]);
      if (!found[0]) throw new AppError("Transfer request was not found.", 404, "PATRONAGE_TRANSFER_NOT_FOUND");
      return withTransaction(async (connection) => {
        const [members] = await connection.execute<RowDataPacket[]>(
          `SELECT approval_status AS approvalStatus, official_member_status AS memberStatus
             FROM member_profiles WHERE member_id = ? FOR UPDATE`, [found[0].memberId],
        );
        const refund = await allocation(connection, found[0].allocationId, found[0].memberId);
        const [rows] = await connection.execute<TransferRow[]>(`${transferSelect} WHERE t.transfer_id = ? FOR UPDATE`, [id]);
        const transfer = rows[0];
        const nextStatus = input.decision === "Approve" ? "Approved" : "Rejected";
        if (transfer.status === nextStatus) return mapTransfer(transfer);
        if (transfer.status !== "Pending") throw new AppError("This request has already been reviewed.", 409, "PATRONAGE_TRANSFER_PROCESSED");
        let transactionId: string | null = null;
        if (input.decision === "Approve") {
          if (members[0]?.approvalStatus !== "Approved" || members[0]?.memberStatus !== "Active") throw new AppError("The member is no longer active.", 409, "MEMBER_PATRONAGE_NOT_ELIGIBLE");
          if (refund.periodStatus !== "Finalized" || refund.paymentStatus === "Paid") throw new AppError("The refund is no longer available.", 409, "PATRONAGE_REFUND_UNAVAILABLE");
          const totals = await patronageCapitalTotals(connection, refund.id);
          const capital = await capacity(connection, transfer.memberId, true);
          assertPatronageCapitalAmount(Number(transfer.amount), availablePatronageRefund({ ...refund, ...totals, pendingCapitalAmount: (moneyCents(totals.pendingCapitalAmount) - moneyCents(transfer.amount)) / 100 }), capital.availableCapacity);
          const balanceAfter = (moneyCents(capital.currentCapital) + moneyCents(transfer.amount)) / 100;
          const [posted] = await connection.execute<ResultSetHeader>(
            `INSERT INTO share_capital_transactions
              (share_capital_account_id, member_id, transaction_date, transaction_type, direction, amount,
               balance_before, balance_after, reference_number, source_type, source_id, transaction_status, remarks, created_by)
             VALUES (?, ?, UTC_DATE(), 'Additional Capital Contribution', 'Credit', ?, ?, ?, ?, 'patronage_capital_transfer', ?, 'Posted', ?, ?)`,
            [capital.accountId, transfer.memberId, transfer.amount, capital.currentCapital, balanceAfter, `PAT-CAP-${id}`, id,
              `Patronage refund from ${transfer.periodName} added to Share Capital.`, auth.user.id],
          );
          transactionId = String(posted.insertId);
          await connection.execute(
            `UPDATE share_capital_accounts SET current_balance = ?, total_additional_contributions = total_additional_contributions + ?
              WHERE share_capital_account_id = ?`, [balanceAfter, transfer.amount, capital.accountId],
          );
          if (moneyCents(totals.capitalizedAmount) + moneyCents(transfer.amount) === moneyCents(refund.refundAmount)) {
            await connection.execute(`UPDATE patronage_allocations SET payment_status = 'Paid', paid_at = UTC_TIMESTAMP(), paid_by = ?, payment_notes = 'Refund added to Share Capital.' WHERE patronage_allocation_id = ?`, [auth.user.id, refund.id]);
            await connection.execute(`UPDATE patronage_periods p SET period_status = 'Paid', paid_at = UTC_TIMESTAMP()
              WHERE p.patronage_period_id = ? AND NOT EXISTS (SELECT 1 FROM patronage_allocations a WHERE a.patronage_period_id = p.patronage_period_id AND a.payment_status = 'Pending')`, [refund.periodId]);
          }
        }
        await connection.execute(
          `UPDATE patronage_capital_transfers SET transfer_status = ?, processed_by = ?, processed_at = UTC_TIMESTAMP(),
            processing_notes = ?, share_capital_transaction_id = ? WHERE transfer_id = ? AND transfer_status = 'Pending'`,
          [nextStatus, auth.user.id, input.notes?.trim() || null, transactionId, id],
        );
        await audit(connection, `patronage.capital_${nextStatus.toLowerCase()}`, id, auth, { ...input, amount: transfer.amount, transactionId });
        const [updated] = await connection.execute<TransferRow[]>(`${transferSelect} WHERE t.transfer_id = ?`, [id]);
        return mapTransfer(updated[0]);
      }, database());
    },
  };
}
