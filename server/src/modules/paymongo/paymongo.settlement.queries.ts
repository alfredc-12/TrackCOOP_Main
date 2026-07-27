import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type {
  MembershipApplicationSettlementRow,
  PaymentReferenceForSettlement,
  RequirementSettlementRow,
} from "./paymongo.settlement.types";

type IdRow = RowDataPacket & { id: string };
type AmountRow = RowDataPacket & { total: string | number | null };

export function settlementMoney(value: number) {
  return Math.round(value * 100) / 100;
}
export function settlementDateTime(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 19).replace("T", " ") : null;
}
export function settlementRecordDate(value: Date | null | undefined) {
  return (value ?? new Date()).toISOString().slice(0, 10);
}

export async function selectSettlementActor(
  connection: PoolConnection,
  actorUserId: string | null,
) {
  if (actorUserId) return actorUserId;
  const [rows] = await connection.execute<IdRow[]>(
    `SELECT CAST(u.user_id AS CHAR) AS id
       FROM users u JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug IN ('bookkeeper', 'chairman')
        AND u.account_status = 'Active'
      ORDER BY r.role_slug = 'bookkeeper' DESC, u.user_id ASC LIMIT 1`,
  );
  if (!rows[0]) {
    throw new AppError(
      "A settlement actor account is required before posting finance records",
      409,
      "PAYMENT_SETTLEMENT_ACTOR_REQUIRED",
    );
  }
  return rows[0].id;
}

export async function selectPaymentForSettlement(
  connection: PoolConnection,
  paymentReferenceId: string,
) {
  const [rows] = await connection.execute<PaymentReferenceForSettlement[]>(
    `SELECT CAST(payment_reference_id AS CHAR) AS id,
            CAST(member_id AS CHAR) AS memberId,
            payer_name AS payerName,
            payer_email AS payerEmail,
            payer_contact AS payerContact,
            provider,
            reference_number AS referenceNumber,
            payment_purpose AS paymentPurpose,
            related_entity_type AS relatedEntityType,
            CAST(related_entity_id AS CHAR) AS relatedEntityId,
            amount,
            validation_status AS validationStatus,
            payment_channel AS paymentChannel,
            gateway_environment AS gatewayEnvironment,
            gateway_checkout_id AS gatewayCheckoutId,
            gateway_payment_id AS gatewayPaymentId,
            gateway_payment_intent_id AS gatewayPaymentIntentId,
            paid_at AS paidAt,
            validated_at AS validatedAt
       FROM payment_references
      WHERE payment_reference_id = ? LIMIT 1 FOR UPDATE`,
    [paymentReferenceId],
  );
  return rows[0] ?? null;
}

export async function selectSettlementApplication(
  connection: PoolConnection,
  applicationId: string,
) {
  const [rows] = await connection.execute<MembershipApplicationSettlementRow[]>(
    `SELECT CAST(a.membership_application_id AS CHAR) AS id,
            a.application_code AS applicationCode,
            a.application_status AS applicationStatus,
            a.requested_membership_type AS requestedMembershipType,
            CAST(a.converted_member_id AS CHAR) AS convertedMemberId,
            CAST(m.user_id AS CHAR) AS memberUserId,
            TRIM(CONCAT_WS(' ', a.first_name, NULLIF(a.middle_name, ''),
                           a.last_name, NULLIF(a.suffix, ''))) AS fullName
       FROM membership_applications a
       LEFT JOIN member_profiles m ON m.member_id = a.converted_member_id
      WHERE a.membership_application_id = ? LIMIT 1 FOR UPDATE`,
    [applicationId],
  );
  return rows[0] ?? null;
}

export async function selectSettlementRequirement(
  connection: PoolConnection,
  applicationId: string,
  paymentPurpose: string,
) {
  const type = paymentPurpose === "Share Capital"
    ? "Initial Share Capital"
    : "Associate Membership Fee";
  const [rows] = await connection.execute<RequirementSettlementRow[]>(
    `SELECT CAST(membership_application_requirement_id AS CHAR) AS id,
            requirement_status AS requirementStatus
       FROM membership_application_requirements
      WHERE membership_application_id = ? AND requirement_type = ?
      LIMIT 1 FOR UPDATE`,
    [applicationId, type],
  );
  return rows[0] ?? null;
}

export async function membershipNumberSetting(
  connection: PoolConnection,
  key: string,
  fallback: number,
) {
  const [rows] = await connection.execute<(RowDataPacket & { value: string | null })[]>(
    `SELECT setting_value AS value FROM system_settings
      WHERE setting_key = ? LIMIT 1`,
    [key],
  );
  const value = Number(rows[0]?.value ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function validatedApplicationPaymentTotal(
  connection: PoolConnection,
  applicationId: string,
  paymentPurpose: string,
) {
  const [rows] = await connection.execute<AmountRow[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payment_references
      WHERE related_entity_type = 'membership_application'
        AND related_entity_id = ?
        AND payment_purpose = ?
        AND validation_status = 'Validated'`,
    [applicationId, paymentPurpose],
  );
  return settlementMoney(Number(rows[0]?.total ?? 0));
}

export async function memberCapitalOutsideApplication(
  connection: PoolConnection,
  memberId: string | null,
  applicationId: string,
) {
  if (!memberId) return 0;
  const [rows] = await connection.execute<AmountRow[]>(
    `SELECT COALESCE(SUM(sp.amount), 0) AS total
       FROM share_capital_payments sp
      WHERE sp.member_id = ? AND sp.payment_status = 'Validated'
        AND NOT EXISTS (
          SELECT 1 FROM payment_references pr
           WHERE pr.payment_reference_id = sp.payment_reference_id
             AND pr.related_entity_type = 'membership_application'
             AND pr.related_entity_id = ?
             AND pr.payment_purpose = 'Share Capital'
        )`,
    [memberId, applicationId],
  );
  return settlementMoney(Number(rows[0]?.total ?? 0));
}
