import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type {
  PaymongoMembershipApplicationRecord,
  PaymongoMembershipCheckoutPurpose,
  PaymongoOnlineGatewayEnvironment,
  PaymongoPaymentChannel,
  PaymongoPaymentReferenceRecord,
} from "./paymongo.types";
import { roundMoney, type MembershipRequirementStatus } from "./paymongo.membership-installment.rules";

const terminalApplicationStatuses = new Set(["Approved", "Rejected", "Withdrawn"]);

export type PaymentReferenceRow = RowDataPacket & {
  id: string;
  memberId: string | null;
  memberUserId: string | null;
  submittedBy: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerContact: string | null;
  provider: string;
  referenceNumber: string;
  paymentPurpose: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  amount: string | number;
  validationStatus: PaymongoPaymentReferenceRecord["validationStatus"];
  paymentChannel: PaymongoPaymentChannel;
  gatewayEnvironment: PaymongoPaymentReferenceRecord["gatewayEnvironment"];
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
  gatewayStatus: string | null;
  idempotencyKey: string | null;
  paidAt: Date | null;
};

export type ApplicationLockRow = RowDataPacket & {
  id: string;
  requestedMembershipType: PaymongoMembershipApplicationRecord["requestedMembershipType"];
  applicationStatus: string;
};

export type RequirementRow = RowDataPacket & {
  id: string;
  requirementType: "Associate Membership Fee" | "Initial Share Capital";
  requirementStatus: MembershipRequirementStatus;
  paymentReferenceId: string | null;
};

type AggregateRow = RowDataPacket & {
  validatedAmount: string | number | null;
  pendingAmount: string | number | null;
  installmentCount: string | number | null;
};

function mapPaymentReference(row: PaymentReferenceRow): PaymongoPaymentReferenceRecord {
  return { ...row, amount: Number(row.amount) };
}

export async function selectPaymentReference(
  connection: Pool | PoolConnection,
  paymentReferenceId: string,
) {
  const [rows] = await connection.execute<PaymentReferenceRow[]>(
    `SELECT CAST(p.payment_reference_id AS CHAR) AS id,
            CAST(p.member_id AS CHAR) AS memberId,
            CAST(m.user_id AS CHAR) AS memberUserId,
            CAST(p.submitted_by AS CHAR) AS submittedBy,
            p.payer_name AS payerName,
            p.payer_email AS payerEmail,
            p.payer_contact AS payerContact,
            p.provider,
            p.reference_number AS referenceNumber,
            p.payment_purpose AS paymentPurpose,
            p.related_entity_type AS relatedEntityType,
            CAST(p.related_entity_id AS CHAR) AS relatedEntityId,
            p.amount,
            p.validation_status AS validationStatus,
            p.payment_channel AS paymentChannel,
            p.gateway_environment AS gatewayEnvironment,
            p.gateway_checkout_id AS gatewayCheckoutId,
            p.gateway_payment_id AS gatewayPaymentId,
            p.gateway_payment_intent_id AS gatewayPaymentIntentId,
            p.gateway_status AS gatewayStatus,
            p.idempotency_key AS idempotencyKey,
            p.paid_at AS paidAt
       FROM payment_references p
       LEFT JOIN member_profiles m ON m.member_id = p.member_id
      WHERE p.payment_reference_id = ?
      LIMIT 1`,
    [paymentReferenceId],
  );
  return rows[0] ? mapPaymentReference(rows[0]) : null;
}

export async function lockApplication(
  connection: PoolConnection,
  applicationId: string,
) {
  const [rows] = await connection.execute<ApplicationLockRow[]>(
    `SELECT CAST(membership_application_id AS CHAR) AS id,
            requested_membership_type AS requestedMembershipType,
            application_status AS applicationStatus
       FROM membership_applications
      WHERE membership_application_id = ?
      LIMIT 1
      FOR UPDATE`,
    [applicationId],
  );
  const row = rows[0];
  if (!row) {
    throw new AppError(
      "Membership application was not found",
      404,
      "MEMBERSHIP_APPLICATION_NOT_FOUND",
    );
  }
  if (terminalApplicationStatuses.has(row.applicationStatus)) {
    throw new AppError(
      "This membership application is not eligible for online payment",
      409,
      "MEMBERSHIP_APPLICATION_PAYMENT_NOT_ELIGIBLE",
    );
  }
  return row;
}

