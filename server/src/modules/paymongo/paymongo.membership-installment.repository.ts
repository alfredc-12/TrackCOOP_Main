import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type {
  PaymongoMembershipApplicationRecord,
  PaymongoMembershipCheckoutPurpose,
  PaymongoMembershipSettings,
  PaymongoOnlineGatewayEnvironment,
  PaymongoPaymentReferenceRecord,
} from "./paymongo.types";
import {
  buildPublicMembershipPaymentSummary,
  formatApplicationCapitalReference,
  roundMoney,
  validateApplicationShareCapitalAmount,
  type PublicLatestCheckoutState,
  type PublicMembershipPaymentSummary,
} from "./paymongo.membership-installment.rules";
import {
  insertPaymentReference,
  latestPendingReference,
  lockApplication,
  paymentAggregate,
  selectRequirement,
  type RequirementRow,
} from "./paymongo.membership-installment.queries";

const inactiveGatewayStatuses = new Set(["expired", "paid", "cancelled", "canceled"]);

type SequenceRow = RowDataPacket & { nextSequence: string | number | null };
type LatestCheckoutRow = RowDataPacket & {
  paymentPurpose: PaymongoMembershipCheckoutPurpose;
  referenceNumber: string;
  amount: string | number;
  gatewayStatus: string | null;
  createdAt: Date;
  reusableUntil: Date;
  supersededAt: Date | null;
  completedAt: Date | null;
};

export {
  buildPublicMembershipPaymentSummary,
  formatApplicationCapitalReference,
  validateApplicationShareCapitalAmount,
} from "./paymongo.membership-installment.rules";
export type { PublicMembershipPaymentSummary } from "./paymongo.membership-installment.rules";

export interface PaymongoMembershipInstallmentRepository {
  prepareMembershipPaymentReference(input: {
    application: PaymongoMembershipApplicationRecord;
    purpose: PaymongoMembershipCheckoutPurpose;
    requestedAmount: number;
    settings: PaymongoMembershipSettings;
    environment: PaymongoOnlineGatewayEnvironment;
  }): Promise<PaymongoPaymentReferenceRecord>;
  assertCheckoutCapacity(input: {
    connection?: PoolConnection | null;
    applicationId: string;
    paymentReferenceId: string;
    purpose: PaymongoMembershipCheckoutPurpose;
    amount: number;
    settings: PaymongoMembershipSettings;
    environment: PaymongoOnlineGatewayEnvironment;
  }): Promise<void>;
  publicPaymentSummary(input: {
    application: PaymongoMembershipApplicationRecord;
    settings: PaymongoMembershipSettings;
    environment: PaymongoOnlineGatewayEnvironment;
    gatewayEnabled: boolean;
    mode: "test" | "live";
  }): Promise<PublicMembershipPaymentSummary>;
}

