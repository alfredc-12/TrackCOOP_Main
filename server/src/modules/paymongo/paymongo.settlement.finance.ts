import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type {
  GatewaySettlementDetails,
  MembershipApplicationSettlementRow,
  PaymentReferenceForSettlement,
} from "./paymongo.settlement.types";
import { settlementRecordDate } from "./paymongo.settlement.queries";

type IdRow = RowDataPacket & { id: string };

function categoryCodes(paymentPurpose: string) {
  return paymentPurpose === "Share Capital"
    ? ["SHARE_CAPITAL", "MEMBERSHIP_FEE", "OTHER_INCOME"]
    : ["ASSOCIATE_MEMBERSHIP_FEE", "MEMBERSHIP_FEE", "OTHER_INCOME"];
}

async function categoryId(connection: PoolConnection, paymentPurpose: string) {
  const codes = categoryCodes(paymentPurpose);
  const [rows] = await connection.execute<IdRow[]>(
    `SELECT CAST(financial_category_id AS CHAR) AS id
       FROM financial_categories
      WHERE category_code IN (${codes.map(() => "?").join(", ")})
        AND is_active = 1
      ORDER BY FIELD(category_code, ${codes.map(() => "?").join(", ")})
      LIMIT 1`,
    [...codes, ...codes],
  );
  if (!rows[0]) {
    throw new AppError(
      "A financial category is required before settlement",
      409,
      "PAYMENT_SETTLEMENT_CATEGORY_REQUIRED",
    );
  }
  return rows[0].id;
}

export async function insertSettlementFinanceRecord(input: {
  connection: PoolConnection;
  payment: PaymentReferenceForSettlement;
  application: MembershipApplicationSettlementRow;
  actorUserId: string;
  gatewayDetails?: GatewaySettlementDetails | null;
}) {
  const financialCategoryId = await categoryId(
    input.connection,
    input.payment.paymentPurpose,
  );
  const [result] = await input.connection.execute(
    `INSERT IGNORE INTO financial_records
       (record_number, payment_reference_id, member_id, financial_category_id,
        recorded_by, approved_by, record_type, source_module, source_record_id,
        amount, record_date, remarks)
     VALUES (?, ?, ?, ?, ?, ?, 'Income', 'Membership', ?, ?, ?, ?)`,
    [
      `PAY-FIN-${input.payment.id}`,
      input.payment.id,
      input.application.convertedMemberId,
      financialCategoryId,
      input.actorUserId,
      input.actorUserId,
      input.payment.id,
      input.payment.amount,
      settlementRecordDate(input.gatewayDetails?.paidAt),
      `${input.payment.paymentPurpose} settlement for ${input.application.applicationCode}`,
    ],
  );
  return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
}
