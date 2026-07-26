import type { Pool, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import type {
  PaymongoCheckoutSession,
  PaymongoGatewayEnvironment,
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
  gatewayEnvironment: PaymongoGatewayEnvironment;
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
  gatewayStatus: string | null;
  idempotencyKey: string | null;
  paidAt: Date | null;
};

function mapPaymentReference(row: PaymentReferenceRow): PaymongoPaymentReferenceRecord {
  return {
    ...row,
    amount: Number(row.amount),
  };
}

export interface PaymongoRepository {
  findPaymentReference(paymentReferenceId: string): Promise<PaymongoPaymentReferenceRecord | null>;
  recordCheckoutSession(input: {
    paymentReferenceId: string;
    session: PaymongoCheckoutSession;
    environment: PaymongoGatewayEnvironment;
    idempotencyKey: string;
  }): Promise<void>;
}

export function createPaymongoRepository(pool?: Pool): PaymongoRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async findPaymentReference(paymentReferenceId) {
      const [rows] = await databasePool().execute<PaymentReferenceRow[]>(
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
    },

    async recordCheckoutSession(input) {
      await databasePool().execute(
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
            AND validation_status <> 'Validated'`,
        [
          input.environment,
          input.session.id,
          input.session.paymentId,
          input.session.paymentIntentId,
          input.session.status,
          input.idempotencyKey,
          input.paymentReferenceId,
        ],
      );
    },
  };
}

