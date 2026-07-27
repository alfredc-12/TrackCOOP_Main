import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";

export type PaymentValidationSource = "Manual Bookkeeper" | "PayMongo Webhook";

export type GatewaySettlementDetails = {
  checkoutId?: string | null;
  paymentId?: string | null;
  paymentIntentId?: string | null;
  gatewayStatus?: string | null;
  paymentMethod?: string | null;
  amount: number;
  currency: "PHP";
  feeAmount?: number | null;
  netAmount?: number | null;
  paidAt?: Date | null;
  environment?: "Test" | "Live";
};

export type SettlePaymentReferenceInput = {
  paymentReferenceId: string;
  validationSource: PaymentValidationSource;
  actorUserId: string | null;
  gatewayEventId?: string | null;
  gatewayDetails?: GatewaySettlementDetails | null;
};

export type SettlementResult = {
  paymentReferenceId: string;
  alreadySettled: boolean;
  validationStatus: "Validated";
};

type PaymentReferenceForSettlement = RowDataPacket & {
  id: string;
  memberId: string | null;
  payerName: string | null;
  referenceNumber: string;
  paymentPurpose: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  amount: string | number;
  validationStatus: string;
  paymentChannel: string;
  gatewayEnvironment: "Test" | "Live" | "Manual";
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
};

type MembershipApplicationSettlementRow = RowDataPacket & {
  id: string;
  applicationCode: string;
  applicationStatus: string;
  requestedMembershipType: "Associate" | "True Member";
  convertedMemberId: string | null;
  memberUserId: string | null;
  fullName: string;
};

type RequirementSettlementRow = RowDataPacket & {
  id: string;
  requirementStatus: string;
};

type IdRow = RowDataPacket & { id: string };
type AmountRow = RowDataPacket & { total: string | number };

const manualChannels = new Set(["Manual GCash", "Cash", "Bank Transfer", "Other"]);

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function dateTime(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 19).replace("T", " ") : null;
}

function recordDate(value: Date | null | undefined) {
  return (value ?? new Date()).toISOString().slice(0, 10);
}

function categoryCodes(paymentPurpose: string) {
  if (paymentPurpose === "Share Capital") {
    return ["SHARE_CAPITAL", "MEMBERSHIP_FEE", "OTHER_INCOME"];
  }
  return ["ASSOCIATE_MEMBERSHIP_FEE", "MEMBERSHIP_FEE", "OTHER_INCOME"];
}

function requirementType(paymentPurpose: string) {
  return paymentPurpose === "Share Capital"
    ? "Initial Share Capital"
    : "Associate Membership Fee";
}

