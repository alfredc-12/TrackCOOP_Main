import type { PoolConnection } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import { synchronizedInitialCapitalRequirementStatus } from "../membership-applications/membership-application.capital";
import { insertSettlementFinanceRecord } from "./paymongo.settlement.finance";
import {
  memberCapitalOutsideApplication,
  membershipNumberSetting,
  selectSettlementApplication,
  selectSettlementRequirement,
  settlementMoney,
  settlementRecordDate,
  validatedApplicationPaymentTotal,
} from "./paymongo.settlement.queries";
import type {
  GatewaySettlementDetails,
  MembershipApplicationSettlementRow,
  PaymentReferenceForSettlement,
  RequirementSettlementRow,
} from "./paymongo.settlement.types";

async function synchronizeFeeRequirement(input: {
  connection: PoolConnection;
  application: MembershipApplicationSettlementRow;
  payment: PaymentReferenceForSettlement;
  requirement: RequirementSettlementRow;
  actorUserId: string;
}) {
  const expectedFee = await membershipNumberSetting(
    input.connection,
    "membership.associate_fee",
    200,
  );
  if (settlementMoney(Number(input.payment.amount)) !== settlementMoney(expectedFee)) {
    throw new AppError(
      "Associate membership fee amount does not match the configured fee",
      422,
      "MEMBERSHIP_FEE_AMOUNT_MISMATCH",
    );
  }

  const validatedFee = await validatedApplicationPaymentTotal(
    input.connection,
    input.application.id,
    "Associate Membership Fee",
  );
  if (
    validatedFee >= settlementMoney(expectedFee)
    && input.requirement.requirementStatus !== "Waived"
  ) {
    await input.connection.execute(
      `UPDATE membership_application_requirements
          SET requirement_status = 'Verified',
              payment_reference_id = ?,
              completion_date = COALESCE(completion_date, UTC_DATE()),
              verified_by = COALESCE(verified_by, ?),
              verified_at = COALESCE(verified_at, UTC_TIMESTAMP()),
              remarks = 'Validated application-related membership fee references satisfy the configured fee.'
        WHERE membership_application_requirement_id = ?`,
      [input.payment.id, input.actorUserId, input.requirement.id],
    );
  }
}

async function synchronizeCapitalRequirement(input: {
  connection: PoolConnection;
  application: MembershipApplicationSettlementRow;
  payment: PaymentReferenceForSettlement;
  requirement: RequirementSettlementRow;
  actorUserId: string;
}) {
  const [maximum, initial, applicationCapital] = await Promise.all([
    membershipNumberSetting(
      input.connection,
      "membership.maximum_share_capital",
      15000,
    ),
    membershipNumberSetting(
      input.connection,
      "membership.initial_share_capital",
      1500,
    ),
    validatedApplicationPaymentTotal(
      input.connection,
      input.application.id,
      "Share Capital",
    ),
  ]);
  const otherMemberCapital = await memberCapitalOutsideApplication(
    input.connection,
    input.application.convertedMemberId,
    input.application.id,
  );
  if (
    settlementMoney(applicationCapital + otherMemberCapital)
    > settlementMoney(maximum)
  ) {
    throw new AppError(
      "Share capital payment would exceed the maximum allowed amount",
      409,
      "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
    );
  }

  const nextStatus = synchronizedInitialCapitalRequirementStatus({
    currentStatus: input.requirement.requirementStatus,
    validatedCapitalAmount: applicationCapital,
    initialShareCapital: initial,
  });
  if (
    nextStatus === "Verified"
    && input.requirement.requirementStatus !== "Waived"
  ) {
    await input.connection.execute(
      `UPDATE membership_application_requirements
          SET requirement_status = 'Verified',
              payment_reference_id = ?,
              completion_date = COALESCE(completion_date, UTC_DATE()),
              verified_by = COALESCE(verified_by, ?),
              verified_at = COALESCE(verified_at, UTC_TIMESTAMP()),
              remarks = 'Aggregate validated application-related Share Capital meets the configured initial requirement.'
        WHERE membership_application_requirement_id = ?`,
      [input.payment.id, input.actorUserId, input.requirement.id],
    );
  } else if (input.requirement.requirementStatus !== "Waived") {
    await input.connection.execute(
      `UPDATE membership_application_requirements
          SET payment_reference_id = ?,
              remarks = ?
        WHERE membership_application_requirement_id = ?`,
      [
        input.payment.id,
        `Validated Share Capital total is PHP ${applicationCapital.toFixed(2)}; the configured initial requirement is not yet met.`,
        input.requirement.id,
      ],
    );
  }
}

