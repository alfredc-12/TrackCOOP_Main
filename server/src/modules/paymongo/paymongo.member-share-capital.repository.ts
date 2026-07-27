import crypto from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import {
  assertMemberShareCapitalCapacity,
  assertMemberShareCapitalProfileEligible,
  buildMemberShareCapitalSummary,
  memberCapitalMoney,
} from "./paymongo.member-share-capital.rules";
import type {
  PaymongoMemberShareCapitalCheckoutInput,
  PaymongoMemberShareCapitalProfile,
  PaymongoMemberShareCapitalSummary,
  PaymongoMembershipSettings,
  PaymongoMode,
  PaymongoOnlineGatewayEnvironment,
  PaymongoPaymentReferenceRecord,
} from "./paymongo.types";

type ProfileRow = RowDataPacket & {
  id: string;
  userId: string;
  memberCode: string;
  fullName: string;
  email: string | null;
  contactNumber: string | null;
  membershipType: "Associate" | "True Member";
  approvalStatus: string;
  officialMemberStatus: string;
};

type AmountRow = RowDataPacket & { total: string | number | null };
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
  paymentChannel: PaymongoPaymentReferenceRecord["paymentChannel"];
  gatewayEnvironment: PaymongoPaymentReferenceRecord["gatewayEnvironment"];
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
  gatewayStatus: string | null;
  idempotencyKey: string | null;
  paidAt: Date | null;
  clientRequestId: string | null;
  submittedAt: Date;
};

type ActiveContributionRow = RowDataPacket & {
  paymentReferenceId: string;
  clientRequestId: string | null;
  amount: string | number;
  checkoutId: string | null;
  checkoutUrl: string | null;
  attemptNumber: number | null;
  gatewayStatus: string | null;
};

type HistoryRow = RowDataPacket & {
  paymentReferenceId: string;
  referenceNumber: string;
  amount: string | number;
  validationStatus: PaymongoPaymentReferenceRecord["validationStatus"];
  gatewayStatus: string | null;
  submittedAt: Date;
  paidAt: Date | null;
  receiptNumber: string | null;
};

function mapProfile(row: ProfileRow): PaymongoMemberShareCapitalProfile {
  return {
    id: row.id,
    userId: row.userId,
    memberCode: row.memberCode,
    fullName: row.fullName,
    email: row.email,
    contactNumber: row.contactNumber,
    membershipType: row.membershipType,
    approvalStatus: row.approvalStatus,
    officialMemberStatus: row.officialMemberStatus,
  };
}

function mapPaymentReference(row: PaymentReferenceRow): PaymongoPaymentReferenceRecord {
  return { ...row, amount: Number(row.amount) };
}

async function selectProfile(
  connection: Pool | PoolConnection,
  userId: string,
  forUpdate = false,
) {
  const [rows] = await connection.execute<ProfileRow[]>(
    `SELECT CAST(member_id AS CHAR) AS id,
            CAST(user_id AS CHAR) AS userId,
            member_code AS memberCode,
            full_name AS fullName,
            email,
            contact_number AS contactNumber,
            membership_type AS membershipType,
            approval_status AS approvalStatus,
            official_member_status AS officialMemberStatus
       FROM member_profiles
      WHERE user_id = ?
      LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [userId],
  );
  return rows[0] ? mapProfile(rows[0]) : null;
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
            p.paid_at AS paidAt,
            p.client_request_id AS clientRequestId,
            p.submitted_at AS submittedAt
       FROM payment_references p
       LEFT JOIN member_profiles m ON m.member_id = p.member_id
      WHERE p.payment_reference_id = ?
      LIMIT 1`,
    [paymentReferenceId],
  );
  return rows[0] ? mapPaymentReference(rows[0]) : null;
}

