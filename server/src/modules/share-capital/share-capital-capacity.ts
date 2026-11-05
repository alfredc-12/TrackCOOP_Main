import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { MAX_SHARE_CAPITAL } from "./share-capital.constants";

type Executor = Pick<Pool | PoolConnection, "execute">;

type CapacitySnapshotRow = RowDataPacket & {
  ledgerBalance: string | number | null;
  unpostedValidatedPayments: string | number | null;
  validatedPayments: string | number | null;
  activePendingQrph: string | number | null;
  pendingPatronageTransfers: string | number | null;
  pendingDividendCapitalizations: string | number | null;
};

export type MemberShareCapitalGatewayEnvironment = "Test" | "Live";

export type MemberShareCapitalCapacityOptions = {
  memberId: string;
  lockMember?: boolean;
  currentAccountBalance?: number;
  excludingPaymentId?: string;
  excludePaymentReferenceId?: string;
  excludeTransferId?: string;
  excludeDividendId?: string;
  reuseMinutes?: number;
  maximumShareCapital?: number;
  gatewayEnvironment?: MemberShareCapitalGatewayEnvironment;
};

export type MemberShareCapitalCapacitySnapshot = {
  committedCapital: number;
  ledgerBalance: number;
  unpostedValidatedPayments: number;
  validatedPayments: number;
  activePendingQrph: number;
  pendingPatronageTransfers: number;
  pendingDividendCapitalizations: number;
  reservedCapital: number;
  totalCommittedAndReserved: number;
  maximumShareCapital: number;
  availableCapacity: number;
};

export function shareCapitalCents(value: number | string | null | undefined) {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100);
}

export function shareCapitalMoney(value: number | string | null | undefined) {
  return shareCapitalCents(value) / 100;
}

export function activePaymongoGatewayEnvironment(): MemberShareCapitalGatewayEnvironment {
  return env.PAYMONGO_MODE === "live" ? "Live" : "Test";
}