async function synchronizeMembershipRequirement(input: {
  connection: PoolConnection;
  application: MembershipApplicationSettlementRow;
  payment: PaymentReferenceForSettlement;
  requirement: RequirementSettlementRow;
  actorUserId: string;
}) {
  if (input.payment.paymentPurpose === "Associate Membership Fee") {
    await synchronizeFeeRequirement(input);
    return;
  }
  await synchronizeCapitalRequirement(input);
}

export async function postMembershipSettlement(input: {
  connection: PoolConnection;
  payment: PaymentReferenceForSettlement;
  actorUserId: string;
  gatewayDetails?: GatewaySettlementDetails | null;
}) {
  if (
    input.payment.relatedEntityType !== "membership_application"
    || !input.payment.relatedEntityId
  ) {
    throw new AppError(
      "Membership settlement requires a linked application",
      422,
      "PAYMENT_SETTLEMENT_ENTITY_INVALID",
    );
  }

  const application = await selectSettlementApplication(
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
  const requirement = await selectSettlementRequirement(
    input.connection,
    application.id,
    input.payment.paymentPurpose,
  );
  if (!requirement) {
    throw new AppError(
      "Linked membership payment requirement was not found",
      409,
      "MEMBERSHIP_PAYMENT_REQUIREMENT_NOT_FOUND",
    );
  }

  await synchronizeMembershipRequirement({
    connection: input.connection,
    application,
    payment: input.payment,
    requirement,
    actorUserId: input.actorUserId,
  });

  if (
    application.convertedMemberId
    && input.payment.memberId
    && input.payment.memberId !== application.convertedMemberId
  ) {
    throw new AppError(
      "The membership payment is linked to another member",
      409,
      "MEMBERSHIP_PAYMENT_MEMBER_CONFLICT",
    );
  }

  if (application.convertedMemberId) {
    await input.connection.execute(
      `UPDATE payment_references
          SET member_id = ?, updated_at = UTC_TIMESTAMP()
        WHERE payment_reference_id = ?
          AND (member_id IS NULL OR member_id = ?)`,
      [application.convertedMemberId, input.payment.id, application.convertedMemberId],
    );
  }

  const financeCreated = await insertSettlementFinanceRecord({
    connection: input.connection,
    payment: input.payment,
    application,
    actorUserId: input.actorUserId,
    gatewayDetails: input.gatewayDetails,
  });

  if (input.payment.paymentPurpose === "Share Capital" && application.convertedMemberId) {
    await input.connection.execute(
      `INSERT INTO share_capital_payments
         (member_id, payment_reference_id, amount, payment_date, payment_status,
          verified_by, verified_at, remarks)
       SELECT ?, ?, ?, ?, 'Validated', ?, UTC_TIMESTAMP(), ?
        WHERE NOT EXISTS (
          SELECT 1 FROM share_capital_payments WHERE payment_reference_id = ?
        )`,
      [
        application.convertedMemberId,
        input.payment.id,
        input.payment.amount,
        settlementRecordDate(input.gatewayDetails?.paidAt),
        input.actorUserId,
        `Share capital settlement for ${application.applicationCode}`,
        input.payment.id,
      ],
    );
  }

  return {
    financeCreated,
    shareCapitalCreated: input.payment.paymentPurpose === "Share Capital"
      && Boolean(application.convertedMemberId),
    memberId: application.convertedMemberId,
    memberUserId: application.memberUserId,
    applicationId: application.id,
    applicationStatus: application.applicationStatus,
    subjectReference: application.applicationCode,
    subjectName: application.fullName,
  };
}
