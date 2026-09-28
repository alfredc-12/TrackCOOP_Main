import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import {
  settlementRecordDate,
  settlementMoney,
} from "./paymongo.settlement.queries";
import type {
  GatewaySettlementDetails,
  PaymentReferenceForSettlement,
} from "./paymongo.settlement.types";

type RentalBookingRow = RowDataPacket & {
  id: string;
  bookingNumber: string;
  memberId: string | null;
  memberUserId: string | null;
  requesterName: string | null;
  bookingStatus: string;
  paymentStatus: string;
  purpose: string | null;
  totalAmount: string | number;
};

type FinancialCategoryRow = RowDataPacket & { id: string };

async function selectRentalBookingForSettlement(
  connection: PoolConnection,
  bookingId: string,
) {
  const [rows] = await connection.execute<RentalBookingRow[]>(
    `SELECT CAST(rb.rental_booking_id AS CHAR) AS id,
            rb.booking_number AS bookingNumber,
            CAST(rb.member_id AS CHAR) AS memberId,
            CAST(mp.user_id AS CHAR) AS memberUserId,
            rb.requester_name AS requesterName,
            rb.booking_status AS bookingStatus,
            rb.payment_status AS paymentStatus,
            rb.purpose,
            rb.total_amount AS totalAmount
       FROM rental_bookings rb
       LEFT JOIN member_profiles mp ON mp.member_id = rb.member_id
      WHERE rb.rental_booking_id = ?
      LIMIT 1 FOR UPDATE`,
    [bookingId],
  );
  return rows[0] ?? null;
}

async function selectRentalIncomeCategory(connection: PoolConnection) {
  const [rows] = await connection.execute<FinancialCategoryRow[]>(
    `SELECT CAST(financial_category_id AS CHAR) AS id
       FROM financial_categories
      WHERE category_code = 'RENTAL_INCOME'
        AND is_active = 1
      LIMIT 1`,
  );
  if (!rows[0]) {
    throw new AppError(
      "A Rental Income financial category is required before settlement",
      409,
      "RENTAL_SETTLEMENT_CATEGORY_REQUIRED",
    );
  }
  return rows[0].id;
}

function parsePurpose(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export type RentalPostingResult = {
  financeCreated: boolean;
  memberId: string | null;
  memberUserId: string | null;
  subjectReference: string;
  subjectName: string;
};

export async function postRentalSettlement(input: {
  connection: PoolConnection;
  payment: PaymentReferenceForSettlement;
  actorUserId: string;
  gatewayDetails?: GatewaySettlementDetails | null;
}): Promise<RentalPostingResult> {
  if (
    input.payment.paymentPurpose !== "Rental"
    || input.payment.relatedEntityType !== "rental_bookings"
    || !input.payment.relatedEntityId
  ) {
    throw new AppError(
      "Rental settlement requires a linked rental booking",
      422,
      "RENTAL_SETTLEMENT_ENTITY_INVALID",
    );
  }

  const booking = await selectRentalBookingForSettlement(
    input.connection,
    input.payment.relatedEntityId,
  );
  if (!booking) {
    throw new AppError("Rental booking was not found", 404, "RENTAL_BOOKING_NOT_FOUND");
  }
  if (
    input.payment.memberId
    && booking.memberId
    && input.payment.memberId !== booking.memberId
  ) {
    throw new AppError(
      "The rental payment is linked to another member",
      409,
      "RENTAL_PAYMENT_MEMBER_CONFLICT",
    );
  }
  if (settlementMoney(Number(booking.totalAmount)) !== settlementMoney(Number(input.payment.amount))) {
    throw new AppError(
      "Rental payment amount does not match the approved rental total",
      422,
      "RENTAL_PAYMENT_AMOUNT_MISMATCH",
    );
  }

  const purpose = parsePurpose(booking.purpose);
  purpose.statusOverride = "Approved for Scheduling";
  purpose.scheduleStatus = "Proposed";
  purpose.paymentStatusOverride = "Paid";
  purpose.publicNote = "Payment confirmed. Your rental is approved for scheduling.";

  await input.connection.execute(
    `UPDATE rental_bookings
        SET booking_status = 'Approved',
            payment_status = 'Paid',
            purpose = ?,
            updated_at = UTC_TIMESTAMP()
      WHERE rental_booking_id = ?`,
    [JSON.stringify(purpose), booking.id],
  );

  if (booking.memberId) {
    await input.connection.execute(
      `UPDATE payment_references
          SET member_id = ?, updated_at = UTC_TIMESTAMP()
        WHERE payment_reference_id = ?
          AND (member_id IS NULL OR member_id = ?)`,
      [booking.memberId, input.payment.id, booking.memberId],
    );
  }

  const categoryId = await selectRentalIncomeCategory(input.connection);
  const [financeResult] = await input.connection.execute<ResultSetHeader>(
    `INSERT INTO financial_records
       (record_number, payment_reference_id, member_id, financial_category_id,
        recorded_by, approved_by, record_type, source_module, source_record_id,
        amount, record_date, record_status, remarks)
     SELECT ?, ?, ?, ?, ?, ?, 'Income', 'Rental', ?, ?, ?, 'Active', ?
      WHERE NOT EXISTS (
        SELECT 1 FROM financial_records WHERE payment_reference_id = ?
      )`,
    [
      `PAY-FIN-RNT-${input.payment.id}`,
      input.payment.id,
      booking.memberId,
      categoryId,
      input.actorUserId,
      input.actorUserId,
      booking.id,
      input.payment.amount,
      settlementRecordDate(input.gatewayDetails?.paidAt),
      `QRPH settlement for rental booking ${booking.bookingNumber}`,
      input.payment.id,
    ],
  );

  return {
    financeCreated: financeResult.affectedRows > 0,
    memberId: booking.memberId,
    memberUserId: booking.memberUserId,
    subjectReference: booking.bookingNumber,
    subjectName: booking.requesterName ?? "Rental booking",
  };
}