async function selectSettlementActor(
  connection: PoolConnection,
  actorUserId: string | null,
) {
  if (actorUserId) return actorUserId;

  const [rows] = await connection.execute<IdRow[]>(
    `SELECT CAST(u.user_id AS CHAR) AS id
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug IN ('bookkeeper', 'chairman')
        AND u.account_status = 'Active'
      ORDER BY r.role_slug = 'bookkeeper' DESC, u.user_id ASC
      LIMIT 1`,
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

async function selectPaymentForUpdate(
  connection: PoolConnection,
  paymentReferenceId: string,
) {
  const [rows] = await connection.execute<PaymentReferenceForSettlement[]>(
    `SELECT CAST(payment_reference_id AS CHAR) AS id,
            CAST(member_id AS CHAR) AS memberId,
            payer_name AS payerName,
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
            gateway_payment_intent_id AS gatewayPaymentIntentId
       FROM payment_references
      WHERE payment_reference_id = ?
      LIMIT 1
      FOR UPDATE`,
    [paymentReferenceId],
  );
  return rows[0] ?? null;
}

async function selectMembershipApplication(
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
            TRIM(CONCAT_WS(' ', a.first_name, NULLIF(a.middle_name, ''), a.last_name, NULLIF(a.suffix, ''))) AS fullName
       FROM membership_applications a
       LEFT JOIN member_profiles m ON m.member_id = a.converted_member_id
      WHERE a.membership_application_id = ?
      LIMIT 1
      FOR UPDATE`,
    [applicationId],
  );
  return rows[0] ?? null;
}

async function selectRequirement(
  connection: PoolConnection,
  applicationId: string,
  paymentReferenceId: string,
  paymentPurpose: string,
) {
  const [rows] = await connection.execute<RequirementSettlementRow[]>(
    `SELECT CAST(membership_application_requirement_id AS CHAR) AS id,
            requirement_status AS requirementStatus
       FROM membership_application_requirements
      WHERE membership_application_id = ?
        AND payment_reference_id = ?
        AND requirement_type = ?
      LIMIT 1
      FOR UPDATE`,
    [applicationId, paymentReferenceId, requirementType(paymentPurpose)],
  );
  return rows[0] ?? null;
}

async function selectMembershipSetting(
  connection: PoolConnection,
  key: string,
  fallback: number,
) {
  const [rows] = await connection.execute<(RowDataPacket & { value: string | null })[]>(
    `SELECT setting_value AS value FROM system_settings WHERE setting_key = ? LIMIT 1`,
    [key],
  );
  const parsed = Number(rows[0]?.value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function selectCategoryId(connection: PoolConnection, paymentPurpose: string) {
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

async function insertFinanceRecord(input: {
  connection: PoolConnection;
  payment: PaymentReferenceForSettlement;
  application: MembershipApplicationSettlementRow;
  actorUserId: string;
  paidAt: Date | null | undefined;
}) {
  const categoryId = await selectCategoryId(input.connection, input.payment.paymentPurpose);
  await input.connection.execute(
    `INSERT IGNORE INTO financial_records
       (record_number, payment_reference_id, member_id, financial_category_id, recorded_by,
        approved_by, record_type, source_module, source_record_id, amount, record_date, remarks)
     VALUES (?, ?, ?, ?, ?, ?, 'Income', 'Membership', ?, ?, ?, ?)`,
    [
      `PAY-FIN-${input.payment.id}`,
      input.payment.id,
      input.application.convertedMemberId,
      categoryId,
      input.actorUserId,
      input.actorUserId,
      input.payment.id,
      input.payment.amount,
      recordDate(input.paidAt),
      `${input.payment.paymentPurpose} settlement for ${input.application.applicationCode}`,
    ],
  );
}

async function notifyStaff(connection: PoolConnection, input: {
  applicationId: string;
  title: string;
  message: string;
}) {
  await connection.execute(
    `INSERT INTO notifications
       (user_id, notification_type, title, message, related_entity_type, related_entity_id)
     SELECT u.user_id, 'Payment', ?, ?, 'membership_application', ?
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug IN ('chairman', 'bookkeeper')
        AND u.account_status = 'Active'`,
    [input.title, input.message, input.applicationId],
  );
}

async function notifyMemberIfAvailable(connection: PoolConnection, input: {
  userId: string | null;
  applicationId: string;
  title: string;
  message: string;
  notificationType: "Payment" | "Share Capital";
}) {
  if (!input.userId) return;
  await connection.execute(
    `INSERT INTO notifications
       (user_id, notification_type, title, message, related_entity_type, related_entity_id)
     VALUES (?, ?, ?, ?, 'membership_application', ?)`,
    [input.userId, input.notificationType, input.title, input.message, input.applicationId],
  );
}

async function insertApplicantMessage(connection: PoolConnection, input: {
  application: MembershipApplicationSettlementRow;
  message: string;
  actorUserId: string | null;
}) {
  await connection.execute(
    `INSERT INTO membership_application_status_history
       (membership_application_id, old_status, new_status, internal_note, applicant_message, changed_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.application.id,
      input.application.applicationStatus,
      input.application.applicationStatus,
      "Payment was settled without changing application status.",
      input.message,
      input.actorUserId,
    ],
  );
}

async function postMembershipSettlement(input: {
  connection: PoolConnection;
  payment: PaymentReferenceForSettlement;
  actorUserId: string;
  gatewayDetails?: GatewaySettlementDetails | null;
}) {
  if (input.payment.relatedEntityType !== "membership_application" || !input.payment.relatedEntityId) {
    throw new AppError(
      "Membership settlement requires a linked application",
      422,
      "PAYMENT_SETTLEMENT_ENTITY_INVALID",
    );
  }
  const application = await selectMembershipApplication(
    input.connection,
    input.payment.relatedEntityId,
  );
  if (!application) {
    throw new AppError(
      "Linked membership application was not found",
      404,
      "MEMBERSHIP_APPLICATION_NOT_FOUND",
    );
  }
  const requirement = await selectRequirement(
    input.connection,
    application.id,
    input.payment.id,
    input.payment.paymentPurpose,
  );
  if (!requirement) {
    throw new AppError(
      "Linked membership payment requirement was not found",
      409,
      "MEMBERSHIP_PAYMENT_REQUIREMENT_NOT_FOUND",
    );
  }

  if (input.payment.paymentPurpose === "Associate Membership Fee") {
    const expectedFee = await selectMembershipSetting(
      input.connection,
      "membership.associate_fee",
      200,
    );
    if (toMoney(Number(input.payment.amount)) !== toMoney(expectedFee)) {
      throw new AppError(
        "Associate membership fee amount does not match the configured fee",
        422,
        "MEMBERSHIP_FEE_AMOUNT_MISMATCH",
      );
    }
  }

  if (input.payment.paymentPurpose === "Share Capital") {
    const maxShareCapital = await selectMembershipSetting(
      input.connection,
      "membership.maximum_share_capital",
      15000,
    );
    const [capitalRows] = await input.connection.execute<AmountRow[]>(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM share_capital_payments
        WHERE member_id = ?
          AND payment_status = 'Validated'`,
      [application.convertedMemberId ?? "0"],
    );
    const existingCapital = Number(capitalRows[0]?.total ?? 0);
    if (existingCapital + Number(input.payment.amount) > maxShareCapital) {
      throw new AppError(
        "Share capital payment would exceed the maximum allowed amount",
        409,
        "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
      );
    }
  }

  await input.connection.execute(
    `UPDATE membership_application_requirements
        SET requirement_status = 'Verified',
            completion_date = UTC_DATE(),
            verified_by = ?,
            verified_at = UTC_TIMESTAMP(),
            remarks = ?
      WHERE membership_application_requirement_id = ?`,
    [
      input.actorUserId,
      `${input.payment.paymentPurpose} payment settled.`,
      requirement.id,
    ],
  );

  await insertFinanceRecord({
    connection: input.connection,
    payment: input.payment,
    application,
    actorUserId: input.actorUserId,
    paidAt: input.gatewayDetails?.paidAt,
  });

  if (input.payment.paymentPurpose === "Share Capital" && application.convertedMemberId) {
    await input.connection.execute(
      `INSERT INTO share_capital_payments
         (member_id, payment_reference_id, amount, payment_date, payment_status, verified_by, verified_at, remarks)
       SELECT ?, ?, ?, ?, 'Validated', ?, UTC_TIMESTAMP(), ?
        WHERE NOT EXISTS (
          SELECT 1 FROM share_capital_payments WHERE payment_reference_id = ?
        )`,
      [
        application.convertedMemberId,
        input.payment.id,
        input.payment.amount,
        recordDate(input.gatewayDetails?.paidAt),
        input.actorUserId,
        `Share capital settlement for ${application.applicationCode}`,
        input.payment.id,
      ],
    );
  }

  await insertApplicantMessage(input.connection, {
    application,
    actorUserId: input.actorUserId,
    message: `${input.payment.paymentPurpose} payment has been confirmed.`,
  });
  await notifyStaff(input.connection, {
    applicationId: application.id,
    title: "Membership payment confirmed",
    message: `${application.applicationCode} ${input.payment.paymentPurpose} was confirmed.`,
  });
  await notifyMemberIfAvailable(input.connection, {
    userId: application.memberUserId,
    applicationId: application.id,
    title: input.payment.paymentPurpose === "Share Capital"
      ? "Share capital payment confirmed"
      : "Membership fee confirmed",
    message: `${input.payment.paymentPurpose} payment was confirmed.`,
    notificationType: input.payment.paymentPurpose === "Share Capital" ? "Share Capital" : "Payment",
  });
}

export interface PaymentSettlementRepository {
  settlePaymentReference(input: SettlePaymentReferenceInput): Promise<SettlementResult>;
  markGatewayEventProcessed(gatewayEventId: string): Promise<void>;
  markGatewayEventFailed(input: {
    gatewayEventId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<void>;
}

export function createPaymentSettlementRepository(pool?: Pool): PaymentSettlementRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async settlePaymentReference(input) {
      return withTransaction(async (connection) => {
        const payment = await selectPaymentForUpdate(connection, input.paymentReferenceId);
        if (!payment) {
          throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        }
        const actorUserId = await selectSettlementActor(connection, input.actorUserId);

        if (input.validationSource === "Manual Bookkeeper") {
          if (!manualChannels.has(payment.paymentChannel)) {
            throw new AppError(
              "Only manual payment channels can be validated manually",
              409,
              "PAYMENT_MANUAL_CHANNEL_REQUIRED",
            );
          }
        } else if (payment.paymentChannel !== "PayMongo") {
          throw new AppError(
            "PayMongo webhook settlement requires a PayMongo payment reference",
            409,
            "PAYMENT_PAYMONGO_CHANNEL_REQUIRED",
          );
        }

        if (input.gatewayDetails) {
          const expectedAmount = toMoney(Number(payment.amount));
          if (toMoney(input.gatewayDetails.amount) !== expectedAmount) {
            throw new AppError(
              "PayMongo payment amount does not match the TrackCOOP reference",
              422,
              "PAYMENT_AMOUNT_MISMATCH",
            );
          }
          if (input.gatewayDetails.currency !== "PHP") {
            throw new AppError("PayMongo payment currency is invalid", 422, "PAYMENT_CURRENCY_MISMATCH");
          }
          if (payment.gatewayCheckoutId && payment.gatewayCheckoutId !== input.gatewayDetails.checkoutId) {
            throw new AppError("PayMongo checkout ID conflicts with the payment reference", 409, "PAYMENT_CHECKOUT_CONFLICT");
          }
          if (payment.gatewayPaymentId && payment.gatewayPaymentId !== input.gatewayDetails.paymentId) {
            throw new AppError("PayMongo payment ID conflicts with the payment reference", 409, "PAYMENT_GATEWAY_PAYMENT_CONFLICT");
          }
        }

        if (payment.validationStatus === "Validated") {
          if (
            !input.gatewayDetails?.paymentId ||
            !payment.gatewayPaymentId ||
            payment.gatewayPaymentId === input.gatewayDetails.paymentId
          ) {
            return {
              paymentReferenceId: payment.id,
              alreadySettled: true,
              validationStatus: "Validated",
            };
          }
          throw new AppError("Payment reference was already settled by a different gateway payment", 409, "PAYMENT_GATEWAY_PAYMENT_CONFLICT");
        }

        await connection.execute(
          `UPDATE payment_references
              SET validation_status = 'Validated',
                  validated_by = ?,
                  validated_at = UTC_TIMESTAMP(),
                  rejection_reason = NULL,
                  payment_channel = CASE WHEN ? = 'PayMongo Webhook' THEN 'PayMongo' ELSE payment_channel END,
                  gateway_environment = COALESCE(?, gateway_environment),
                  gateway_checkout_id = COALESCE(?, gateway_checkout_id),
                  gateway_payment_id = COALESCE(?, gateway_payment_id),
                  gateway_payment_intent_id = COALESCE(?, gateway_payment_intent_id),
                  gateway_status = COALESCE(?, gateway_status),
                  gateway_payment_method = COALESCE(?, gateway_payment_method),
                  gateway_fee_amount = COALESCE(?, gateway_fee_amount),
                  gateway_net_amount = COALESCE(?, gateway_net_amount),
                  paid_at = COALESCE(?, paid_at, UTC_TIMESTAMP()),
                  webhook_received_at = CASE WHEN ? = 'PayMongo Webhook' THEN UTC_TIMESTAMP() ELSE webhook_received_at END,
                  validation_source = ?,
                  updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?`,
          [
            actorUserId,
            input.validationSource,
            input.gatewayDetails?.environment ?? null,
            input.gatewayDetails?.checkoutId ?? null,
            input.gatewayDetails?.paymentId ?? null,
            input.gatewayDetails?.paymentIntentId ?? null,
            input.gatewayDetails?.gatewayStatus ?? null,
            input.gatewayDetails?.paymentMethod ?? null,
            input.gatewayDetails?.feeAmount ?? null,
            input.gatewayDetails?.netAmount ?? null,
            dateTime(input.gatewayDetails?.paidAt),
            input.validationSource,
            input.validationSource,
            payment.id,
          ],
        );

        await connection.execute(
          `INSERT INTO payment_validation_history
             (payment_reference_id, old_status, new_status, validation_source, reason, changed_by, gateway_event_id)
           VALUES (?, ?, 'Validated', ?, ?, ?, ?)`,
          [
            payment.id,
            payment.validationStatus,
            input.validationSource,
            input.validationSource === "PayMongo Webhook"
              ? "PayMongo webhook confirmed payment."
              : "Bookkeeper manually validated payment.",
            actorUserId,
            input.gatewayEventId ?? null,
          ],
        );

        if (["Associate Membership Fee", "Share Capital"].includes(payment.paymentPurpose)) {
          await postMembershipSettlement({
            connection,
            payment,
            actorUserId,
            gatewayDetails: input.gatewayDetails,
          });
        }

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'payment_reference.settled', 'payment_references', ?, ?, JSON_OBJECT('validationStatus', ?), JSON_OBJECT('validationStatus', 'Validated', 'validationSource', ?))`,
          [
            actorUserId,
            payment.id,
            "A payment reference was settled.",
            payment.validationStatus,
            input.validationSource,
          ],
        );

        if (input.gatewayEventId) {
          await connection.execute(
            `UPDATE payment_gateway_events
                SET processing_status = 'Processed',
                    processed_at = UTC_TIMESTAMP(),
                    payment_reference_id = ?
              WHERE payment_gateway_event_id = ?`,
            [payment.id, input.gatewayEventId],
          );
        }

        return {
          paymentReferenceId: payment.id,
          alreadySettled: false,
          validationStatus: "Validated",
        };
      }, databasePool());
    },

    async markGatewayEventProcessed(gatewayEventId) {
      await databasePool().execute(
        `UPDATE payment_gateway_events
            SET processing_status = 'Processed',
                processed_at = UTC_TIMESTAMP()
          WHERE payment_gateway_event_id = ?`,
        [gatewayEventId],
      );
    },

    async markGatewayEventFailed(input) {
      await databasePool().execute(
        `UPDATE payment_gateway_events
            SET processing_status = 'Failed',
                error_code = ?,
                error_message = ?,
                processed_at = UTC_TIMESTAMP()
          WHERE payment_gateway_event_id = ?`,
        [
          input.errorCode.slice(0, 120),
          input.errorMessage.slice(0, 1000),
          input.gatewayEventId,
        ],
      );
    },
  };
}

export interface PaymentSettlementService {
  settlePaymentReference(input: SettlePaymentReferenceInput): Promise<SettlementResult>;
}

export function createPaymentSettlementService(
  repository: PaymentSettlementRepository = createPaymentSettlementRepository(),
): PaymentSettlementService {
  return {
    settlePaymentReference(input) {
      return repository.settlePaymentReference(input);
    },
  };
}