export function createPaymongoMembershipInstallmentRepository(
  pool?: Pool,
): PaymongoMembershipInstallmentRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async prepareMembershipPaymentReference(input) {
      return withTransaction(async (connection) => {
        const application = await lockApplication(connection, input.application.id);
        const requirement = await selectRequirement(
          connection,
          input.application.id,
          input.purpose,
        );

        if (input.purpose === "Share Capital" && application.requestedMembershipType !== "True Member") {
          throw new AppError(
            "Share capital checkout is only available for True Member applicants",
            409,
            "SHARE_CAPITAL_TRUE_MEMBER_REQUIRED",
          );
        }

        const aggregate = await paymentAggregate(connection, {
          applicationId: input.application.id,
          purpose: input.purpose,
          environment: input.environment,
        });
        const pendingReference = await latestPendingReference(
          connection,
          input.application.id,
          input.purpose,
        );

        if (input.purpose === "Associate Membership Fee") {
          if (aggregate.validatedAmount >= input.settings.associateFee) {
            throw new AppError(
              "The associate membership fee has already been paid",
              409,
              "MEMBERSHIP_FEE_ALREADY_VALIDATED",
            );
          }
          if (pendingReference) return pendingReference;
          return insertPaymentReference({
            connection,
            application: input.application,
            purpose: input.purpose,
            amount: roundMoney(input.settings.associateFee),
            referenceNumber: `${input.application.applicationCode}-FEE`,
            requirement,
          });
        }

        if (pendingReference) {
          if (pendingReference.paymentChannel !== "PayMongo") {
            throw new AppError(
              "A Share Capital payment is already pending review",
              409,
              "SHARE_CAPITAL_PAYMENT_PENDING_REVIEW",
            );
          }
          if (roundMoney(pendingReference.amount) !== roundMoney(input.requestedAmount)) {
            throw new AppError(
              "Continue the existing Share Capital installment using its original amount",
              409,
              "SHARE_CAPITAL_PENDING_AMOUNT_MISMATCH",
            );
          }
          return pendingReference;
        }

        validateApplicationShareCapitalAmount({
          requestedAmount: input.requestedAmount,
          validatedAmount: aggregate.validatedAmount,
          otherActivePendingAmount: aggregate.pendingAmount,
          initialShareCapital: input.settings.initialShareCapital,
          maximumShareCapital: input.settings.maximumShareCapital,
        });

        const [sequenceRows] = await connection.execute<SequenceRow[]>(
          `SELECT COALESCE(MAX(CASE
                    WHEN reference_number REGEXP '-CAP-[0-9]{3}$'
                    THEN CAST(SUBSTRING_INDEX(reference_number, '-CAP-', -1) AS UNSIGNED)
                    ELSE 0 END), 0) + 1 AS nextSequence
             FROM payment_references
            WHERE related_entity_type = 'membership_application'
              AND related_entity_id = ?
              AND payment_purpose = 'Share Capital'`,
          [input.application.id],
        );
        const nextSequence = Number(sequenceRows[0]?.nextSequence ?? 1);

        return insertPaymentReference({
          connection,
          application: input.application,
          purpose: input.purpose,
          amount: roundMoney(input.requestedAmount),
          referenceNumber: formatApplicationCapitalReference(
            input.application.applicationCode,
            nextSequence,
          ),
          requirement,
        });
      }, databasePool());
    },

    async assertCheckoutCapacity(input) {
      const check = async (connection: PoolConnection) => {
        const application = await lockApplication(connection, input.applicationId);
        if (input.purpose === "Share Capital" && application.requestedMembershipType !== "True Member") {
          throw new AppError(
            "Share capital checkout is only available for True Member applicants",
            409,
            "SHARE_CAPITAL_TRUE_MEMBER_REQUIRED",
          );
        }

        const aggregate = await paymentAggregate(connection, {
          applicationId: input.applicationId,
          purpose: input.purpose,
          environment: input.environment,
          excludePaymentReferenceId: input.paymentReferenceId,
        });

        if (input.purpose === "Associate Membership Fee") {
          if (aggregate.validatedAmount >= input.settings.associateFee) {
            throw new AppError(
              "The associate membership fee has already been paid",
              409,
              "MEMBERSHIP_FEE_ALREADY_VALIDATED",
            );
          }
          if (roundMoney(input.amount) !== roundMoney(input.settings.associateFee)) {
            throw new AppError(
              "Associate membership fee amount does not match the configured fee",
              409,
              "MEMBERSHIP_FEE_AMOUNT_MISMATCH",
            );
          }
          return;
        }

        validateApplicationShareCapitalAmount({
          requestedAmount: input.amount,
          validatedAmount: aggregate.validatedAmount,
          otherActivePendingAmount: aggregate.pendingAmount,
          initialShareCapital: input.settings.initialShareCapital,
          maximumShareCapital: input.settings.maximumShareCapital,
        });
      };

      if (input.connection) {
        await check(input.connection);
        return;
      }
      await withTransaction(check, databasePool());
    },

    async publicPaymentSummary(input) {
      const [fee, capital] = await Promise.all([
        paymentAggregate(databasePool(), {
          applicationId: input.application.id,
          purpose: "Associate Membership Fee",
          environment: input.environment,
        }),
        paymentAggregate(databasePool(), {
          applicationId: input.application.id,
          purpose: "Share Capital",
          environment: input.environment,
        }),
      ]);

      const [requirementRows] = await databasePool().execute<RequirementRow[]>(
        `SELECT CAST(membership_application_requirement_id AS CHAR) AS id,
                requirement_type AS requirementType,
                requirement_status AS requirementStatus,
                CAST(payment_reference_id AS CHAR) AS paymentReferenceId
           FROM membership_application_requirements
          WHERE membership_application_id = ?
            AND requirement_type IN ('Associate Membership Fee', 'Initial Share Capital')`,
        [input.application.id],
      );
      const feeRequirement = requirementRows.find(
        (row) => row.requirementType === "Associate Membership Fee",
      );
      if (!feeRequirement) {
        throw new AppError(
          "The membership fee requirement was not found",
          409,
          "MEMBERSHIP_PAYMENT_REQUIREMENT_NOT_FOUND",
        );
      }
      const capitalRequirement = requirementRows.find(
        (row) => row.requirementType === "Initial Share Capital",
      ) ?? null;

      const [latestRows] = await databasePool().execute<LatestCheckoutRow[]>(
        `SELECT pr.payment_purpose AS paymentPurpose,
                pr.reference_number AS referenceNumber,
                pr.amount,
                a.gateway_status AS gatewayStatus,
                a.created_at AS createdAt,
                a.reusable_until AS reusableUntil,
                a.superseded_at AS supersededAt,
                a.completed_at AS completedAt
           FROM payment_gateway_checkout_attempts a
           JOIN payment_references pr
             ON pr.payment_reference_id = a.payment_reference_id
          WHERE pr.related_entity_type = 'membership_application'
            AND pr.related_entity_id = ?
            AND pr.payment_purpose IN ('Associate Membership Fee', 'Share Capital')
            AND a.gateway_environment = ?
          ORDER BY a.created_at DESC, a.payment_gateway_checkout_attempt_id DESC
          LIMIT 1`,
        [input.application.id, input.environment],
      );
      const latest = latestRows[0];
      const normalizedStatus = latest?.gatewayStatus?.trim().toLowerCase() ?? "active";
      const latestCheckout: PublicLatestCheckoutState = latest
        ? {
            paymentPurpose: latest.paymentPurpose,
            referenceNumber: latest.referenceNumber,
            amount: Number(latest.amount),
            gatewayStatus: latest.gatewayStatus?.trim() || "active",
            createdAt: latest.createdAt,
            reusableUntil: latest.reusableUntil,
            isReusable: latest.reusableUntil.getTime() > Date.now()
              && !latest.supersededAt
              && !latest.completedAt
              && !inactiveGatewayStatuses.has(normalizedStatus),
          }
        : null;

      return buildPublicMembershipPaymentSummary({
        mode: input.mode,
        gatewayEnabled: input.gatewayEnabled,
        applicationStatus: input.application.applicationStatus,
        requestedMembershipType: input.application.requestedMembershipType,
        settings: input.settings,
        feeValidatedAmount: fee.validatedAmount,
        feePendingAmount: fee.pendingAmount,
        capitalValidatedAmount: capital.validatedAmount,
        capitalPendingAmount: capital.pendingAmount,
        installmentCount: capital.installmentCount,
        latestCheckout,
        feeRequirementStatus: feeRequirement.requirementStatus,
        capitalRequirementStatus: capitalRequirement?.requirementStatus ?? null,
      });
    },
  };
}
