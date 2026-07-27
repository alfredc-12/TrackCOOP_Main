import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import {
  ensureMemberShareCapitalReceipt,
  type MemberShareCapitalReceiptResult,
} from "./paymongo.settlement.receipt";
import {
  membershipNumberSetting,
  settlementMoney,
  settlementRecordDate,
} from "./paymongo.settlement.queries";
import type {
  GatewaySettlementDetails,
  PaymentReferenceForSettlement,
} from "./paymongo.settlement.types";

type MemberRow = RowDataPacket & {
  id: string;
  userId: string | null;
  memberCode: string;
  fullName: string;
  membershipType: "Associate" | "True Member";
  approvalStatus: string;
  officialMemberStatus: string;
};
type AmountRow = RowDataPacket & { total: string | number | null };
type IdRow = RowDataPacket & { id: string };

async function selectMemberForSettlement(
  connection: PoolConnection,
  memberId: string,
) {
  const [rows] = await connection.execute<MemberRow[]>(
    `SELECT CAST(member_id AS CHAR) AS id,
            CAST(user_id AS CHAR) AS userId,
            member_code AS memberCode,
            full_name AS fullName,
            membership_type AS membershipType,
            approval_status AS approvalStatus,
            official_member_status AS officialMemberStatus
       FROM member_profiles
      WHERE member_id = ?
      LIMIT 1 FOR UPDATE`,
    [memberId],
  );
  return rows[0] ?? null;
}

async function selectShareCapitalCategory(connection: PoolConnection) {
  const codes = ["SHARE_CAPITAL", "MEMBERSHIP_FEE", "OTHER_INCOME"];
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
      "A Share Capital financial category is required before settlement",
      409,
      "PAYMENT_SETTLEMENT_CATEGORY_REQUIRED",
    );
  }
  return rows[0].id;
}

export type MemberShareCapitalPostingResult = {
  shareCapitalCreated: boolean;
  financeCreated: boolean;
  receipt: MemberShareCapitalReceiptResult;
  notificationCreated: boolean;
  auditCreated: boolean;
};