export async function selectMemberShareCapitalCapacity(
  executor: Executor,
  options: MemberShareCapitalCapacityOptions,
): Promise<MemberShareCapitalCapacitySnapshot> {
  if (options.lockMember) {
    await executor.execute(
      `SELECT member_id
         FROM member_profiles
        WHERE member_id = ?
        LIMIT 1 FOR UPDATE`,
      [options.memberId],
    );
  }

  const reuseMinutes = options.reuseMinutes ?? env.PAYMONGO_CHECKOUT_REUSE_MINUTES;
  const gatewayEnvironment = options.gatewayEnvironment ?? activePaymongoGatewayEnvironment();
  const maximumShareCapital = shareCapitalMoney(
    options.maximumShareCapital ?? MAX_SHARE_CAPITAL,
  );

  const excludedPostedPaymentSql = options.excludingPaymentId
    ? `COALESCE((
        SELECT s.amount
          FROM share_capital_payments s
         WHERE s.share_payment_id = ?
           AND s.member_id = ?
           AND s.payment_status = 'Validated'
           AND EXISTS (
             SELECT 1
               FROM share_capital_transactions t
              WHERE t.member_id = s.member_id
                AND t.source_type = 'share_capital_payment'
                AND t.source_id = s.share_payment_id
                AND t.transaction_status = 'Posted'
           )
      ), 0)`
    : "0";
  const excludePaymentClause = options.excludingPaymentId
    ? " AND s.share_payment_id <> ?"
    : "";
  const excludeReferenceInPaymentsClause = options.excludePaymentReferenceId
    ? " AND (s.payment_reference_id IS NULL OR s.payment_reference_id <> ?)"
    : "";
  const excludeReferenceClause = options.excludePaymentReferenceId
    ? " AND pr.payment_reference_id <> ?"
    : "";
  const excludeTransferClause = options.excludeTransferId
    ? " AND t.transfer_id <> ?"
    : "";
  const excludeDividendClause = options.excludeDividendId
    ? " AND md.member_dividend_id <> ?"
    : "";

  const params: Array<string | number> = [
    options.memberId,
    ...(options.excludingPaymentId ? [options.excludingPaymentId, options.memberId] : []),
    options.memberId,
    ...(options.excludingPaymentId ? [options.excludingPaymentId] : []),
    ...(options.excludePaymentReferenceId ? [options.excludePaymentReferenceId] : []),
    options.memberId,
    ...(options.excludingPaymentId ? [options.excludingPaymentId] : []),
    ...(options.excludePaymentReferenceId ? [options.excludePaymentReferenceId] : []),
    options.memberId,
    gatewayEnvironment,
    gatewayEnvironment,
    gatewayEnvironment,
    reuseMinutes,
    ...(options.excludePaymentReferenceId ? [options.excludePaymentReferenceId] : []),
    options.memberId,
    ...(options.excludeTransferId ? [options.excludeTransferId] : []),
    options.memberId,
    ...(options.excludeDividendId ? [options.excludeDividendId] : []),
  ];

  const [rows] = await executor.execute<CapacitySnapshotRow[]>(
    `SELECT GREATEST(
              COALESCE((SELECT current_balance FROM share_capital_accounts WHERE member_id = ? LIMIT 1), 0) - ${excludedPostedPaymentSql},
              0
            ) AS ledgerBalance,
            COALESCE(
              (SELECT SUM(s.amount)
                 FROM share_capital_payments s
                WHERE s.member_id = ?
                  AND s.payment_status = 'Validated'${excludePaymentClause}${excludeReferenceInPaymentsClause}
                  AND NOT EXISTS (
                    SELECT 1
                      FROM share_capital_transactions t
                     WHERE t.member_id = s.member_id
                       AND t.source_type = 'share_capital_payment'
                       AND t.source_id = s.share_payment_id
                       AND t.transaction_status = 'Posted'
                  )),
              0
            ) AS unpostedValidatedPayments,
            COALESCE(
              (SELECT SUM(s.amount)
                 FROM share_capital_payments s
                WHERE s.member_id = ?
                  AND s.payment_status = 'Validated'${excludePaymentClause}${excludeReferenceInPaymentsClause}),
              0
            ) AS validatedPayments,
            COALESCE(
              (SELECT SUM(pr.amount)
                 FROM payment_references pr
                WHERE pr.member_id = ?
                  AND pr.payment_purpose = 'Share Capital'
                  AND pr.related_entity_type = 'member_profile'
                  AND pr.payment_channel = 'PayMongo'
                  AND pr.gateway_environment = ?
                  AND pr.validation_status IN ('Pending', 'Needs Clarification')
                  AND (
                    EXISTS (
                      SELECT 1
                        FROM payment_gateway_checkout_attempts a
                       WHERE a.payment_reference_id = pr.payment_reference_id
                         AND a.payment_gateway_checkout_attempt_id = (
                           SELECT MAX(latest.payment_gateway_checkout_attempt_id)
                             FROM payment_gateway_checkout_attempts latest
                            WHERE latest.payment_reference_id = pr.payment_reference_id
                              AND latest.gateway_name = 'PayMongo'
                              AND latest.gateway_environment = ?
                         )
                         AND a.checkout_url IS NOT NULL
                         AND a.reusable_until > UTC_TIMESTAMP()
                         AND a.superseded_at IS NULL
                         AND a.completed_at IS NULL
                         AND LOWER(COALESCE(a.gateway_status, 'active')) NOT IN ('expired', 'paid', 'cancelled', 'canceled')
                    )
                    OR (
                      NOT EXISTS (
                        SELECT 1
                          FROM payment_gateway_checkout_attempts a
                         WHERE a.payment_reference_id = pr.payment_reference_id
                           AND a.gateway_name = 'PayMongo'
                           AND a.gateway_environment = ?
                      )
                      AND pr.submitted_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)
                    )
                  )${excludeReferenceClause}),
              0
            ) AS activePendingQrph,
            COALESCE(
              (SELECT SUM(t.amount)
                 FROM patronage_capital_transfers t
                WHERE t.member_id = ?
                  AND t.transfer_status = 'Pending'${excludeTransferClause}),
              0
            ) AS pendingPatronageTransfers,
            COALESCE(
              (SELECT SUM(md.dividend_amount)
                 FROM member_dividends md
                WHERE md.member_id = ?
                  AND md.dividend_status = 'Capitalization Requested'${excludeDividendClause}),
              0
            ) AS pendingDividendCapitalizations`,
    params,
  );

  const row = rows[0];
  const ledgerBalanceCents = Math.max(
    shareCapitalCents(row?.ledgerBalance ?? 0),
    options.currentAccountBalance !== undefined
      ? shareCapitalCents(options.currentAccountBalance)
      : 0,
  );
  const unpostedValidatedPaymentsCents = Math.max(
    0,
    shareCapitalCents(row?.unpostedValidatedPayments ?? 0),
  );
  const validatedPaymentsCents = Math.max(
    0,
    shareCapitalCents(row?.validatedPayments ?? 0),
  );
  const committedCents = Math.max(
    0,
    ledgerBalanceCents + unpostedValidatedPaymentsCents,
    validatedPaymentsCents,
  );
  const activePendingQrphCents = Math.max(0, shareCapitalCents(row?.activePendingQrph ?? 0));
  const pendingPatronageCents = Math.max(0, shareCapitalCents(row?.pendingPatronageTransfers ?? 0));
  const pendingDividendCents = Math.max(0, shareCapitalCents(row?.pendingDividendCapitalizations ?? 0));
  const reservedCents = activePendingQrphCents + pendingPatronageCents + pendingDividendCents;
  const totalCommittedAndReservedCents = committedCents + reservedCents;
  const maxCents = shareCapitalCents(maximumShareCapital);
  const availableCents = Math.max(0, maxCents - totalCommittedAndReservedCents);

  return {
    committedCapital: committedCents / 100,
    ledgerBalance: ledgerBalanceCents / 100,
    unpostedValidatedPayments: unpostedValidatedPaymentsCents / 100,
    validatedPayments: validatedPaymentsCents / 100,
    activePendingQrph: activePendingQrphCents / 100,
    pendingPatronageTransfers: pendingPatronageCents / 100,
    pendingDividendCapitalizations: pendingDividendCents / 100,
    reservedCapital: reservedCents / 100,
    totalCommittedAndReserved: totalCommittedAndReservedCents / 100,
    maximumShareCapital,
    availableCapacity: availableCents / 100,
  };
}

export async function assertLockedMemberShareCapitalCapacity(
  executor: Executor,
  input: MemberShareCapitalCapacityOptions & {
    requestedAmount: number;
    errorMessage?: string;
    errorCode?: string;
  },
): Promise<MemberShareCapitalCapacitySnapshot> {
  const requestedCents = shareCapitalCents(input.requestedAmount);
  if (!Number.isFinite(input.requestedAmount) || requestedCents <= 0) {
    throw new AppError(
      "Share Capital transaction amount must be positive",
      422,
      "SHARE_CAPITAL_LEDGER_AMOUNT_INVALID",
    );
  }

  const snapshot = await selectMemberShareCapitalCapacity(executor, {
    ...input,
    lockMember: input.lockMember ?? true,
  });

  if (
    shareCapitalCents(snapshot.totalCommittedAndReserved) + requestedCents
    > shareCapitalCents(snapshot.maximumShareCapital)
  ) {
    throw new AppError(
      input.errorMessage ?? "Validated share capital cannot exceed PHP 15,000",
      409,
      input.errorCode ?? "SHARE_CAPITAL_LIMIT_EXCEEDED",
    );
  }

  return snapshot;
}