export async function selectRequirement(
  connection: PoolConnection,
  applicationId: string,
  purpose: PaymongoMembershipCheckoutPurpose,
) {
  const requirementType = purpose === "Share Capital"
    ? "Initial Share Capital"
    : "Associate Membership Fee";
  const [rows] = await connection.execute<RequirementRow[]>(
    `SELECT CAST(membership_application_requirement_id AS CHAR) AS id,
            requirement_type AS requirementType,
            requirement_status AS requirementStatus,
            CAST(payment_reference_id AS CHAR) AS paymentReferenceId
       FROM membership_application_requirements
      WHERE membership_application_id = ?
        AND requirement_type = ?
      LIMIT 1
      FOR UPDATE`,
    [applicationId, requirementType],
  );
  if (!rows[0]) {
    throw new AppError(
      "The required membership payment step was not found",
      409,
      "MEMBERSHIP_PAYMENT_REQUIREMENT_NOT_FOUND",
    );
  }
  return rows[0];
}

function activeAttemptExistsSql(referenceAlias: string, environmentFilter = false) {
  return `EXISTS (
    SELECT 1
      FROM payment_gateway_checkout_attempts a
     WHERE a.payment_reference_id = ${referenceAlias}.payment_reference_id
       AND a.gateway_name = 'PayMongo'
       ${environmentFilter ? "AND a.gateway_environment = ?" : ""}
       AND a.checkout_url IS NOT NULL
       AND a.reusable_until > UTC_TIMESTAMP()
       AND a.superseded_at IS NULL
       AND a.completed_at IS NULL
       AND LOWER(COALESCE(a.gateway_status, 'active')) NOT IN ('expired', 'paid', 'cancelled', 'canceled')
  )`;
}

export async function paymentAggregate(
  connection: Pool | PoolConnection,
  input: {
    applicationId: string;
    purpose: PaymongoMembershipCheckoutPurpose;
    environment?: PaymongoOnlineGatewayEnvironment;
    excludePaymentReferenceId?: string;
  },
) {
  const values: Array<string> = [input.applicationId, input.purpose];
  const environmentFilter = Boolean(input.environment);
  if (input.environment) values.push(input.environment);
  const exclusionSql = input.excludePaymentReferenceId
    ? "AND pr.payment_reference_id <> ?"
    : "";
  if (input.excludePaymentReferenceId) values.push(input.excludePaymentReferenceId);

  const activeSql = activeAttemptExistsSql("pr", environmentFilter);
  const [rows] = await connection.execute<AggregateRow[]>(
    `SELECT COALESCE(SUM(CASE
              WHEN pr.validation_status = 'Validated' THEN pr.amount ELSE 0 END), 0)
              AS validatedAmount,
            COALESCE(SUM(CASE
              WHEN pr.validation_status IN ('Pending', 'Needs Clarification')
               AND ${activeSql}
              THEN pr.amount ELSE 0 END), 0) AS pendingAmount,
            COUNT(DISTINCT CASE
              WHEN pr.validation_status = 'Validated'
                OR (pr.validation_status IN ('Pending', 'Needs Clarification') AND ${activeSql})
              THEN pr.payment_reference_id ELSE NULL END) AS installmentCount
       FROM payment_references pr
      WHERE pr.related_entity_type = 'membership_application'
        AND pr.related_entity_id = ?
        AND pr.payment_purpose = ?
        ${exclusionSql}`,
    environmentFilter
      ? [input.environment!, input.environment!, input.applicationId, input.purpose, ...(input.excludePaymentReferenceId ? [input.excludePaymentReferenceId] : [])]
      : values,
  );

  return {
    validatedAmount: Number(rows[0]?.validatedAmount ?? 0),
    pendingAmount: Number(rows[0]?.pendingAmount ?? 0),
    installmentCount: Number(rows[0]?.installmentCount ?? 0),
  };
}