export async function postMemberShareCapitalSettlement(input: {
  connection: PoolConnection;
  payment: PaymentReferenceForSettlement;
  actorUserId: string;
  gatewayDetails?: GatewaySettlementDetails | null;
}, dependencies: {
  ensureReceipt?: typeof ensureMemberShareCapitalReceipt;
} = {}): Promise<MemberShareCapitalPostingResult> {
  if (
    input.payment.paymentPurpose !== "Share Capital"
    || input.payment.relatedEntityType !== "member_profile"
    || !input.payment.relatedEntityId
  ) {
    throw new AppError(
      "Member Share Capital settlement requires a linked member profile",
      422,
      "MEMBER_SHARE_CAPITAL_SETTLEMENT_ENTITY_INVALID",
    );
  }
  if (
    input.payment.memberId
    && input.payment.memberId !== input.payment.relatedEntityId
  ) {
    throw new AppError(
      "The Share Capital payment is linked to another member",
      409,
      "MEMBERSHIP_PAYMENT_MEMBER_CONFLICT",
    );
  }

  const member = await selectMemberForSettlement(
    input.connection,
    input.payment.relatedEntityId,
  );
  if (!member) {
    throw new AppError("Member profile was not found", 404, "MEMBER_PROFILE_NOT_FOUND");
  }
  if (member.approvalStatus !== "Approved" || member.officialMemberStatus !== "Active") {
    throw new AppError(
      "The member is not eligible for Share Capital settlement",
      409,
      "MEMBER_SHARE_CAPITAL_MEMBER_INELIGIBLE",
    );
  }
  if (!Number.isFinite(Number(input.payment.amount)) || Number(input.payment.amount) <= 0) {
    throw new AppError(
      "Share Capital payment amount is invalid",
      422,
      "MEMBER_SHARE_CAPITAL_AMOUNT_INVALID",
    );
  }

  const maximum = await membershipNumberSetting(
    input.connection,
    "membership.maximum_share_capital",
    15000,
  );
  const [capitalRows] = await input.connection.execute<AmountRow[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM share_capital_payments
      WHERE member_id = ?
        AND payment_status = 'Validated'
        AND (payment_reference_id IS NULL OR payment_reference_id <> ?)`,
    [member.id, input.payment.id],
  );
  const existingCapital = settlementMoney(Number(capitalRows[0]?.total ?? 0));
  if (
    settlementMoney(existingCapital + Number(input.payment.amount))
    > settlementMoney(maximum)
  ) {
    throw new AppError(
      "Share Capital payment would exceed the maximum allowed amount",
      409,
      "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
    );
  }

  const [shareResult] = await input.connection.execute<ResultSetHeader>(
    `INSERT INTO share_capital_payments
       (member_id, payment_reference_id, amount, payment_date, payment_status,
        verified_by, verified_at, remarks)
     SELECT ?, ?, ?, ?, 'Validated', ?, UTC_TIMESTAMP(), ?
      WHERE NOT EXISTS (
        SELECT 1 FROM share_capital_payments WHERE payment_reference_id = ?
      )`,
    [
      member.id,
      input.payment.id,
      input.payment.amount,
      settlementRecordDate(input.gatewayDetails?.paidAt),
      input.actorUserId,
      `Authenticated Member PayMongo Share Capital settlement for ${input.payment.referenceNumber}`,
      input.payment.id,
    ],
  );

  const categoryId = await selectShareCapitalCategory(input.connection);
  const [financeResult] = await input.connection.execute<ResultSetHeader>(
    `INSERT IGNORE INTO financial_records
       (record_number, payment_reference_id, member_id, financial_category_id,
        recorded_by, approved_by, record_type, source_module, source_record_id,
        amount, record_date, remarks)
     VALUES (?, ?, ?, ?, ?, ?, 'Income', 'Share Capital', ?, ?, ?, ?)`,
    [
      `PAY-FIN-${input.payment.id}`,
      input.payment.id,
      member.id,
      categoryId,
      input.actorUserId,
      input.actorUserId,
      input.payment.id,
      input.payment.amount,
      settlementRecordDate(input.gatewayDetails?.paidAt),
      `Member Share Capital settlement for ${member.memberCode}`,
    ],
  );

  const receipt = await (dependencies.ensureReceipt ?? ensureMemberShareCapitalReceipt)({
    connection: input.connection,
    payment: input.payment,
    memberId: member.id,
    memberCode: member.memberCode,
    memberName: member.fullName,
    actorUserId: input.actorUserId,
    gatewayDetails: input.gatewayDetails,
  });

  let notificationCreated = false;
  let auditCreated = false;
  if (shareResult.affectedRows > 0) {
    if (member.userId) {
      await input.connection.execute(
        `INSERT INTO notifications
           (user_id, notification_type, title, message,
            related_entity_type, related_entity_id)
         VALUES (?, 'Share Capital', ?, ?, 'payment_reference', ?)`,
        [
          member.userId,
          "Share Capital payment confirmed",
          `${input.payment.referenceNumber} for PHP ${Number(input.payment.amount).toFixed(2)} was confirmed. Receipt ${receipt.receiptNumber} is available in your records.`,
          input.payment.id,
        ],
      );
      notificationCreated = true;
    }
    await input.connection.execute(
      `INSERT INTO audit_logs
         (user_id, action, entity_table, record_id, description, new_values)
       VALUES (?, 'member.share_capital_paymongo_settled',
               'share_capital_payments', ?, ?, ?)`,
      [
        input.actorUserId,
        input.payment.id,
        "A Member PayMongo Share Capital contribution was posted without automatic membership promotion.",
        JSON.stringify({
          memberId: member.id,
          memberCode: member.memberCode,
          paymentReferenceId: input.payment.id,
          amount: Number(input.payment.amount),
          receiptNumber: receipt.receiptNumber,
          membershipTypeUnchanged: member.membershipType,
        }),
      ],
    );
    auditCreated = true;
  }

  return {
    shareCapitalCreated: shareResult.affectedRows > 0,
    financeCreated: financeResult.affectedRows > 0,
    receipt,
    notificationCreated,
    auditCreated,
  };
}
