import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../db/pool";

type ReconciliationRow = RowDataPacket & {
  memberId: string;
  memberCode: string;
  recordedBalance: string | number;
  ledgerBalance: string | number;
  difference: string | number;
};

function parseMigration(source: string) {
  return source
    .split(";")
    .map((statement) => statement
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .trim())
    .filter(Boolean);
}

async function main() {
  const migrationRoot = path.resolve(process.cwd(), "server/database/migrations");
  const baseSource = await readFile(path.join(migrationRoot, "20261007_share_capital_ledger_and_dividends.sql"), "utf8");
  const interestSource = await readFile(path.join(migrationRoot, "20261008_interest_on_share_capital_fields.sql"), "utf8");
  const hardeningSource = await readFile(path.join(migrationRoot, "20261010_share_capital_workflow_hardening.sql"), "utf8");
  const periodGuardSource = await readFile(path.join(migrationRoot, "20261011_dividend_declaration_period_guard.sql"), "utf8");
  const actionApprovalSource = await readFile(path.join(migrationRoot, "20261012_dividend_action_approval_workflow.sql"), "utf8");
  const legacyActionRepairSource = await readFile(path.join(migrationRoot, "20261013_repair_legacy_dividend_action_statuses.sql"), "utf8");
  const payoutDetailsSource = await readFile(path.join(migrationRoot, "20261017_dividend_withdrawal_payout_details.sql"), "utf8");
  const receiptSource = await readFile(path.join(migrationRoot, "20261018_dividend_withdrawal_receipt.sql"), "utf8");
  const baseStatements = parseMigration(baseSource);
  const interestStatements = parseMigration(interestSource);
  const hardeningStatements = parseMigration(hardeningSource);
  const periodGuardStatements = parseMigration(periodGuardSource);
  const actionApprovalStatements = parseMigration(actionApprovalSource);
  const legacyActionRepairStatements = parseMigration(legacyActionRepairSource);
  const payoutDetailsStatements = parseMigration(payoutDetailsSource);
  const receiptStatements = parseMigration(receiptSource);

  const connection = await getPool().getConnection();
  try {
    for (const statement of baseStatements) await connection.query(statement);

    const [interestColumns] = await connection.query<RowDataPacket[]>(
      `SELECT table_name AS tableName, column_name AS columnName
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND ((table_name = ? AND column_name IN (?, ?, ?, ?, ?))
            OR (table_name = ? AND column_name IN (?, ?)))`,
      [
        "dividend_declarations",
        "net_surplus",
        "statutory_reserves",
        "share_capital_interest_allocation_rate",
        "interest_rate",
        "total_average_share_month",
        "member_dividends",
        "total_share_months",
        "average_share_month",
      ],
    );
    if (interestColumns.length === 0) {
      for (const statement of interestStatements) await connection.query(statement);
    } else if (interestColumns.length !== 7) {
      throw new Error("Interest on Share Capital migration is partially applied; inspect the seven expected columns before retrying.");
    }
    const [payoutColumns] = await connection.query<RowDataPacket[]>(
      `SELECT column_name AS columnName
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name IN (?, ?, ?, ?, ?)`,
      [
        "member_dividends",
        "withdrawal_method",
        "withdrawal_provider",
        "withdrawal_account_name",
        "withdrawal_account_number",
        "withdrawal_qr_code",
      ],
    );
    if (payoutColumns.length === 0) {
      for (const statement of payoutDetailsStatements) await connection.query(statement);
    } else if (payoutColumns.length !== 5) {
      throw new Error("Dividend withdrawal payout-details migration is partially applied; inspect the five expected columns before retrying.");
    }
    const [receiptColumns] = await connection.query<RowDataPacket[]>(
      `SELECT column_name AS columnName
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name IN (?, ?)` ,
      ["member_dividends", "withdrawal_receipt", "withdrawal_receipt_name"],
    );
    if (receiptColumns.length === 0) {
      for (const statement of receiptStatements) await connection.query(statement);
    } else if (receiptColumns.length !== 2) {
      throw new Error("Dividend withdrawal receipt migration is partially applied; inspect the two expected columns before retrying.");
    }
    for (const statement of hardeningStatements) await connection.query(statement);
    for (const statement of periodGuardStatements) await connection.query(statement);
    for (const statement of actionApprovalStatements) await connection.query(statement);
    for (const statement of legacyActionRepairStatements) await connection.query(statement);

    const [rows] = await connection.query<ReconciliationRow[]>(
      `SELECT CAST(account.member_id AS CHAR) AS memberId,
              member.member_code AS memberCode,
              account.current_balance AS recordedBalance,
              COALESCE(SUM(CASE
                WHEN transaction.transaction_status = 'Posted'
                THEN IF(transaction.direction = 'Credit', transaction.amount, -transaction.amount)
                ELSE 0 END), 0) AS ledgerBalance,
              account.current_balance - COALESCE(SUM(CASE
                WHEN transaction.transaction_status = 'Posted'
                THEN IF(transaction.direction = 'Credit', transaction.amount, -transaction.amount)
                ELSE 0 END), 0) AS difference
         FROM share_capital_accounts account
         JOIN member_profiles member ON member.member_id = account.member_id
         LEFT JOIN share_capital_transactions transaction ON transaction.member_id = account.member_id
        GROUP BY account.member_id, member.member_code, account.current_balance
       HAVING ABS(difference) > 0.009
        ORDER BY account.member_id`,
    );

    if (rows.length > 0) {
      console.error("Share Capital migration completed with reconciliation mismatches:", rows);
      process.exitCode = 1;
      return;
    }
    console.info("Share Capital ledger migration completed. All account balances reconcile.");
  } finally {
    connection.release();
  }
}

void main()
  .catch((error) => {
    console.error("Share Capital ledger migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
