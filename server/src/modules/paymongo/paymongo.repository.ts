import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type {
  PaymongoCheckoutSession,
  PaymongoGatewayEnvironment,
  PaymongoMembershipApplicationRecord,
  PaymongoMembershipCheckoutPurpose,
  PaymongoMembershipSettings,
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

type SettingRow = RowDataPacket & {
  settingKey: string;
  settingValue: string | null;
};

type MembershipApplicationCheckoutRow = RowDataPacket & {
  id: string;
  applicationCode: string;
  publicTrackingTokenHash: string;
  requestedMembershipType: PaymongoMembershipApplicationRecord["requestedMembershipType"];
  fullName: string;
  email: string | null;
  contactNumber: string;
  applicationStatus: string;
};

type MembershipPaymentRequirementRow = RowDataPacket & {
  id: string;
  requirementStatus: string;
  paymentReferenceId: string | null;
};

type PaymentAmountRow = RowDataPacket & {
  total: string | number;
};

function mapPaymentReference(row: PaymentReferenceRow): PaymongoPaymentReferenceRecord {
  return {
    ...row,
    amount: Number(row.amount),
  };
}

async function selectPaymentReference(
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

function numberSetting(
  rows: SettingRow[],
  settingKey: string,
  fallback: number,
) {
  const value = rows.find((row) => row.settingKey === settingKey)?.settingValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requirementTypeForPurpose(paymentPurpose: PaymongoMembershipCheckoutPurpose) {
  return paymentPurpose === "Share Capital"
    ? "Initial Share Capital"
    : "Associate Membership Fee";
}

function referenceSuffix(paymentPurpose: PaymongoMembershipCheckoutPurpose) {
  return paymentPurpose === "Share Capital" ? "CAP" : "FEE";
}

export interface PaymongoRepository {
  findPaymentReference(paymentReferenceId: string): Promise<PaymongoPaymentReferenceRecord | null>;
  findMembershipApplicationByCode(
    applicationCode: string,
  ): Promise<PaymongoMembershipApplicationRecord | null>;
  getMembershipPaymentSettings(): Promise<PaymongoMembershipSettings>;
  getValidatedMembershipPaymentTotal(input: {
    applicationId: string;
    paymentPurpose: PaymongoMembershipCheckoutPurpose;
  }): Promise<number>;
  prepareMembershipPaymentReference(input: {
    application: PaymongoMembershipApplicationRecord;
    paymentPurpose: PaymongoMembershipCheckoutPurpose;
    amount: number;
  }): Promise<PaymongoPaymentReferenceRecord>;
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
      return selectPaymentReference(databasePool(), paymentReferenceId);
    },

    async findMembershipApplicationByCode(applicationCode) {
      const [rows] = await databasePool().execute<MembershipApplicationCheckoutRow[]>(
        `SELECT CAST(a.membership_application_id AS CHAR) AS id,
                a.application_code AS applicationCode,
                a.public_tracking_token_hash AS publicTrackingTokenHash,
                a.requested_membership_type AS requestedMembershipType,
                TRIM(CONCAT_WS(' ', a.first_name, NULLIF(a.middle_name, ''), a.last_name, NULLIF(a.suffix, ''))) AS fullName,
                a.email,
                a.contact_number AS contactNumber,
                a.application_status AS applicationStatus
           FROM membership_applications a
          WHERE a.application_code = ?
          LIMIT 1`,
        [applicationCode],
      );

      return rows[0] ?? null;
    },

    async getMembershipPaymentSettings() {
      const settingKeys = [
        "membership.associate_fee",
        "membership.initial_share_capital",
        "membership.true_member_required_capital",
        "membership.maximum_share_capital",
      ];
      const [rows] = await databasePool().execute<SettingRow[]>(
        `SELECT setting_key AS settingKey,
                setting_value AS settingValue
           FROM system_settings
          WHERE setting_key IN (${settingKeys.map(() => "?").join(", ")})`,
        settingKeys,
      );

      return {
        associateFee: numberSetting(rows, "membership.associate_fee", 200),
        initialShareCapital: numberSetting(rows, "membership.initial_share_capital", 1500),
        trueMemberRequiredCapital: numberSetting(
          rows,
          "membership.true_member_required_capital",
          3000,
        ),
        maximumShareCapital: numberSetting(rows, "membership.maximum_share_capital", 15000),
      };
    },

    async getValidatedMembershipPaymentTotal(input) {
      const [rows] = await databasePool().execute<PaymentAmountRow[]>(
        `SELECT COALESCE(SUM(pr.amount), 0) AS total
           FROM membership_application_requirements r
           JOIN payment_references pr ON pr.payment_reference_id = r.payment_reference_id
          WHERE r.membership_application_id = ?
            AND pr.payment_purpose = ?
            AND pr.related_entity_type = 'membership_application'
            AND pr.related_entity_id = ?
            AND r.requirement_status = 'Verified'
            AND pr.validation_status = 'Validated'`,
        [input.applicationId, input.paymentPurpose, input.applicationId],
      );

      return Number(rows[0]?.total ?? 0);
    },

    async prepareMembershipPaymentReference(input) {
      return withTransaction(async (connection) => {
        const requirementType = requirementTypeForPurpose(input.paymentPurpose);
        const [requirementRows] = await connection.execute<MembershipPaymentRequirementRow[]>(
          `SELECT CAST(membership_application_requirement_id AS CHAR) AS id,
                  requirement_status AS requirementStatus,
                  CAST(payment_reference_id AS CHAR) AS paymentReferenceId
             FROM membership_application_requirements
            WHERE membership_application_id = ?
              AND requirement_type = ?
            LIMIT 1
            FOR UPDATE`,
          [input.application.id, requirementType],
        );
        const requirement = requirementRows[0];
        if (!requirement) {
          throw new AppError(
            "The required membership payment step was not found",
            409,
            "MEMBERSHIP_PAYMENT_REQUIREMENT_NOT_FOUND",
          );
        }

        if (requirement.paymentReferenceId) {
          const existingReference = await selectPaymentReference(
            connection,
            requirement.paymentReferenceId,
          );
          if (!existingReference) {
            throw new AppError(
              "The linked payment reference was not found",
              409,
              "MEMBERSHIP_PAYMENT_REFERENCE_MISSING",
            );
          }
          return existingReference;
        }

        const referenceNumber = `${input.application.applicationCode}-${referenceSuffix(input.paymentPurpose)}`;
        const idempotencyKey = `trackcoop-paymongo-membership-application-${input.application.id}-${referenceSuffix(input.paymentPurpose).toLowerCase()}`;
        const [insertResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO payment_references
             (member_id, submitted_by, payer_name, payer_email, payer_contact, provider,
              payment_channel, gateway_environment, reference_number, payment_purpose,
              related_entity_type, related_entity_id, amount, validation_status, notes,
              idempotency_key)
           VALUES
             (NULL, NULL, ?, ?, ?, 'PayMongo Hosted Checkout',
              'PayMongo', 'Manual', ?, ?, 'membership_application', ?, ?, 'Pending', ?,
              ?)`,
          [
            input.application.fullName,
            input.application.email,
            input.application.contactNumber,
            referenceNumber,
            input.paymentPurpose,
            input.application.id,
            input.amount,
            "PayMongo checkout created. Requirement remains pending until webhook validation.",
            idempotencyKey,
          ],
        );
        const paymentReferenceId = String(insertResult.insertId);

        await connection.execute(
          `UPDATE membership_application_requirements
              SET payment_reference_id = ?,
                  requirement_status = CASE
                    WHEN requirement_status = 'Rejected' THEN 'Pending'
                    ELSE requirement_status
                  END,
                  remarks = COALESCE(remarks, ?),
                  updated_at = UTC_TIMESTAMP()
            WHERE membership_application_requirement_id = ?`,
          [
            paymentReferenceId,
            "PayMongo checkout started. Confirmation depends on webhook validation.",
            requirement.id,
          ],
        );

        await connection.execute(
          `INSERT INTO payment_validation_history
             (payment_reference_id, old_status, new_status, validation_source, reason, changed_by)
           VALUES (?, NULL, 'Pending', 'System', ?, NULL)`,
          [
            paymentReferenceId,
            "Public membership application PayMongo checkout reference created.",
          ],
        );

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (NULL, 'paymongo.membership_checkout_reference_created', 'payment_references', ?, ?, ?)`,
          [
            paymentReferenceId,
            "A public membership application PayMongo checkout reference was created.",
            JSON.stringify({
              applicationCode: input.application.applicationCode,
              paymentPurpose: input.paymentPurpose,
              amount: input.amount,
            }),
          ],
        );

        const createdReference = await selectPaymentReference(connection, paymentReferenceId);
        if (!createdReference) {
          throw new AppError(
            "The payment reference could not be loaded after creation",
            500,
            "PAYMENT_REFERENCE_CREATE_FAILED",
          );
        }

        return createdReference;
      }, databasePool());
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