export async function latestPendingReference(
  connection: PoolConnection,
  applicationId: string,
  purpose: PaymongoMembershipCheckoutPurpose,
) {
  const [rows] = await connection.execute<PaymentReferenceRow[]>(
    `SELECT CAST(p.payment_reference_id AS CHAR) AS id,
            CAST(p.member_id AS CHAR) AS memberId,
            CAST(m.user_id AS CHAR) AS memberUserId,
            CAST(p.submitted_by AS CHAR) AS submittedBy,
            p.payer_name AS payerName,
            p.payer_email AS payerEmail,
            p.payer_contact AS payerContact,
            p.provider,
            p.reference_number AS referenceNumber,
            p.payment_purpose AS paymentPurpose,
            p.related_entity_type AS relatedEntityType,
            CAST(p.related_entity_id AS CHAR) AS relatedEntityId,
            p.amount,
            p.validation_status AS validationStatus,
            p.payment_channel AS paymentChannel,
            p.gateway_environment AS gatewayEnvironment,
            p.gateway_checkout_id AS gatewayCheckoutId,
            p.gateway_payment_id AS gatewayPaymentId,
            p.gateway_payment_intent_id AS gatewayPaymentIntentId,
            p.gateway_status AS gatewayStatus,
            p.idempotency_key AS idempotencyKey,
            p.paid_at AS paidAt
       FROM payment_references p
       LEFT JOIN member_profiles m ON m.member_id = p.member_id
      WHERE p.related_entity_type = 'membership_application'
        AND p.related_entity_id = ?
        AND p.payment_purpose = ?
        AND p.validation_status IN ('Pending', 'Needs Clarification')
      ORDER BY p.payment_reference_id DESC
      LIMIT 1
      FOR UPDATE`,
    [applicationId, purpose],
  );
  return rows[0] ? mapPaymentReference(rows[0]) : null;
}

export async function insertPaymentReference(input: {
  connection: PoolConnection;
  application: PaymongoMembershipApplicationRecord;
  purpose: PaymongoMembershipCheckoutPurpose;
  amount: number;
  referenceNumber: string;
  requirement: RequirementRow;
}) {
  const [result] = await input.connection.execute<ResultSetHeader>(
    `INSERT INTO payment_references
       (member_id, submitted_by, payer_name, payer_email, payer_contact, provider,
        payment_channel, gateway_environment, reference_number, payment_purpose,
        related_entity_type, related_entity_id, amount, validation_status, notes)
     VALUES
       (NULL, NULL, ?, ?, ?, 'PayMongo Hosted Checkout',
        'PayMongo', 'Manual', ?, ?, 'membership_application', ?, ?, 'Pending', ?)`,
    [
      input.application.fullName,
      input.application.email,
      input.application.contactNumber,
      input.referenceNumber,
      input.purpose,
      input.application.id,
      input.amount,
      "PayMongo membership payment reference created. Confirmation depends on verified settlement.",
    ],
  );
  const paymentReferenceId = String(result.insertId);

  await input.connection.execute(
    `UPDATE membership_application_requirements
        SET payment_reference_id = ?,
            requirement_status = CASE
              WHEN requirement_status = 'Rejected' THEN 'Pending'
              ELSE requirement_status
            END,
            remarks = ?,
            updated_at = UTC_TIMESTAMP()
      WHERE membership_application_requirement_id = ?`,
    [
      paymentReferenceId,
      input.purpose === "Share Capital"
        ? "Latest Share Capital installment reference recorded. Aggregate validated references remain authoritative."
        : "PayMongo membership fee checkout started. Confirmation depends on settlement.",
      input.requirement.id,
    ],
  );

  await input.connection.execute(
    `INSERT INTO payment_validation_history
       (payment_reference_id, old_status, new_status, validation_source, reason, changed_by)
     VALUES (?, NULL, 'Pending', 'System', ?, NULL)`,
    [
      paymentReferenceId,
      input.purpose === "Share Capital"
        ? "Public application Share Capital installment reference created."
        : "Public application membership fee reference created.",
    ],
  );

  await input.connection.execute(
    `INSERT INTO audit_logs
       (user_id, action, entity_table, record_id, description, new_values)
     VALUES (NULL, ?, 'payment_references', ?, ?, ?)`,
    [
      input.purpose === "Share Capital"
        ? "paymongo.membership_capital_installment_created"
        : "paymongo.membership_fee_reference_created",
      paymentReferenceId,
      input.purpose === "Share Capital"
        ? "A public membership application Share Capital installment reference was created."
        : "A public membership application fee reference was created.",
      JSON.stringify({
        applicationCode: input.application.applicationCode,
        paymentPurpose: input.purpose,
        referenceNumber: input.referenceNumber,
        amount: input.amount,
      }),
    ],
  );

  const created = await selectPaymentReference(input.connection, paymentReferenceId);
  if (!created) {
    throw new AppError(
      "The payment reference could not be loaded after creation",
      500,
      "PAYMENT_REFERENCE_CREATE_FAILED",
    );
  }
  return created;
}
