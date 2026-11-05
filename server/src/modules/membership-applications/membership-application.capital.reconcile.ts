import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import { postShareCapitalPaymentToLedger } from "../share-capital/share-capital-ledger.repository";
import {
  assertNoMemberLinkConflicts,
  existingCapitalPaymentReferenceIds,
  loadApplicationCapitalReferencesForUpdate,
  otherValidatedMemberCapital,
} from "./membership-application.capital.queries";
import {
  buildCapitalConversionPlan,
  capitalMoney,
} from "./membership-application.capital.rules";
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
  // Match the member-first lock used by the shared ledger/capacity workflow.
  // The caller owns this transaction; retries and posting failures roll back together.
  const [members] = await input.connection.execute<
    (RowDataPacket & { id: string })[]
  >(
    "SELECT CAST(member_id AS CHAR) AS id FROM member_profiles WHERE member_id = ? FOR UPDATE",
    [input.memberId],
  );
  if (!members[0])
    throw new AppError(
      "Member profile was not found",
      404,
      "MEMBER_PROFILE_NOT_FOUND",
    );
  const references =
    input.references ??
    (await loadApplicationCapitalReferencesForUpdate(
      input.connection,
      input.applicationId,
    ));
  const existingIds = await existingCapitalPaymentReferenceIds(
    input.connection,
    input.applicationId,
  );
  const plan = buildCapitalConversionPlan({
    references,
    existingPaymentReferenceIds: existingIds,
    maximumShareCapital: input.maximumShareCapital,
  });

  const otherCapital = capitalMoney(
    await otherValidatedMemberCapital(
      input.connection,
      input.memberId,
      input.applicationId,
    ),
  );
  if (
    capitalMoney(otherCapital + plan.validatedTotal) >
    capitalMoney(input.maximumShareCapital)
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

  // Visit all validated references, not only newly inserted rows: an earlier
  // reconciliation may have created its payment row without posting a ledger credit.
  for (const reference of plan.validatedReferences) {
    const [payments] = await input.connection.execute<
      (RowDataPacket & {
        id: string;
        memberId: string;
        amount: string | number;
        paymentStatus: string;
      })[]
    >(
      `SELECT CAST(share_payment_id AS CHAR) AS id, CAST(member_id AS CHAR) AS memberId,
              amount, payment_status AS paymentStatus
         FROM share_capital_payments WHERE payment_reference_id = ? LIMIT 1 FOR UPDATE`,
      [reference.paymentReferenceId],
    );
    const payment = payments[0];
    if (
      !payment ||
      String(payment.memberId) !== input.memberId ||
      payment.paymentStatus !== "Validated" ||
      capitalMoney(Number(payment.amount)) !== capitalMoney(reference.amount)
    ) {
      throw new AppError(
        "Reconciled Share Capital does not match the validated application payment; review the existing record",
        409,
        "MEMBERSHIP_CAPITAL_POSTING_CONFLICT",
      );
    }
    await postShareCapitalPaymentToLedger({
      connection: input.connection,
      memberId: input.memberId,
      sharePaymentId: String(payment.id),
      amount: reference.amount,
      transactionDate: paymentDate(reference),
      referenceNumber: reference.referenceNumber,
      createdBy: input.actorUserId,
      remarks: `Pre-approval Share Capital from ${input.applicationCode} (${reference.referenceNumber}).`,
    });
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
