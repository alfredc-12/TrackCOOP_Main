import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { PatronageSourceAmount } from "./patronage.types";
import { calculatePatronageAllocations } from "./patronage-calculator";
import { AppError } from "../../utils/app-error";
import { moneyCents } from "./patronage-capital.rules";

type SourceRow = RowDataPacket & PatronageSourceAmount;

export async function loadPatronageSources(
  connection: Pick<PoolConnection, "execute">,
  startDate: string,
  endDate: string,
  memberId?: string,
): Promise<PatronageSourceAmount[]> {
  const memberFilter = memberId ? " AND m.member_id = ?" : "";
  const params: Array<string> = [startDate, endDate];
  if (memberId) params.push(memberId);
  const [rows] = await connection.execute<SourceRow[]>(
    `SELECT CAST(m.member_id AS CHAR) AS memberId,
            m.member_code AS memberCode, m.full_name AS memberName,
            m.membership_type AS membershipType,
            0 AS purchasePatronage, COALESCE(SUM(b.total_amount), 0) AS rentalPatronage
       FROM member_profiles m
       JOIN rental_bookings b ON b.member_id = m.member_id
       JOIN rental_assets asset ON asset.rental_asset_id = b.rental_asset_id AND asset.asset_type = 'Equipment'
       JOIN payment_references payment ON payment.payment_reference_id = b.payment_reference_id
      WHERE m.approval_status = 'Approved' AND m.official_member_status = 'Active'
        AND m.membership_type = 'True Member' AND m.true_member_since IS NOT NULL
        AND b.start_datetime >= m.true_member_since
        AND b.booking_status = 'Completed' AND b.payment_status = 'Paid' AND b.total_amount > 0
        AND payment.payment_purpose = 'Rental' AND payment.validation_status = 'Validated'
        AND payment.amount >= b.total_amount
        AND LOWER(COALESCE(payment.gateway_status, '')) NOT IN ('refunded', 'partially_refunded', 'reversed')
        AND COALESCE(payment.validated_at, payment.paid_at) IS NOT NULL
        AND GREATEST(COALESCE(b.completed_at, b.end_datetime), COALESCE(payment.validated_at, payment.paid_at)) >= ?
        AND GREATEST(COALESCE(b.completed_at, b.end_datetime), COALESCE(payment.validated_at, payment.paid_at)) < DATE_ADD(?, INTERVAL 1 DAY)
        ${memberFilter}
      GROUP BY m.member_id ORDER BY m.full_name ASC`, params,
  );

  return rows.map((row) => ({
    ...row,
    purchasePatronage: Number(row.purchasePatronage ?? 0),
    rentalPatronage: Number(row.rentalPatronage ?? 0),
  }));
}

export async function assertRefundSourcesUnchanged(connection: Pick<PoolConnection, "execute">, allocationId: string) {
  const [rows] = await connection.execute<Array<RowDataPacket & { memberId: string; startDate: string; endDate: string; rentalPatronage: string | number; refundAmount: string | number }>>(
    `SELECT CAST(a.member_id AS CHAR) AS memberId,
            DATE_FORMAT(p.period_start, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(p.period_end, '%Y-%m-%d') AS endDate,
            a.rental_patronage AS rentalPatronage, a.refund_amount AS refundAmount
       FROM patronage_allocations a JOIN patronage_periods p ON p.patronage_period_id = a.patronage_period_id
      WHERE a.patronage_allocation_id = ? FOR UPDATE`, [allocationId],
  );
  const saved = rows[0];
  const current = saved ? calculatePatronageAllocations(await loadPatronageSources(connection, saved.startDate, saved.endDate, saved.memberId))[0] : undefined;
  if (!saved || !current || moneyCents(current.rentalPatronage) !== moneyCents(saved.rentalPatronage) || moneyCents(current.refundAmount) !== moneyCents(saved.refundAmount)) {
    throw new AppError("Rental payments or membership eligibility changed after calculation. Ask the cooperative to review this refund before payout or transfer.", 409, "PATRONAGE_SOURCE_REVIEW_REQUIRED");
  }
}