async function validatedCapital(connection: Pool | PoolConnection, memberId: string) {
  const [rows] = await connection.execute<AmountRow[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM share_capital_payments
      WHERE member_id = ? AND payment_status = 'Validated'`,
    [memberId],
  );
  return memberCapitalMoney(Number(rows[0]?.total ?? 0));
}

async function activeContributions(
  connection: Pool | PoolConnection,
  input: {
    memberId: string;
    environment: PaymongoOnlineGatewayEnvironment;
    reuseMinutes: number;
    excludePaymentReferenceId?: string;
    forUpdate?: boolean;
  },
) {
  const exclusion = input.excludePaymentReferenceId
    ? "AND pr.payment_reference_id <> ?"
    : "";
  const [rows] = await connection.execute<ActiveContributionRow[]>(
    `SELECT CAST(pr.payment_reference_id AS CHAR) AS paymentReferenceId,
            pr.client_request_id AS clientRequestId,
            pr.amount,
            a.gateway_checkout_id AS checkoutId,
            a.checkout_url AS checkoutUrl,
            a.attempt_number AS attemptNumber,
            a.gateway_status AS gatewayStatus
       FROM payment_references pr
       LEFT JOIN payment_gateway_checkout_attempts a
         ON a.payment_gateway_checkout_attempt_id = (
           SELECT MAX(a2.payment_gateway_checkout_attempt_id)
             FROM payment_gateway_checkout_attempts a2
            WHERE a2.payment_reference_id = pr.payment_reference_id
              AND a2.gateway_name = 'PayMongo'
              AND a2.gateway_environment = ?
         )
      WHERE pr.member_id = ?
        AND pr.payment_purpose = 'Share Capital'
        AND pr.related_entity_type = 'member_profile'
        AND pr.validation_status IN ('Pending', 'Needs Clarification')
        AND pr.payment_channel = 'PayMongo'
        AND (
          (a.checkout_url IS NOT NULL
           AND a.reusable_until > UTC_TIMESTAMP()
           AND a.superseded_at IS NULL
           AND a.completed_at IS NULL
           AND LOWER(COALESCE(a.gateway_status, 'active')) NOT IN
             ('expired', 'paid', 'cancelled', 'canceled'))
          OR (a.payment_gateway_checkout_attempt_id IS NULL
              AND pr.submitted_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE))
        )
        ${exclusion}
      ORDER BY pr.payment_reference_id DESC
      ${input.forUpdate ? "FOR UPDATE" : ""}`,
    [input.environment, input.memberId, input.reuseMinutes, ...(input.excludePaymentReferenceId ? [input.excludePaymentReferenceId] : [])],
  );
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

export interface PaymongoMemberShareCapitalRepository {
  getSummary(input: {
    userId: string;
    settings: PaymongoMembershipSettings;
    environment: PaymongoOnlineGatewayEnvironment;
    reuseMinutes: number;
    mode: PaymongoMode;
  }): Promise<PaymongoMemberShareCapitalSummary>;
  prepareContribution(input: {
    userId: string;
    checkout: PaymongoMemberShareCapitalCheckoutInput;
    settings: PaymongoMembershipSettings;
    environment: PaymongoOnlineGatewayEnvironment;
    reuseMinutes: number;
  }): Promise<PaymongoPaymentReferenceRecord>;
  assertCheckoutCapacity(input: {
    connection?: PoolConnection | null;
    userId: string;
    paymentReferenceId: string;
    amount: number;
    settings: PaymongoMembershipSettings;
    environment: PaymongoOnlineGatewayEnvironment;
    reuseMinutes: number;
  }): Promise<void>;
}

export function createPaymongoMemberShareCapitalRepository(
  pool?: Pool,
): PaymongoMemberShareCapitalRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async getSummary(input) {
      const profile = await selectProfile(databasePool(), input.userId);
      if (!profile) {
        throw new AppError(
          "A member profile is required to contribute Share Capital",
          404,
          "MEMBER_PROFILE_NOT_FOUND",
        );
      }
      assertMemberShareCapitalProfileEligible(profile);
      const [validated, activeRows, historyRows] = await Promise.all([
        validatedCapital(databasePool(), profile.id),
        activeContributions(databasePool(), {
          memberId: profile.id,
          environment: input.environment,
          reuseMinutes: input.reuseMinutes,
        }),
        databasePool().execute<HistoryRow[]>(
          `SELECT CAST(pr.payment_reference_id AS CHAR) AS paymentReferenceId,
                  pr.reference_number AS referenceNumber,
                  pr.amount,
                  pr.validation_status AS validationStatus,
                  pr.gateway_status AS gatewayStatus,
                  pr.submitted_at AS submittedAt,
                  pr.paid_at AS paidAt,
                  receipt.receipt_number AS receiptNumber
             FROM payment_references pr
             LEFT JOIN payment_receipts receipt
               ON receipt.payment_reference_id = pr.payment_reference_id
            WHERE pr.member_id = ?
              AND pr.payment_purpose = 'Share Capital'
              AND pr.related_entity_type = 'member_profile'
            ORDER BY pr.submitted_at DESC, pr.payment_reference_id DESC
            LIMIT 12`,
          [profile.id],
        ).then(([rows]) => rows),
      ]);
      const activePendingCapital = memberCapitalMoney(
        activeRows.reduce((total, row) => total + row.amount, 0),
      );
      const latest = activeRows[0] ?? null;
      return buildMemberShareCapitalSummary({
        profile,
        settings: input.settings,
        validatedCapital: validated,
        activePendingCapital,
        mode: input.mode,
        activeCheckout: latest?.checkoutUrl
          ? {
              paymentReferenceId: latest.paymentReferenceId,
              checkoutId: latest.checkoutId,
              checkoutUrl: latest.checkoutUrl,
              attemptNumber: latest.attemptNumber,
              gatewayStatus: latest.gatewayStatus,
              amount: latest.amount,
            }
          : null,
        history: historyRows.map((row) => ({
          ...row,
          amount: Number(row.amount),
        })),
      });
    },

    async prepareContribution(input) {
      return withTransaction(async (connection) => {
        const profile = await selectProfile(connection, input.userId, true);
        if (!profile) {
          throw new AppError(
            "A member profile is required to contribute Share Capital",
            404,
            "MEMBER_PROFILE_NOT_FOUND",
          );
        }
        assertMemberShareCapitalProfileEligible(profile);

        const [existingRequestRows] = await connection.execute<PaymentReferenceRow[]>(
          `SELECT CAST(p.payment_reference_id AS CHAR) AS id,
                  CAST(p.member_id AS CHAR) AS memberId,
                  CAST(m.user_id AS CHAR) AS memberUserId,
                  CAST(p.submitted_by AS CHAR) AS submittedBy,
                  p.payer_name AS payerName, p.payer_email AS payerEmail,
                  p.payer_contact AS payerContact, p.provider,
                  p.reference_number AS referenceNumber,
                  p.payment_purpose AS paymentPurpose,
                  p.related_entity_type AS relatedEntityType,
                  CAST(p.related_entity_id AS CHAR) AS relatedEntityId,
                  p.amount, p.validation_status AS validationStatus,
                  p.payment_channel AS paymentChannel,
                  p.gateway_environment AS gatewayEnvironment,
                  p.gateway_checkout_id AS gatewayCheckoutId,
                  p.gateway_payment_id AS gatewayPaymentId,
                  p.gateway_payment_intent_id AS gatewayPaymentIntentId,
                  p.gateway_status AS gatewayStatus,
                  p.idempotency_key AS idempotencyKey, p.paid_at AS paidAt,
                  p.client_request_id AS clientRequestId,
                  p.submitted_at AS submittedAt
             FROM payment_references p
             LEFT JOIN member_profiles m ON m.member_id = p.member_id
            WHERE p.client_request_id = ?
            LIMIT 1 FOR UPDATE`,
          [input.checkout.clientRequestId],
        );
        const existingRequest = existingRequestRows[0];
        if (existingRequest) {
          if (
            existingRequest.memberId !== profile.id
            || existingRequest.paymentPurpose !== "Share Capital"
            || memberCapitalMoney(Number(existingRequest.amount))
              !== memberCapitalMoney(input.checkout.requestedAmount)
          ) {
            throw new AppError(
              "This contribution request identifier conflicts with another payment",
              409,
              "MEMBER_SHARE_CAPITAL_REQUEST_CONFLICT",
            );
          }
          return mapPaymentReference(existingRequest);
        }

        const active = await activeContributions(connection, {
          memberId: profile.id,
          environment: input.environment,
          reuseMinutes: input.reuseMinutes,
          forUpdate: true,
        });
        if (active.length > 0) {
          throw new AppError(
            "A Share Capital PayMongo checkout is already active",
            409,
            "MEMBER_SHARE_CAPITAL_CHECKOUT_ACTIVE",
          );
        }
        const currentCapital = await validatedCapital(connection, profile.id);
        assertMemberShareCapitalCapacity({
          validatedCapital: currentCapital,
          activePendingCapital: 0,
          requestedAmount: input.checkout.requestedAmount,
          maximumShareCapital: input.settings.maximumShareCapital,
        });

        const placeholder = `SC-TMP-${crypto.randomUUID()}`;
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO payment_references
             (member_id, submitted_by, payer_name, payer_email, payer_contact,
              provider, payment_channel, gateway_environment, reference_number,
              payment_purpose, related_entity_type, related_entity_id, amount,
              validation_status, notes, client_request_id)
           VALUES (?, ?, ?, ?, ?, 'PayMongo Hosted Checkout', 'PayMongo', ?, ?,
                   'Share Capital', 'member_profile', ?, ?, 'Pending', ?, ?)`,
          [
            profile.id,
            input.userId,
            profile.fullName,
            profile.email,
            profile.contactNumber,
            input.environment,
            placeholder,
            profile.id,
            input.checkout.requestedAmount,
            "Authenticated Member Share Capital checkout. Confirmation depends on webhook settlement.",
            input.checkout.clientRequestId,
          ],
        );
        const paymentReferenceId = String(result.insertId);
        const referenceNumber = `SC-${new Date().getUTCFullYear()}-${String(result.insertId).padStart(6, "0")}`;
        await connection.execute(
          `UPDATE payment_references SET reference_number = ?
            WHERE payment_reference_id = ?`,
          [referenceNumber, paymentReferenceId],
        );
        await connection.execute(
          `INSERT INTO payment_validation_history
             (payment_reference_id, old_status, new_status, validation_source,
              reason, changed_by)
           VALUES (?, NULL, 'Pending', 'System', ?, ?)`,
          [
            paymentReferenceId,
            "Authenticated Member Share Capital PayMongo reference created.",
            input.userId,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'paymongo.member_share_capital_reference_created',
                   'payment_references', ?, ?, ?)`,
          [
            input.userId,
            paymentReferenceId,
            "A Member Share Capital PayMongo reference was created.",
            JSON.stringify({
              memberId: profile.id,
              referenceNumber,
              amount: input.checkout.requestedAmount,
              environment: input.environment,
              clientRequestId: input.checkout.clientRequestId,
            }),
          ],
        );
        const created = await selectPaymentReference(connection, paymentReferenceId);
        if (!created) {
          throw new AppError(
            "The Share Capital payment reference could not be loaded",
            500,
            "MEMBER_SHARE_CAPITAL_REFERENCE_CREATE_FAILED",
          );
        }
        return created;
      }, databasePool());
    },

    async assertCheckoutCapacity(input) {
      const connection = input.connection ?? databasePool();
      const profile = await selectProfile(connection, input.userId, Boolean(input.connection));
      if (!profile) {
        throw new AppError(
          "A member profile is required to contribute Share Capital",
          404,
          "MEMBER_PROFILE_NOT_FOUND",
        );
      }
      assertMemberShareCapitalProfileEligible(profile);
      const active = await activeContributions(connection, {
        memberId: profile.id,
        environment: input.environment,
        reuseMinutes: input.reuseMinutes,
        excludePaymentReferenceId: input.paymentReferenceId,
        forUpdate: Boolean(input.connection),
      });
      if (active.length > 0) {
        throw new AppError(
          "Another Share Capital PayMongo checkout is already active",
          409,
          "MEMBER_SHARE_CAPITAL_CHECKOUT_ACTIVE",
        );
      }
      assertMemberShareCapitalCapacity({
        validatedCapital: await validatedCapital(connection, profile.id),
        activePendingCapital: 0,
        requestedAmount: input.amount,
        maximumShareCapital: input.settings.maximumShareCapital,
      });
    },
  };
}
