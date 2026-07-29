import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type {
  ApplicationCapitalReference,
  ApplicationCapitalValidationStatus,
} from "./membership-application.capital.types";

export type CountRow = RowDataPacket & { total: string | number };
type ExistingCapitalRow = RowDataPacket & { paymentReferenceId: string };
type CapitalReferenceRow = RowDataPacket & {
  paymentReferenceId: string;
  referenceNumber: string;
  amount: string | number;
  validationStatus: ApplicationCapitalValidationStatus;
  validatedBy: string | null;
  validatedAt: Date | null;
  paidAt: Date | null;
  submittedAt: Date;
};

export async function loadApplicationCapitalReferencesForUpdate(
  connection: PoolConnection,
  applicationId: string,
): Promise<ApplicationCapitalReference[]> {
  const [rows] = await connection.execute<CapitalReferenceRow[]>(
    `SELECT CAST(payment_reference_id AS CHAR) AS paymentReferenceId,
            reference_number AS referenceNumber,
            amount,
            validation_status AS validationStatus,
            CAST(validated_by AS CHAR) AS validatedBy,
            validated_at AS validatedAt,
            paid_at AS paidAt,
            submitted_at AS submittedAt
       FROM payment_references
      WHERE related_entity_type = 'membership_application'
        AND related_entity_id = ?
        AND payment_purpose = 'Share Capital'
      ORDER BY payment_reference_id ASC
      FOR UPDATE`,
    [applicationId],
  );
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

export async function existingCapitalPaymentReferenceIds(
  connection: PoolConnection,
  applicationId: string,
) {
  const [rows] = await connection.execute<ExistingCapitalRow[]>(
    `SELECT CAST(s.payment_reference_id AS CHAR) AS paymentReferenceId
       FROM share_capital_payments s
       JOIN payment_references pr
         ON pr.payment_reference_id = s.payment_reference_id
      WHERE pr.related_entity_type = 'membership_application'
        AND pr.related_entity_id = ?
        AND pr.payment_purpose = 'Share Capital'
        AND s.payment_reference_id IS NOT NULL
      FOR UPDATE`,
    [applicationId],
  );
  return rows.map((row) => row.paymentReferenceId);
}

export async function otherValidatedMemberCapital(
  connection: PoolConnection,
  memberId: string,
  applicationId: string,
) {
  const [rows] = await connection.execute<CountRow[]>(
    `SELECT COALESCE(SUM(sp.amount), 0) AS total
       FROM share_capital_payments sp
      WHERE sp.member_id = ?
        AND sp.payment_status = 'Validated'
        AND NOT EXISTS (
          SELECT 1
            FROM payment_references pr
           WHERE pr.payment_reference_id = sp.payment_reference_id
             AND pr.related_entity_type = 'membership_application'
             AND pr.related_entity_id = ?
             AND pr.payment_purpose = 'Share Capital'
        )`,
    [memberId, applicationId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function assertNoMemberLinkConflicts(
  connection: PoolConnection,
  applicationId: string,
  memberId: string,
) {
  const checks: Array<[string, string, string]> = [
    [
      `SELECT COUNT(*) AS total
         FROM payment_references
        WHERE related_entity_type = 'membership_application'
          AND related_entity_id = ?
          AND validation_status = 'Validated'
          AND payment_purpose IN ('Associate Membership Fee', 'Share Capital')
          AND member_id IS NOT NULL
          AND member_id <> ?`,
      "A validated application payment is linked to another member",
      "MEMBERSHIP_PAYMENT_MEMBER_CONFLICT",
    ],
    [
      `SELECT COUNT(*) AS total
         FROM share_capital_payments sp
         JOIN payment_references pr
           ON pr.payment_reference_id = sp.payment_reference_id
        WHERE pr.related_entity_type = 'membership_application'
          AND pr.related_entity_id = ?
          AND pr.payment_purpose = 'Share Capital'
          AND sp.member_id <> ?`,
      "A Share Capital row for this application is linked to another member",
      "MEMBERSHIP_CAPITAL_MEMBER_CONFLICT",
    ],
    [
      `SELECT COUNT(*) AS total
         FROM financial_records fr
         JOIN payment_references pr
           ON pr.payment_reference_id = fr.payment_reference_id
        WHERE pr.related_entity_type = 'membership_application'
          AND pr.related_entity_id = ?
          AND pr.validation_status = 'Validated'
          AND pr.payment_purpose IN ('Associate Membership Fee', 'Share Capital')
          AND fr.member_id IS NOT NULL
          AND fr.member_id <> ?`,
      "A financial record for this application is linked to another member",
      "MEMBERSHIP_FINANCIAL_MEMBER_CONFLICT",
    ],
  ];

  for (const [sql, message, code] of checks) {
    const [rows] = await connection.execute<CountRow[]>(sql, [applicationId, memberId]);
    if (Number(rows[0]?.total ?? 0) > 0) {
      throw new AppError(message, 409, code);
    }
  }
}
