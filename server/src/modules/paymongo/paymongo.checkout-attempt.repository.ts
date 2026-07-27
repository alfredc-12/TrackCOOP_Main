import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type {
  PaymongoCheckoutAttemptRecord,
  PaymongoCheckoutAttemptResult,
  PaymongoCheckoutSession,
  PaymongoOnlineGatewayEnvironment,
  PaymongoReusableCheckoutAttemptRecord,
  PaymongoPaymentChannel,
  PaymongoPaymentReferenceRecord,
} from "./paymongo.types";

type PaymentReferenceRow = RowDataPacket & {
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

type CheckoutAttemptRow = RowDataPacket & {
  id: string;
  paymentReferenceId: string;
  attemptNumber: number | string;
  idempotencyKey: string;
  checkoutId: string;
  checkoutUrl: string | null;
  gatewayStatus: string | null;
  gatewayEnvironment: PaymongoOnlineGatewayEnvironment;
  amount: number | string;
  currency: "PHP";
  lastCheckedAt: Date | null;
  reusableUntil: Date;
  supersededAt: Date | null;
  completedAt: Date | null;
};

type NextAttemptRow = RowDataPacket & {
  nextAttemptNumber: number | string;
};

function mapPaymentReference(row: PaymentReferenceRow): PaymongoPaymentReferenceRecord {
  return {
    ...row,
    amount: Number(row.amount),
  };
}

function mapCheckoutAttempt(row: CheckoutAttemptRow): PaymongoCheckoutAttemptRecord {
  return {
    ...row,
    attemptNumber: Number(row.attemptNumber),
    amount: Number(row.amount),
  };
}

function reusableCheckoutAttempt(
  row: CheckoutAttemptRow | undefined,
): PaymongoReusableCheckoutAttemptRecord | null {
  if (!row?.checkoutUrl) return null;
  return {
    ...mapCheckoutAttempt(row),
    checkoutUrl: row.checkoutUrl,
  };
}

async function selectPaymentReferenceForUpdate(
  connection: PoolConnection,
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
      LIMIT 1
      FOR UPDATE`,
    [paymentReferenceId],
  );
  return rows[0] ? mapPaymentReference(rows[0]) : null;
}

async function preserveLegacyCheckoutAttempt(
  connection: PoolConnection,
  record: PaymongoPaymentReferenceRecord,
  environment: PaymongoOnlineGatewayEnvironment,
) {
  if (!record.gatewayCheckoutId) return;

  const legacyEnvironment = record.gatewayEnvironment === "Manual"
    ? environment
    : record.gatewayEnvironment;
  const legacyIdempotencyKey = record.idempotencyKey
    ?? `trackcoop-paymongo-legacy-${record.id}-${record.gatewayCheckoutId}`;

  await connection.execute(
    `INSERT IGNORE INTO payment_gateway_checkout_attempts
       (payment_reference_id, gateway_name, attempt_number, idempotency_key,
        gateway_checkout_id, checkout_url, gateway_status, gateway_environment,
        amount, currency, reusable_until, superseded_at)
     SELECT ?, 'PayMongo', 0, ?, ?, NULL, ?, ?, ?, 'PHP', UTC_TIMESTAMP(), UTC_TIMESTAMP()
      WHERE NOT EXISTS (
        SELECT 1
          FROM payment_gateway_checkout_attempts
         WHERE payment_reference_id = ?
           AND gateway_name = 'PayMongo'
           AND gateway_checkout_id = ?
      )`,
    [
      record.id,
      legacyIdempotencyKey,
      record.gatewayCheckoutId,
      record.gatewayStatus,
      legacyEnvironment,
      record.amount,
      record.id,
      record.gatewayCheckoutId,
    ],
  );
}

async function selectReusableAttempt(
  connection: PoolConnection,
  paymentReferenceId: string,
  environment: PaymongoOnlineGatewayEnvironment,
) {
  const [rows] = await connection.execute<CheckoutAttemptRow[]>(
    `SELECT CAST(payment_gateway_checkout_attempt_id AS CHAR) AS id,
            CAST(payment_reference_id AS CHAR) AS paymentReferenceId,
            attempt_number AS attemptNumber,
            idempotency_key AS idempotencyKey,
            gateway_checkout_id AS checkoutId,
            checkout_url AS checkoutUrl,
            gateway_status AS gatewayStatus,
            gateway_environment AS gatewayEnvironment,
            amount,
            currency,
            last_checked_at AS lastCheckedAt,
            reusable_until AS reusableUntil,
            superseded_at AS supersededAt,
            completed_at AS completedAt
       FROM payment_gateway_checkout_attempts
      WHERE payment_reference_id = ?
        AND gateway_name = 'PayMongo'
        AND gateway_environment = ?
        AND checkout_url IS NOT NULL
        AND reusable_until > UTC_TIMESTAMP()
        AND superseded_at IS NULL
        AND completed_at IS NULL
        AND COALESCE(LOWER(gateway_status), 'active') <> 'expired'
      ORDER BY attempt_number DESC
      LIMIT 1
      FOR UPDATE`,
    [paymentReferenceId, environment],
  );
  return reusableCheckoutAttempt(rows[0]);
}

async function selectLatestAttempt(
  connection: Pool | PoolConnection,
  paymentReferenceId: string,
) {
  const [rows] = await connection.execute<CheckoutAttemptRow[]>(
    `SELECT CAST(payment_gateway_checkout_attempt_id AS CHAR) AS id,
            CAST(payment_reference_id AS CHAR) AS paymentReferenceId,
            attempt_number AS attemptNumber,
            idempotency_key AS idempotencyKey,
            gateway_checkout_id AS checkoutId,
            checkout_url AS checkoutUrl,
            gateway_status AS gatewayStatus,
            gateway_environment AS gatewayEnvironment,
            amount,
            currency,
            last_checked_at AS lastCheckedAt,
            reusable_until AS reusableUntil,
            superseded_at AS supersededAt,
            completed_at AS completedAt
       FROM payment_gateway_checkout_attempts
      WHERE payment_reference_id = ?
        AND gateway_name = 'PayMongo'
      ORDER BY attempt_number DESC
      LIMIT 1`,
    [paymentReferenceId],
  );
  return rows[0] ? mapCheckoutAttempt(rows[0]) : null;
}

function attemptIdempotencyKey(paymentReferenceId: string, attemptNumber: number) {
  return `trackcoop-paymongo-payment-reference-${paymentReferenceId}-attempt-${attemptNumber}`;
}

function reusableUntil(reuseMinutes: number) {
  return new Date(Date.now() + reuseMinutes * 60_000);
}

function sqlDateTime(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

export interface PaymongoCheckoutAttemptRepository {
  createOrReuseCheckoutAttempt(input: {
    paymentReferenceId: string;
    environment: PaymongoOnlineGatewayEnvironment;
    reuseMinutes: number;
    validateRecord(record: PaymongoPaymentReferenceRecord): void;
    createSession(
      record: PaymongoPaymentReferenceRecord,
      idempotencyKey: string,
    ): Promise<PaymongoCheckoutSession>;
  }): Promise<PaymongoCheckoutAttemptResult>;
  findLatestCheckoutAttempt(
    paymentReferenceId: string,
  ): Promise<PaymongoCheckoutAttemptRecord | null>;
  refreshCheckoutAttempt(input: {
    paymentReferenceId: string;
    checkoutId: string;
    session: PaymongoCheckoutSession;
  }): Promise<void>;
}

export function createPaymongoCheckoutAttemptRepository(
  pool?: Pool,
): PaymongoCheckoutAttemptRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async createOrReuseCheckoutAttempt(input) {
      return withTransaction(async (connection) => {
        const record = await selectPaymentReferenceForUpdate(
          connection,
          input.paymentReferenceId,
        );
        if (!record) {
          throw new AppError(
            "Payment reference was not found",
            404,
            "PAYMENT_REFERENCE_NOT_FOUND",
          );
        }

        input.validateRecord(record);
        await preserveLegacyCheckoutAttempt(connection, record, input.environment);

        const reusable = await selectReusableAttempt(
          connection,
          record.id,
          input.environment,
        );
        if (reusable) {
          return { record, attempt: reusable, reused: true };
        }

        const [nextRows] = await connection.execute<NextAttemptRow[]>(
          `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS nextAttemptNumber
             FROM payment_gateway_checkout_attempts
            WHERE payment_reference_id = ?
              AND gateway_name = 'PayMongo'`,
          [record.id],
        );
        const attemptNumber = Number(nextRows[0]?.nextAttemptNumber ?? 1);
        const idempotencyKey = attemptIdempotencyKey(record.id, attemptNumber);
        const session = await input.createSession(record, idempotencyKey);
        const expiresAt = reusableUntil(input.reuseMinutes);

        await connection.execute(
          `UPDATE payment_gateway_checkout_attempts
              SET superseded_at = COALESCE(superseded_at, UTC_TIMESTAMP()),
                  updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?
              AND gateway_name = 'PayMongo'
              AND superseded_at IS NULL
              AND completed_at IS NULL`,
          [record.id],
        );

        const [insertResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO payment_gateway_checkout_attempts
             (payment_reference_id, gateway_name, attempt_number, idempotency_key,
              gateway_checkout_id, checkout_url, gateway_status, gateway_environment,
              amount, currency, reusable_until)
           VALUES (?, 'PayMongo', ?, ?, ?, ?, ?, ?, ?, 'PHP', ?)`,
          [
            record.id,
            attemptNumber,
            idempotencyKey,
            session.id,
            session.checkoutUrl,
            session.status,
            input.environment,
            record.amount,
            sqlDateTime(expiresAt),
          ],
        );

        await connection.execute(
          `UPDATE payment_references
              SET payment_channel = 'PayMongo',
                  gateway_environment = ?,
                  gateway_checkout_id = ?,
                  gateway_payment_id = COALESCE(?, gateway_payment_id),
                  gateway_payment_intent_id = COALESCE(?, gateway_payment_intent_id),
                  gateway_status = ?,
                  idempotency_key = ?,
                  updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?
              AND validation_status NOT IN ('Validated', 'Reversed')`,
          [
            input.environment,
            session.id,
            session.paymentId,
            session.paymentIntentId,
            session.status,
            idempotencyKey,
            record.id,
          ],
        );

        return {
          record,
          reused: false,
          attempt: {
            id: String(insertResult.insertId),
            paymentReferenceId: record.id,
            attemptNumber,
            idempotencyKey,
            checkoutId: session.id,
            checkoutUrl: session.checkoutUrl,
            gatewayStatus: session.status,
            gatewayEnvironment: input.environment,
            amount: record.amount,
            currency: "PHP",
            lastCheckedAt: null,
            reusableUntil: expiresAt,
            supersededAt: null,
            completedAt: null,
          },
        };
      }, databasePool());
    },

    async findLatestCheckoutAttempt(paymentReferenceId) {
      return selectLatestAttempt(databasePool(), paymentReferenceId);
    },

    async refreshCheckoutAttempt(input) {
      await withTransaction(async (connection) => {
        const [attemptRows] = await connection.execute<CheckoutAttemptRow[]>(
          `SELECT CAST(payment_gateway_checkout_attempt_id AS CHAR) AS id,
                  CAST(payment_reference_id AS CHAR) AS paymentReferenceId,
                  attempt_number AS attemptNumber,
                  idempotency_key AS idempotencyKey,
                  gateway_checkout_id AS checkoutId,
                  checkout_url AS checkoutUrl,
                  gateway_status AS gatewayStatus,
                  gateway_environment AS gatewayEnvironment,
                  amount,
                  currency,
                  last_checked_at AS lastCheckedAt,
                  reusable_until AS reusableUntil,
                  superseded_at AS supersededAt,
                  completed_at AS completedAt
             FROM payment_gateway_checkout_attempts
            WHERE payment_reference_id = ?
              AND gateway_name = 'PayMongo'
              AND gateway_checkout_id = ?
            LIMIT 1
            FOR UPDATE`,
          [input.paymentReferenceId, input.checkoutId],
        );
        if (!attemptRows[0]) {
          throw new AppError(
            "PayMongo checkout attempt was not found",
            404,
            "PAYMONGO_CHECKOUT_ATTEMPT_NOT_FOUND",
          );
        }

        const isCompleted = Boolean(input.session.paymentId)
          || input.session.status?.trim().toLowerCase() === "expired";

        await connection.execute(
          `UPDATE payment_gateway_checkout_attempts
              SET checkout_url = ?,
                  gateway_status = ?,
                  last_checked_at = UTC_TIMESTAMP(),
                  completed_at = CASE
                    WHEN ? = 1 THEN COALESCE(completed_at, UTC_TIMESTAMP())
                    ELSE completed_at
                  END,
                  updated_at = UTC_TIMESTAMP()
            WHERE payment_gateway_checkout_attempt_id = ?`,
          [
            input.session.checkoutUrl,
            input.session.status,
            isCompleted ? 1 : 0,
            attemptRows[0].id,
          ],
        );

        await connection.execute(
          `UPDATE payment_references
              SET gateway_checkout_id = ?,
                  gateway_payment_id = COALESCE(?, gateway_payment_id),
                  gateway_payment_intent_id = COALESCE(?, gateway_payment_intent_id),
                  gateway_status = ?,
                  updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?`,
          [
            input.session.id,
            input.session.paymentId,
            input.session.paymentIntentId,
            input.session.status,
            input.paymentReferenceId,
          ],
        );
      }, databasePool());
    },
  };
}
