import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import {
  settlementMoney,
  settlementRecordDate,
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
  assetName: string;
  paymentStatus: string;
  purpose: string | null;
};

type CategoryRow = RowDataPacket & { id: string };

function bookingMetadata(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

async function rentalIncomeCategory(connection: PoolConnection) {
  const codes = ["RENTAL_INCOME", "OTHER_INCOME"];
  const [rows] = await connection.execute<CategoryRow[]>(
    `SELECT CAST(financial_category_id AS CHAR) AS id
       FROM financial_categories
      WHERE category_code IN (?, ?) AND is_active = 1
      ORDER BY FIELD(category_code, ?, ?)
      LIMIT 1`,
    [...codes, ...codes],
  );
  if (!rows[0]) {
    throw new AppError(
      "A rental income category is required before payment approval",
      409,
      "RENTAL_SETTLEMENT_CATEGORY_REQUIRED",
    );
  }
  return rows[0].id;
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
      "Rental payment must be linked to a rental booking",
      422,
      "RENTAL_SETTLEMENT_ENTITY_INVALID",
    );
  }

  const [rows] = await input.connection.execute<RentalBookingRow[]>(
    `SELECT CAST(rb.rental_booking_id AS CHAR) AS id,
            rb.booking_number AS bookingNumber,
            CAST(rb.member_id AS CHAR) AS memberId,
            CAST(mp.user_id AS CHAR) AS memberUserId,
            rb.requester_name AS requesterName,
            ra.asset_name AS assetName,
            rb.payment_status AS paymentStatus,
            rb.purpose
       FROM rental_bookings rb
       JOIN rental_assets ra ON ra.rental_asset_id = rb.rental_asset_id
       LEFT JOIN member_profiles mp ON mp.member_id = rb.member_id
      WHERE rb.rental_booking_id = ?
      LIMIT 1 FOR UPDATE`,
    [input.payment.relatedEntityId],
  );
  const booking = rows[0];
  if (!booking) {
    throw new AppError("Rental booking was not found", 404, "RENTAL_BOOKING_NOT_FOUND");
  }
  if (input.payment.memberId && booking.memberId && input.payment.memberId !== booking.memberId) {
    throw new AppError(
      "The rental payment is linked to another member",
      409,
      "RENTAL_PAYMENT_MEMBER_CONFLICT",
    );
  }

  const metadata = bookingMetadata(booking.purpose);
  const estimate = metadata.estimatedFee;
  const expectedAmount = estimate && typeof estimate === "object" && !Array.isArray(estimate)
    ? Number((estimate as Record<string, unknown>).total)
    : 0;
  if (
    Number.isFinite(expectedAmount)
    && expectedAmount > 0
    && settlementMoney(expectedAmount) !== settlementMoney(Number(input.payment.amount))
  ) {
    throw new AppError(
      "Rental payment amount does not match the approved rental fee",
      422,
      "RENTAL_PAYMENT_AMOUNT_MISMATCH",
    );
  }

  metadata.statusOverride = "Payment Confirmed";
  metadata.paymentStatusOverride = "Paid";
  await input.connection.execute(
    `UPDATE rental_bookings
        SET payment_status = 'Paid', purpose = ?, updated_at = UTC_TIMESTAMP()
      WHERE rental_booking_id = ?`,
    [JSON.stringify(metadata), booking.id],
  );

  if (booking.memberId) {
    await input.connection.execute(
      `UPDATE payment_references SET member_id = ?, updated_at = UTC_TIMESTAMP()
        WHERE payment_reference_id = ? AND (member_id IS NULL OR member_id = ?)`,
      [booking.memberId, input.payment.id, booking.memberId],
    );
  }

  const categoryId = await rentalIncomeCategory(input.connection);
  const [financeResult] = await input.connection.execute<ResultSetHeader>(
    `INSERT IGNORE INTO financial_records
       (record_number, payment_reference_id, member_id, financial_category_id,
        recorded_by, approved_by, record_type, source_module, source_record_id,
        amount, record_date, record_status, remarks)
     VALUES (?, ?, ?, ?, ?, ?, 'Income', 'Rental', ?, ?, ?, 'Active', ?)`,
    [
      `FIN-PAY-${input.payment.id}`,
      input.payment.id,
      booking.memberId,
      categoryId,
      input.actorUserId,
      input.actorUserId,
      booking.id,
      input.payment.amount,
      settlementRecordDate(input.gatewayDetails?.paidAt),
      JSON.stringify({
        rentalNumber: booking.bookingNumber,
        equipment: booking.assetName,
        paymentReference: input.payment.referenceNumber,
      }),
    ],
  );

  return {
    financeCreated: financeResult.affectedRows > 0,
    memberId: booking.memberId,
    memberUserId: booking.memberUserId,
    subjectReference: booking.bookingNumber,
    subjectName: booking.requesterName || booking.assetName,
  };
}
