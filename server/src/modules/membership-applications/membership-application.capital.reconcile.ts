import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import {
  assertNoMemberLinkConflicts,
  existingCapitalPaymentReferenceIds,
  loadApplicationCapitalReferencesForUpdate,
  otherValidatedMemberCapital,
} from "./membership-application.capital.queries";
import { buildCapitalConversionPlan, capitalMoney } from "./membership-application.capital.rules";
import type {
  ApplicationCapitalReference,
  CapitalReconciliationResult,
} from "./membership-application.capital.types";

function paymentDate(reference: ApplicationCapitalReference) {
  return (reference.paidAt ?? reference.validatedAt ?? reference.submittedAt)
    .toISOString()
    .slice(0, 10);
}

export async function reconcileApplicationCapital(input: {
  connection: PoolConnection;
  applicationId: string;
  applicationCode: string;
  memberId: string;
  actorUserId: string;
  maximumShareCapital: number;
  references?: ApplicationCapitalReference[];
}): Promise<CapitalReconciliationResult> {
  const references = input.references
    ?? await loadApplicationCapitalReferencesForUpdate(
      input.connection,
      input.applicationId,
    );
  const existingIds = await existingCapitalPaymentReferenceIds(
    input.connection,
    input.applicationId,
  );
  const plan = buildCapitalConversionPlan({
    references,
    existingPaymentReferenceIds: existingIds,
    maximumShareCapital: input.maximumShareCapital,
  });

  const otherCapital = capitalMoney(await otherValidatedMemberCapital(
    input.connection,
    input.memberId,
    input.applicationId,
  ));
  if (
    capitalMoney(otherCapital + plan.validatedTotal)
    > capitalMoney(input.maximumShareCapital)
  ) {
    throw new AppError(
      "Validated share capital cannot exceed PHP 15,000",
      409,
      "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
    );
  }

  await assertNoMemberLinkConflicts(
    input.connection,
    input.applicationId,
    input.memberId,
  );

  let insertedCapitalRows = 0;
  for (const reference of plan.missingReferences) {
    const [result] = await input.connection.execute<ResultSetHeader>(
      `INSERT INTO share_capital_payments
         (member_id, payment_reference_id, amount, payment_date, payment_status,
          verified_by, verified_at, remarks)
       SELECT ?, ?, ?, ?, 'Validated', ?, COALESCE(?, UTC_TIMESTAMP()), ?
        WHERE NOT EXISTS (
          SELECT 1 FROM share_capital_payments WHERE payment_reference_id = ?
        )`,
      [
        input.memberId,
        reference.paymentReferenceId,
        reference.amount,
        paymentDate(reference),
        reference.validatedBy ?? input.actorUserId,
        reference.validatedAt,
        `Pre-approval Share Capital preserved from ${input.applicationCode} (${reference.referenceNumber}).`,
        reference.paymentReferenceId,
      ],
    );
    insertedCapitalRows += result.affectedRows;
  }

  const [paymentLink] = await input.connection.execute<ResultSetHeader>(
    `UPDATE payment_references
        SET member_id = ?, updated_at = UTC_TIMESTAMP()
      WHERE related_entity_type = 'membership_application'
        AND related_entity_id = ?
        AND validation_status = 'Validated'
        AND payment_purpose IN ('Associate Membership Fee', 'Share Capital')
        AND (member_id IS NULL OR member_id = ?)`,
    [input.memberId, input.applicationId, input.memberId],
  );
  const [financeLink] = await input.connection.execute<ResultSetHeader>(
    `UPDATE financial_records fr
       JOIN payment_references pr
         ON pr.payment_reference_id = fr.payment_reference_id
        SET fr.member_id = ?, fr.updated_at = UTC_TIMESTAMP()
      WHERE pr.related_entity_type = 'membership_application'
        AND pr.related_entity_id = ?
        AND pr.validation_status = 'Validated'
        AND pr.payment_purpose IN ('Associate Membership Fee', 'Share Capital')
        AND (fr.member_id IS NULL OR fr.member_id = ?)`,
    [input.memberId, input.applicationId, input.memberId],
  );

  return {
    applicationId: input.applicationId,
    memberId: input.memberId,
    validatedCapitalAmount: plan.validatedTotal,
    validatedReferenceCount: plan.validatedReferences.length,
    insertedCapitalRows,
    linkedPaymentReferences: paymentLink.affectedRows,
    linkedFinancialRecords: financeLink.affectedRows,
  };
}
