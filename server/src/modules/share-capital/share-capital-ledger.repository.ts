import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { limitOffsetSql } from "../../db/pagination";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import {
  calculateInterestOnShareCapital,
  calculateMonthlyShareCapitalBalances,
  type ShareCapitalLedgerEntry,
} from "./dividend-calculator";
import { MAX_SHARE_CAPITAL } from "./share-capital.constants";
import type {
  CreateDividendDeclarationInput,
  DividendCompletionInput,
  DividendDeclarationPreview,
  DividendDeclarationMember,
  DividendDeclaration,
  DividendFinancialBasis,
  DividendPreviewInput,
  DividendWithdrawalInput,
  DividendWithdrawalRequest,
  MemberShareCapitalTransactionsQuery,
  MemberDividend,
  MemberShareCapitalOverview,
  ShareCapitalAccountListItem,
  ShareCapitalAccountListQuery,
  ShareCapitalLedgerListQuery,
  ShareCapitalGrowthPoint,
  ShareCapitalStaffTransaction,
  ShareCapitalStaffTransactionListResult,
  ShareCapitalTransaction,
  ShareCapitalTransactionPage,
} from "./share-capital.types";

type MemberRow = RowDataPacket & {
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
};

type AccountRow = RowDataPacket & {
  accountId: string;
  initialCapital: string | number;
  currentBalance: string | number;
  additionalContributions: string | number;
  dividendsAdded: string | number;
  totalDeductions: string | number;
  updatedAt: Date;
};

type AccountListRow = RowDataPacket & {
  accountId: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  initialCapital: string | number;
  additionalContributions: string | number;
  dividendsAdded: string | number;
  totalDeductions: string | number;
  currentBalance: string | number;
  transactionCount: number;
  updatedAt: Date;
};

type TransactionRow = RowDataPacket & {
  id: string;
  memberId: string;
  transactionDate: Date;
  transactionType: ShareCapitalTransaction["transactionType"];
  direction: ShareCapitalTransaction["direction"];
  amount: string | number;
  balanceBefore: string | number;
  balanceAfter: string | number;
  referenceNumber: string;
  sourceType: string;
  sourceId: string;
  status: ShareCapitalTransaction["status"];
  remarks: string | null;
  createdAt: Date;
};

type StaffTransactionRow = TransactionRow & {
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
};

type GrowthRow = RowDataPacket & {
  date: Date;
  balance: string | number;
  transactionCount: number;
};

type CountRow = RowDataPacket & { total: number };
type IdRow = RowDataPacket & { id: string };

type DividendFinancialBasisRow = RowDataPacket & {
  incomeTotal: string | number | null;
  expenseTotal: string | number | null;
  adjustmentTotal: string | number | null;
  postedRecordCount: string | number | null;
  unpostedRecordCount: string | number | null;
};

type DividendRow = RowDataPacket & {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  declarationId: string;
  declarationName: string;
  declarationStatus: MemberDividend["declarationStatus"];
  coverageStart: Date;
  coverageEnd: Date;
  declaredAt: Date | null;
  distributionDate: Date | null;
  amount: string | number;
  status: MemberDividend["status"];
  decision: MemberDividend["decision"];
  withdrawalMethod: MemberDividend["withdrawalMethod"];
  withdrawalProvider: string | null;
  withdrawalAccountName: string | null;
  withdrawalAccountNumber: string | null;
  withdrawalQrCode: string | null;
  withdrawalReceipt: string | null;
  withdrawalReceiptName: string | null;
  decidedAt: Date | null;
  processedAt: Date | null;
  capitalTransactionId: string | null;
  withdrawalReference: string | null;
  createdAt: Date;
};

type DeclarationRow = RowDataPacket & {
  id: string;
  name: string;
  coverageStart: Date;
  coverageEnd: Date;
  declaredAt: Date | null;
  availableAt: Date | null;
  totalDeclaredAmount: string | number;
  calculationMethod: string;
  netSurplus: string | number | null;
  statutoryReserves: string | number | null;
  interestAllocationRate: string | number | null;
  totalAverageShareMonth: string | number | null;
  interestRate: string | number | null;
  status: DividendDeclaration["status"];
  notes: string | null;
  memberCount: number;
  availableCount: number;
  capitalizedCount: number;
  withdrawalRequestedCount: number;
  capitalizationRequestedCount: number;
  withdrawnCount: number;
  createdAt: Date;
};

type ShareCapitalLedgerRow = RowDataPacket & {
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  transactionId: string;
  transactionDate: Date | string;
  direction: ShareCapitalLedgerEntry["direction"];
  amount: string | number;
};

type DividendDeclarationMemberRow = RowDataPacket & {
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  totalShareMonths: string | number;
  averageShareMonth: string | number;
  dividendAmount: string | number;
  status: DividendDeclarationMember["status"];
  decision: DividendDeclarationMember["decision"];
};

const dividendCalculationMethod = "Interest on Share Capital - Average Share Month";

function money(value: string | number | null | undefined) {
  return Number(Number(value ?? 0).toFixed(2));
}

function mapTransaction(row: TransactionRow): ShareCapitalTransaction {
  return {
    ...row,
    amount: money(row.amount),
    balanceBefore: money(row.balanceBefore),
    balanceAfter: money(row.balanceAfter),
  };
}

function mapAccount(row: AccountListRow): ShareCapitalAccountListItem {
  const initialCapital = money(row.initialCapital);
  const additionalContributions = money(row.additionalContributions);
  const dividendsAdded = money(row.dividendsAdded);
  const totalDeductions = money(row.totalDeductions);
  const currentBalance = money(row.currentBalance);
  const expectedBalance = money(initialCapital + additionalContributions + dividendsAdded - totalDeductions);
  return {
    accountId: row.accountId,
    memberId: row.memberId,
    memberCode: row.memberCode,
    memberName: row.memberName,
    membershipType: row.membershipType,
    initialCapital,
    additionalContributions,
    dividendsAdded,
    totalDeductions,
    currentBalance,
    transactionCount: Number(row.transactionCount),
    reconciled: currentBalance === expectedBalance,
    updatedAt: row.updatedAt,
  };
}

function mapStaffTransaction(row: StaffTransactionRow): ShareCapitalStaffTransaction {
  return {
    ...mapTransaction(row),
    memberCode: row.memberCode,
    memberName: row.memberName,
    membershipType: row.membershipType,
  };
}

function mapDividend(row: DividendRow): MemberDividend {
  return { ...row, amount: money(row.amount) };
}

function mapDeclaration(row: DeclarationRow): DividendDeclaration {
  return {
    ...row,
    totalDeclaredAmount: money(row.totalDeclaredAmount),
    netSurplus: row.netSurplus === null ? null : money(row.netSurplus),
    statutoryReserves: row.statutoryReserves === null ? null : money(row.statutoryReserves),
    interestAllocationRate: row.interestAllocationRate === null ? null : Number(row.interestAllocationRate),
    totalAverageShareMonth: row.totalAverageShareMonth === null ? null : money(row.totalAverageShareMonth),
    interestRate: row.interestRate === null ? null : Number(row.interestRate),
    memberCount: Number(row.memberCount),
    availableCount: Number(row.availableCount),
    capitalizedCount: Number(row.capitalizedCount),
    withdrawalRequestedCount: Number(row.withdrawalRequestedCount),
    capitalizationRequestedCount: Number(row.capitalizationRequestedCount),
    withdrawnCount: Number(row.withdrawnCount),
  };
}

function mapDeclarationMember(row: DividendDeclarationMemberRow): DividendDeclarationMember {
  return {
    ...row,
    totalShareMonths: money(row.totalShareMonths),
    averageShareMonth: money(row.averageShareMonth),
    dividendAmount: money(row.dividendAmount),
  };
}

function dateOnly(value: Date | string) {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

async function selectDividendFinancialBasis(
  connection: Pool | PoolConnection,
  coverageStart: string,
  coverageEnd: string,
): Promise<DividendFinancialBasis> {
  const [rows] = await connection.execute<DividendFinancialBasisRow[]>(
    `SELECT COALESCE(SUM(CASE WHEN approved_by IS NOT NULL AND record_status = 'Active' AND record_type = 'Income' AND source_module <> 'Share Capital' THEN amount ELSE 0 END), 0) AS incomeTotal,
            COALESCE(SUM(CASE WHEN approved_by IS NOT NULL AND record_status = 'Active' AND record_type = 'Expense' THEN amount ELSE 0 END), 0) AS expenseTotal,
            COALESCE(SUM(CASE WHEN approved_by IS NOT NULL AND record_status = 'Active' AND record_type = 'Adjustment' THEN amount ELSE 0 END), 0) AS adjustmentTotal,
            COALESCE(SUM(approved_by IS NOT NULL AND record_status = 'Active'), 0) AS postedRecordCount,
            COALESCE(SUM(approved_by IS NULL AND record_status = 'Active'), 0) AS unpostedRecordCount
       FROM financial_records
      WHERE record_date >= ?
        AND record_date < DATE_ADD(?, INTERVAL 1 DAY)`,
    [coverageStart, coverageEnd],
  );
  const row = rows[0];
  const incomeTotal = money(row?.incomeTotal);
  const expenseTotal = money(row?.expenseTotal);
  const adjustmentTotal = money(row?.adjustmentTotal);
  return {
    coverageStart,
    coverageEnd,
    incomeTotal,
    expenseTotal,
    adjustmentTotal,
    // Financial adjustments are shown as audit context, but they are not
    // operating income. Share Capital and balance-sheet adjustments must not
    // inflate the distributable net surplus.
    netSurplus: money(incomeTotal - expenseTotal),
    postedRecordCount: Number(row?.postedRecordCount ?? 0),
    unpostedRecordCount: Number(row?.unpostedRecordCount ?? 0),
  };
}

async function selectDividendPreview(
  connection: Pool | PoolConnection,
  input: DividendPreviewInput,
): Promise<DividendDeclarationPreview> {
  const financialBasis = await selectDividendFinancialBasis(connection, input.coverageStart, input.coverageEnd);
  const [rows] = await connection.execute<ShareCapitalLedgerRow[]>(
    `SELECT CAST(member.member_id AS CHAR) AS memberId,
            member.member_code AS memberCode,
            member.full_name AS memberName,
            member.membership_type AS membershipType,
            CAST(transaction.share_capital_transaction_id AS CHAR) AS transactionId,
            transaction.transaction_date AS transactionDate,
            transaction.direction,
            transaction.amount
       FROM share_capital_transactions transaction
       JOIN member_profiles member ON member.member_id = transaction.member_id
      WHERE transaction.transaction_status = 'Posted'
        AND transaction.transaction_date <= ?
        AND member.approval_status = 'Approved'
        AND member.official_member_status = 'Active'
      ORDER BY member.member_id ASC, transaction.transaction_date ASC,
               transaction.share_capital_transaction_id ASC`,
    [input.coverageEnd],
  );
  const members = new Map<string, {
    memberId: string;
    memberCode: string;
    memberName: string;
    membershipType: "Associate" | "True Member";
    transactions: ShareCapitalLedgerEntry[];
  }>();
  for (const row of rows) {
    const member = members.get(row.memberId) ?? {
      memberId: row.memberId,
      memberCode: row.memberCode,
      memberName: row.memberName,
      membershipType: row.membershipType,
      transactions: [],
    };
    member.transactions.push({
      transactionId: row.transactionId,
      transactionDate: dateOnly(row.transactionDate),
      direction: row.direction,
      amount: Number(row.amount),
    });
    members.set(row.memberId, member);
  }
  const calculation = calculateInterestOnShareCapital(
    [...members.values()].map((member) => ({
      memberId: member.memberId,
      memberCode: member.memberCode,
      memberName: member.memberName,
      membershipType: member.membershipType,
      monthlyShareCapital: calculateMonthlyShareCapitalBalances(
        member.transactions,
        input.coverageStart,
        input.coverageEnd,
      ),
    })),
    financialBasis.netSurplus,
    input.statutoryReserves,
    input.interestAllocationRate,
  );

  return {
    calculationMethod: dividendCalculationMethod,
    netSurplus: money(financialBasis.netSurplus),
    statutoryReserves: money(input.statutoryReserves),
    distributableSurplus: calculation.distributableSurplus,
    interestAllocationRate: Number(input.interestAllocationRate),
    totalAverageShareMonth: calculation.totalAverageShareMonth,
    interestRate: calculation.interestRate,
    interestAllocationAmount: calculation.interestAllocationAmount,
    qualifiedMemberCount: calculation.allocations.length,
    dividendPool: money(calculation.allocations.reduce((total, item) => total + item.dividendAmount, 0)),
    qualifiedMembers: calculation.allocations,
  };
}

async function insertDividendAllocations(
  connection: PoolConnection,
  declarationId: string,
  availableAt: string,
  allocations: DividendDeclarationPreview["qualifiedMembers"],
) {
  if (!allocations.length) return;

  const placeholders = allocations.map(() => "(?, ?, ?, ?, ?, 'Pending', ?)").join(", ");
  const values: Array<string | number> = [];
  for (const allocation of allocations) {
    values.push(
      declarationId,
      allocation.memberId,
      allocation.dividendAmount,
      allocation.totalShareMonths,
      allocation.averageShareMonth,
      availableAt,
    );
  }

  await connection.execute(
    `INSERT INTO member_dividends
       (dividend_declaration_id, member_id, dividend_amount, total_share_months,
        average_share_month, dividend_status, available_at)
     VALUES ${placeholders}`,
    values,
  );
}

function dividendSelect() {
  return `SELECT CAST(md.member_dividend_id AS CHAR) AS id,
                 CAST(md.member_id AS CHAR) AS memberId,
                 member.member_code AS memberCode,
                 member.full_name AS memberName,
                 CAST(md.dividend_declaration_id AS CHAR) AS declarationId,
                 declaration.declaration_name AS declarationName,
                 declaration.declaration_status AS declarationStatus,
                 declaration.coverage_start AS coverageStart,
                 declaration.coverage_end AS coverageEnd,
                 declaration.declared_at AS declaredAt,
                 md.available_at AS distributionDate,
                 md.dividend_amount AS amount,
                 md.dividend_status AS status,
                 md.member_decision AS decision,
                 md.withdrawal_method AS withdrawalMethod,
                 md.withdrawal_provider AS withdrawalProvider,
                 md.withdrawal_account_name AS withdrawalAccountName,
                 md.withdrawal_account_number AS withdrawalAccountNumber,
                 md.withdrawal_qr_code AS withdrawalQrCode,
                 md.withdrawal_receipt AS withdrawalReceipt,
                 md.withdrawal_receipt_name AS withdrawalReceiptName,
                 md.decided_at AS decidedAt,
                 md.processed_at AS processedAt,
                 CAST(md.share_capital_transaction_id AS CHAR) AS capitalTransactionId,
                 md.withdrawal_reference AS withdrawalReference,
                 md.created_at AS createdAt
            FROM member_dividends md
            JOIN dividend_declarations declaration
              ON declaration.dividend_declaration_id = md.dividend_declaration_id
            JOIN member_profiles member ON member.member_id = md.member_id`;
}

function declarationSelect() {
  return `SELECT CAST(declaration.dividend_declaration_id AS CHAR) AS id,
                 declaration.declaration_name AS name,
                 declaration.coverage_start AS coverageStart,
                 declaration.coverage_end AS coverageEnd,
                 declaration.declared_at AS declaredAt,
                 declaration.available_at AS availableAt,
                 declaration.total_declared_amount AS totalDeclaredAmount,
                 declaration.calculation_method AS calculationMethod,
                 declaration.net_surplus AS netSurplus,
                 declaration.statutory_reserves AS statutoryReserves,
                 declaration.share_capital_interest_allocation_rate AS interestAllocationRate,
                 declaration.total_average_share_month AS totalAverageShareMonth,
                 declaration.interest_rate AS interestRate,
                 declaration.declaration_status AS status,
                 declaration.notes,
                 COUNT(md.member_dividend_id) AS memberCount,
                 SUM(md.dividend_status = 'Available') AS availableCount,
                 SUM(md.dividend_status = 'Added to Share Capital') AS capitalizedCount,
                 SUM(md.dividend_status = 'Withdrawal Requested') AS withdrawalRequestedCount,
                 SUM(md.dividend_status = 'Capitalization Requested') AS capitalizationRequestedCount,
                 SUM(md.dividend_status = 'Withdrawn') AS withdrawnCount,
                 declaration.created_at AS createdAt
            FROM dividend_declarations declaration
            LEFT JOIN member_dividends md
              ON md.dividend_declaration_id = declaration.dividend_declaration_id`;
}

async function activateDueDividends(connection: Pool | PoolConnection) {
  await connection.execute(
    `UPDATE member_dividends dividend
     JOIN dividend_declarations declaration
       ON declaration.dividend_declaration_id = dividend.dividend_declaration_id
        SET dividend.dividend_status = 'Available'
      WHERE declaration.declaration_status = 'Published'
        AND dividend.dividend_status = 'Pending'
        AND dividend.available_at <= UTC_TIMESTAMP()`,
  );
  await connection.execute(
    `INSERT IGNORE INTO dividend_action_history
       (member_dividend_id, previous_status, new_status, action_name, remarks, performed_by)
     SELECT dividend.member_dividend_id, 'Pending', 'Available', 'Dividend became available',
            'The scheduled dividend distribution date was reached.', NULL
       FROM member_dividends dividend
       JOIN dividend_declarations declaration
         ON declaration.dividend_declaration_id = dividend.dividend_declaration_id
      WHERE declaration.declaration_status = 'Published'
        AND dividend.dividend_status = 'Available'
        AND NOT EXISTS (
          SELECT 1 FROM dividend_action_history history
           WHERE history.member_dividend_id = dividend.member_dividend_id
             AND history.new_status = 'Available'
        )`,
  );
}

async function selectMemberByUserId(
  connection: Pool | PoolConnection,
  userId: string,
): Promise<MemberRow> {
  const [rows] = await connection.execute<MemberRow[]>(
    `SELECT CAST(member_id AS CHAR) AS memberId,
            member_code AS memberCode,
            full_name AS memberName,
            membership_type AS membershipType
       FROM member_profiles
      WHERE user_id = ?
      LIMIT 1`,
    [userId],
  );
  if (!rows[0]) {
    throw new AppError("A linked member profile is required", 404, "MEMBER_PROFILE_NOT_FOUND");
  }
  return rows[0];
}

async function selectAccount(
  connection: Pool | PoolConnection,
  memberId: string,
  forUpdate = false,
) {
  const [rows] = await connection.execute<AccountRow[]>(
    `SELECT CAST(share_capital_account_id AS CHAR) AS accountId,
            initial_capital AS initialCapital,
            current_balance AS currentBalance,
            total_additional_contributions AS additionalContributions,
            total_dividends_added AS dividendsAdded,
            total_deductions AS totalDeductions,
            updated_at AS updatedAt
       FROM share_capital_accounts
      WHERE member_id = ?
      LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [memberId],
  );
  return rows[0] ?? null;
}

export async function postShareCapitalPaymentToLedger(input: {
  connection: PoolConnection;
  memberId: string;
  sharePaymentId: string;
  amount: number;
  transactionDate: string;
  referenceNumber: string;
  createdBy?: string | null;
  remarks?: string | null;
}) {
  const sourceType = "share_capital_payment";
  const [existingRows] = await input.connection.execute<IdRow[]>(
    `SELECT CAST(share_capital_transaction_id AS CHAR) AS id
       FROM share_capital_transactions
      WHERE source_type = ? AND source_id = ?
      LIMIT 1`,
    [sourceType, input.sharePaymentId],
  );
  if (existingRows[0]) return existingRows[0].id;

  const amount = money(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Share Capital transaction amount must be positive", 422, "SHARE_CAPITAL_LEDGER_AMOUNT_INVALID");
  }

  await input.connection.execute(
    `INSERT INTO share_capital_accounts (member_id)
     VALUES (?)
     ON DUPLICATE KEY UPDATE member_id = member_id`,
    [input.memberId],
  );
  const account = await selectAccount(input.connection, input.memberId, true);
  if (!account) {
    throw new AppError("Share Capital account could not be created", 500, "SHARE_CAPITAL_ACCOUNT_CREATE_FAILED");
  }

  const balanceBefore = money(account.currentBalance);
  const balanceAfter = money(balanceBefore + amount);
  const transactionType = balanceBefore === 0
    ? "Initial Share Capital"
    : "Additional Capital Contribution";
  const [result] = await input.connection.execute<ResultSetHeader>(
    `INSERT INTO share_capital_transactions
       (share_capital_account_id, member_id, transaction_date, transaction_type,
        direction, amount, balance_before, balance_after, reference_number,
        source_type, source_id, transaction_status, remarks, created_by)
     VALUES (?, ?, ?, ?, 'Credit', ?, ?, ?, ?, ?, ?, 'Posted', ?, ?)`,
    [
      account.accountId,
      input.memberId,
      input.transactionDate,
      transactionType,
      amount,
      balanceBefore,
      balanceAfter,
      input.referenceNumber,
      sourceType,
      input.sharePaymentId,
      input.remarks ?? null,
      input.createdBy ?? null,
    ],
  );

  await input.connection.execute(
    `UPDATE share_capital_accounts
        SET initial_capital = initial_capital + CASE WHEN ? = 'Initial Share Capital' THEN ? ELSE 0 END,
            total_additional_contributions = total_additional_contributions + CASE WHEN ? = 'Additional Capital Contribution' THEN ? ELSE 0 END,
            current_balance = ?
      WHERE share_capital_account_id = ?`,
    [transactionType, amount, transactionType, amount, balanceAfter, account.accountId],
  );

  return String(result.insertId);
}

export async function reverseShareCapitalPaymentInLedger(input: {
  connection: PoolConnection;
  memberId: string;
  sharePaymentId: string;
  transactionDate: string;
  createdBy?: string | null;
  reason?: string | null;
}) {
  const reversalSourceType = "share_capital_payment_reversal";
  const [existingReversal] = await input.connection.execute<IdRow[]>(
    `SELECT CAST(share_capital_transaction_id AS CHAR) AS id
       FROM share_capital_transactions
      WHERE source_type = ? AND source_id = ?
      LIMIT 1`,
    [reversalSourceType, input.sharePaymentId],
  );
  if (existingReversal[0]) return existingReversal[0].id;

  const [originalRows] = await input.connection.execute<(TransactionRow & { accountId: string })[]>(
    `SELECT CAST(share_capital_transaction_id AS CHAR) AS id,
            CAST(share_capital_account_id AS CHAR) AS accountId,
            CAST(member_id AS CHAR) AS memberId,
            transaction_date AS transactionDate,
            transaction_type AS transactionType,
            direction,
            amount,
            balance_before AS balanceBefore,
            balance_after AS balanceAfter,
            reference_number AS referenceNumber,
            source_type AS sourceType,
            source_id AS sourceId,
            transaction_status AS status,
            remarks,
            created_at AS createdAt
       FROM share_capital_transactions
      WHERE source_type = 'share_capital_payment' AND source_id = ?
      LIMIT 1 FOR UPDATE`,
    [input.sharePaymentId],
  );
  const original = originalRows[0];
  if (!original) return null;

  const account = await selectAccount(input.connection, input.memberId, true);
  if (!account) throw new AppError("Share Capital account was not found", 404, "SHARE_CAPITAL_ACCOUNT_NOT_FOUND");
  const amount = money(original.amount);
  const balanceBefore = money(account.currentBalance);
  const balanceAfter = money(balanceBefore - amount);
  if (balanceAfter < 0) {
    throw new AppError("This reversal would make the Share Capital balance negative", 409, "SHARE_CAPITAL_REVERSAL_BALANCE_INVALID");
  }

  const [result] = await input.connection.execute<ResultSetHeader>(
    `INSERT INTO share_capital_transactions
       (share_capital_account_id, member_id, transaction_date, transaction_type,
        direction, amount, balance_before, balance_after, reference_number,
        source_type, source_id, transaction_status, remarks, created_by,
        reversed_transaction_id)
     VALUES (?, ?, ?, 'Reversal', 'Debit', ?, ?, ?, ?, ?, ?, 'Posted', ?, ?, ?)`,
    [
      original.accountId,
      input.memberId,
      input.transactionDate,
      amount,
      balanceBefore,
      balanceAfter,
      `REV-${original.referenceNumber}`,
      reversalSourceType,
      input.sharePaymentId,
      input.reason ?? `Reversal of ${original.referenceNumber}`,
      input.createdBy ?? null,
      original.id,
    ],
  );
  await input.connection.execute(
    `UPDATE share_capital_accounts
        SET total_deductions = total_deductions + ?, current_balance = ?
      WHERE share_capital_account_id = ?`,
    [amount, balanceAfter, original.accountId],
  );
  return String(result.insertId);
}

export interface ShareCapitalLedgerRepository {
  listAccounts(query: ShareCapitalAccountListQuery): Promise<{ accounts: ShareCapitalAccountListItem[]; total: number; page: number; pageSize: number }>;
  listLedgerTransactions(query: ShareCapitalLedgerListQuery): Promise<ShareCapitalStaffTransactionListResult>;
  memberOverview(userId: string): Promise<MemberShareCapitalOverview>;
  memberTransactions(userId: string, query: MemberShareCapitalTransactionsQuery): Promise<ShareCapitalTransactionPage>;
  memberGrowth(userId: string): Promise<ShareCapitalGrowthPoint[]>;
  reconcileMember(memberId: string): Promise<MemberShareCapitalOverview["reconciliation"]>;
  memberDividends(userId: string): Promise<MemberDividend[]>;
  requestDividendCapitalization(userId: string, dividendId: string): Promise<MemberDividend>;
  requestDividendWithdrawal(userId: string, dividendId: string, input?: DividendWithdrawalInput): Promise<MemberDividend>;
  dividendFinancialBasis(coverageStart: string, coverageEnd: string): Promise<DividendFinancialBasis>;
  previewDividendDeclaration(input: DividendPreviewInput): Promise<DividendDeclarationPreview>;
  listDividendDeclarations(): Promise<DividendDeclaration[]>;
  listDividendDeclarationMembers(declarationId: string): Promise<DividendDeclarationMember[]>;
  createDividendDeclaration(input: CreateDividendDeclarationInput, actorUserId: string): Promise<DividendDeclaration>;
  approveDividendDeclaration(declarationId: string, actorUserId: string): Promise<DividendDeclaration>;
  rejectDividendDeclaration(declarationId: string, actorUserId: string): Promise<DividendDeclaration>;
  publishDividendDeclaration(declarationId: string, actorUserId: string): Promise<DividendDeclaration>;
  listDividendActionRequests(): Promise<DividendWithdrawalRequest[]>;
  listDividendActionHistory(): Promise<DividendWithdrawalRequest[]>;
  completeDividendAction(dividendId: string, input: DividendCompletionInput, actorUserId: string): Promise<MemberDividend>;
}

export function createShareCapitalLedgerRepository(pool?: Pool): ShareCapitalLedgerRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async listAccounts(query) {
      const where: string[] = [];
      const values: string[] = [];
      if (query.search) {
        where.push("(member.full_name LIKE ? OR member.member_code LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<AccountListRow[]>(
        `SELECT CAST(account.share_capital_account_id AS CHAR) AS accountId,
                CAST(account.member_id AS CHAR) AS memberId,
                member.member_code AS memberCode,
                member.full_name AS memberName,
                member.membership_type AS membershipType,
                account.initial_capital AS initialCapital,
                account.total_additional_contributions AS additionalContributions,
                account.total_dividends_added AS dividendsAdded,
                account.total_deductions AS totalDeductions,
                account.current_balance AS currentBalance,
                COUNT(transaction.share_capital_transaction_id) AS transactionCount,
                account.updated_at AS updatedAt
           FROM share_capital_accounts account
           JOIN member_profiles member ON member.member_id = account.member_id
           LEFT JOIN share_capital_transactions transaction
             ON transaction.share_capital_account_id = account.share_capital_account_id
          ${whereSql}
          GROUP BY account.share_capital_account_id
          ORDER BY member.full_name ASC, account.member_id ASC
          ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total
           FROM share_capital_accounts account
           JOIN member_profiles member ON member.member_id = account.member_id
          ${whereSql}`,
        values,
      );
      return {
        accounts: rows.map(mapAccount),
        total: Number(countRows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async listLedgerTransactions(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];
      if (query.memberId) {
        where.push("transaction.member_id = ?");
        values.push(query.memberId);
      }
      if (query.search) {
        where.push("(member.full_name LIKE ? OR member.member_code LIKE ? OR transaction.reference_number LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search, search);
      }
      if (query.direction) {
        where.push("transaction.direction = ?");
        values.push(query.direction);
      }
      if (query.status) {
        where.push("transaction.transaction_status = ?");
        values.push(query.status);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<StaffTransactionRow[]>(
        `SELECT CAST(transaction.share_capital_transaction_id AS CHAR) AS id,
                CAST(transaction.member_id AS CHAR) AS memberId,
                member.member_code AS memberCode,
                member.full_name AS memberName,
                member.membership_type AS membershipType,
                transaction.transaction_date AS transactionDate,
                transaction.transaction_type AS transactionType,
                transaction.direction,
                transaction.amount,
                transaction.balance_before AS balanceBefore,
                transaction.balance_after AS balanceAfter,
                transaction.reference_number AS referenceNumber,
                transaction.source_type AS sourceType,
                transaction.source_id AS sourceId,
                transaction.transaction_status AS status,
                transaction.remarks,
                transaction.created_at AS createdAt
           FROM share_capital_transactions transaction
           JOIN member_profiles member ON member.member_id = transaction.member_id
          ${whereSql}
          ORDER BY transaction.created_at DESC, transaction.share_capital_transaction_id DESC
          ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total
           FROM share_capital_transactions transaction
           JOIN member_profiles member ON member.member_id = transaction.member_id
          ${whereSql}`,
        values,
      );
      return {
        transactions: rows.map(mapStaffTransaction),
        total: Number(countRows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async memberOverview(userId) {
      const member = await selectMemberByUserId(databasePool(), userId);
      const account = await selectAccount(databasePool(), member.memberId);
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total
           FROM share_capital_transactions
          WHERE member_id = ? AND transaction_status = 'Posted'`,
        [member.memberId],
      );
      const summary = account
        ? {
            initialCapital: money(account.initialCapital),
            additionalContributions: money(account.additionalContributions),
            dividendsAdded: money(account.dividendsAdded),
            totalDeductions: money(account.totalDeductions),
            currentBalance: money(account.currentBalance),
            updatedAt: account.updatedAt,
          }
        : {
            initialCapital: 0,
            additionalContributions: 0,
            dividendsAdded: 0,
            totalDeductions: 0,
            currentBalance: 0,
            updatedAt: null,
          };
      const expectedBalance = money(
        summary.initialCapital
        + summary.additionalContributions
        + summary.dividendsAdded
        - summary.totalDeductions,
      );
      return {
        member,
        summary,
        transactionCount: Number(countRows[0]?.total ?? 0),
        reconciliation: {
          expectedBalance,
          recordedBalance: summary.currentBalance,
          difference: money(summary.currentBalance - expectedBalance),
          reconciled: summary.currentBalance === expectedBalance,
        },
      };
    },

    async memberTransactions(userId, query) {
      const member = await selectMemberByUserId(databasePool(), userId);
      const where: string[] = ["member_id = ?"];
      const values: Array<string | number> = [member.memberId];
      if (query.dateFrom) {
        where.push("transaction_date >= ?");
        values.push(query.dateFrom);
      }
      if (query.dateTo) {
        where.push("transaction_date <= ?");
        values.push(query.dateTo);
      }
      if (query.direction) {
        where.push("direction = ?");
        values.push(query.direction);
      }
      if (query.status) {
        where.push("transaction_status = ?");
        values.push(query.status);
      }
      const whereSql = where.join(" AND ");
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<TransactionRow[]>(
        `SELECT CAST(share_capital_transaction_id AS CHAR) AS id,
                CAST(member_id AS CHAR) AS memberId,
                transaction_date AS transactionDate,
                transaction_type AS transactionType,
                direction,
                amount,
                balance_before AS balanceBefore,
                balance_after AS balanceAfter,
                reference_number AS referenceNumber,
                source_type AS sourceType,
                source_id AS sourceId,
                transaction_status AS status,
                remarks,
                created_at AS createdAt
           FROM share_capital_transactions
          WHERE ${whereSql}
          ORDER BY created_at DESC, share_capital_transaction_id DESC
          ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM share_capital_transactions WHERE ${whereSql}`,
        values,
      );
      return {
        transactions: rows.map(mapTransaction),
        page: query.page,
        pageSize: query.pageSize,
        total: Number(countRows[0]?.total ?? 0),
      };
    },

    async memberGrowth(userId) {
      const member = await selectMemberByUserId(databasePool(), userId);
      const [rows] = await databasePool().execute<GrowthRow[]>(
        `SELECT transaction_date AS date,
                MAX(balance_after) AS balance,
                COUNT(*) AS transactionCount
           FROM share_capital_transactions
          WHERE member_id = ? AND transaction_status = 'Posted'
          GROUP BY transaction_date
          ORDER BY transaction_date ASC`,
        [member.memberId],
      );
      return rows.map((row) => ({
        date: row.date,
        balance: money(row.balance),
        transactionCount: Number(row.transactionCount),
      }));
    },

    async reconcileMember(memberId) {
      return withTransaction(async (connection) => {
        const account = await selectAccount(connection, memberId, true);
        const [rows] = await connection.execute<(RowDataPacket & { expectedBalance: string | number })[]>(
          `SELECT COALESCE(SUM(CASE WHEN transaction_status = 'Posted' THEN IF(direction = 'Credit', amount, -amount) ELSE 0 END), 0) AS expectedBalance
             FROM share_capital_transactions
            WHERE member_id = ?`,
          [memberId],
        );
        const expectedBalance = money(rows[0]?.expectedBalance ?? 0);
        const recordedBalance = money(account?.currentBalance ?? 0);
        return {
          expectedBalance,
          recordedBalance,
          difference: money(recordedBalance - expectedBalance),
          reconciled: recordedBalance === expectedBalance,
        };
      }, databasePool());
    },

    async memberDividends(userId) {
      await activateDueDividends(databasePool());
      const member = await selectMemberByUserId(databasePool(), userId);
      const [rows] = await databasePool().execute<DividendRow[]>(
        `${dividendSelect()}
          WHERE md.member_id = ?
            AND declaration.declaration_status IN ('Approved', 'Published')
          ORDER BY md.created_at DESC, md.member_dividend_id DESC`,
        [member.memberId],
      );
      return rows.map(mapDividend);
    },

    async requestDividendCapitalization(userId, dividendId) {
      return withTransaction(async (connection) => {
        const member = await selectMemberByUserId(connection, userId);
        const [rows] = await connection.execute<DividendRow[]>(
          `${dividendSelect()}
            WHERE md.member_dividend_id = ? AND md.member_id = ?
            LIMIT 1 FOR UPDATE`,
          [dividendId, member.memberId],
        );
        const dividend = rows[0];
        if (!dividend) throw new AppError("Dividend was not found", 404, "DIVIDEND_NOT_FOUND");
        if (dividend.status !== "Available") {
          throw new AppError("Only an available dividend can be added to Share Capital", 409, "DIVIDEND_NOT_AVAILABLE");
        }

        const amount = money(dividend.amount);
        const [capitalizationResult] = await connection.execute<ResultSetHeader>(
          `UPDATE member_dividends
              SET dividend_status = 'Capitalization Requested',
                  member_decision = 'Add to Share Capital',
                  decided_at = UTC_TIMESTAMP()
            WHERE member_dividend_id = ? AND dividend_status = 'Available'`,
          [dividendId],
        );
        if (capitalizationResult.affectedRows !== 1) {
          throw new AppError("The dividend was already processed", 409, "DIVIDEND_ALREADY_PROCESSED");
        }
        await connection.execute(
          `INSERT INTO dividend_action_history
             (member_dividend_id, previous_status, new_status, action_name, remarks, performed_by)
           VALUES (?, 'Available', 'Capitalization Requested', 'Share Capital addition requested', ?, ?)`,
          [dividendId, `Member requested ${amount.toFixed(2)} to be added to Share Capital`, userId],
        );
        const [updatedRows] = await connection.execute<DividendRow[]>(
          `${dividendSelect()} WHERE md.member_dividend_id = ? LIMIT 1`,
          [dividendId],
        );
        return mapDividend(updatedRows[0]);
      }, databasePool());
    },

    async requestDividendWithdrawal(userId, dividendId, input = { withdrawalMethod: "Cash" }) {
      return withTransaction(async (connection) => {
        const member = await selectMemberByUserId(connection, userId);
        const [rows] = await connection.execute<DividendRow[]>(
          `${dividendSelect()}
            WHERE md.member_dividend_id = ? AND md.member_id = ?
            LIMIT 1 FOR UPDATE`,
          [dividendId, member.memberId],
        );
        const dividend = rows[0];
        if (!dividend) throw new AppError("Dividend was not found", 404, "DIVIDEND_NOT_FOUND");
        if (dividend.status !== "Available") {
          throw new AppError("Only an available dividend can be withdrawn", 409, "DIVIDEND_NOT_AVAILABLE");
        }
        const isOnlineTransfer = input.withdrawalMethod === "Online Transfer";
        const withdrawalProvider = isOnlineTransfer ? input.withdrawalProvider?.trim() || null : null;
        const withdrawalAccountName = isOnlineTransfer ? input.withdrawalAccountName?.trim() || null : null;
        const withdrawalAccountNumber = isOnlineTransfer ? input.withdrawalAccountNumber?.trim() || null : null;
        const withdrawalQrCode = isOnlineTransfer ? input.withdrawalQrCode?.trim() || null : null;
        const [withdrawalResult] = await connection.execute<ResultSetHeader>(
          `UPDATE member_dividends
              SET dividend_status = 'Withdrawal Requested', member_decision = 'Withdraw',
                  withdrawal_method = ?, withdrawal_provider = ?,
                  withdrawal_account_name = ?, withdrawal_account_number = ?,
                  withdrawal_qr_code = ?, decided_at = UTC_TIMESTAMP()
            WHERE member_dividend_id = ? AND dividend_status = 'Available'`,
          [input.withdrawalMethod, withdrawalProvider, withdrawalAccountName, withdrawalAccountNumber, withdrawalQrCode, dividendId],
        );
        if (withdrawalResult.affectedRows !== 1) {
          throw new AppError("The dividend was already processed", 409, "DIVIDEND_ALREADY_PROCESSED");
        }
        await connection.execute(
          `INSERT INTO dividend_action_history
             (member_dividend_id, previous_status, new_status, action_name, remarks, performed_by)
           VALUES (?, 'Available', 'Withdrawal Requested', 'Withdrawal requested', ?, ?)`,
          [
            dividendId,
            `Member requested withdrawal of ${money(dividend.amount).toFixed(2)} via ${input.withdrawalMethod}${withdrawalProvider ? ` (${withdrawalProvider})` : ""}`,
            userId,
          ],
        );
        const [updatedRows] = await connection.execute<DividendRow[]>(
          `${dividendSelect()} WHERE md.member_dividend_id = ? LIMIT 1`,
          [dividendId],
        );
        return mapDividend(updatedRows[0]);
      }, databasePool());
    },

    async listDividendDeclarations() {
      await activateDueDividends(databasePool());
      const [rows] = await databasePool().execute<DeclarationRow[]>(
        `${declarationSelect()}
          GROUP BY declaration.dividend_declaration_id
          ORDER BY declaration.created_at DESC, declaration.dividend_declaration_id DESC`,
      );
      return rows.map(mapDeclaration);
    },

    async listDividendDeclarationMembers(declarationId) {
      const [rows] = await databasePool().execute<DividendDeclarationMemberRow[]>(
        `SELECT CAST(member.member_id AS CHAR) AS memberId,
                member.member_code AS memberCode,
                member.full_name AS memberName,
                member.membership_type AS membershipType,
                dividend.total_share_months AS totalShareMonths,
                dividend.average_share_month AS averageShareMonth,
                dividend.dividend_amount AS dividendAmount,
                dividend.dividend_status AS status,
                dividend.member_decision AS decision
           FROM member_dividends dividend
           JOIN member_profiles member ON member.member_id = dividend.member_id
          WHERE dividend.dividend_declaration_id = ?
          ORDER BY member.full_name ASC, member.member_id ASC`,
        [declarationId],
      );
      return rows.map(mapDeclarationMember);
    },

    dividendFinancialBasis(coverageStart, coverageEnd) {
      return selectDividendFinancialBasis(databasePool(), coverageStart, coverageEnd);
    },

    previewDividendDeclaration(input) {
      return selectDividendPreview(databasePool(), input);
    },

    async createDividendDeclaration(input, actorUserId) {
      return withTransaction(async (connection) => {
        const [conflictRows] = await connection.execute<(RowDataPacket & { name: string; status: string })[]>(
          `SELECT declaration_name AS name, declaration_status AS status
             FROM dividend_declarations
            WHERE declaration_status IN ('Draft', 'Approved', 'Published')
              AND coverage_start <= ?
              AND coverage_end >= ?
            ORDER BY coverage_start ASC, dividend_declaration_id ASC
            LIMIT 1
            FOR UPDATE`,
          [input.coverageEnd, input.coverageStart],
        );
        if (conflictRows[0]) {
          throw new AppError(
            `An active dividend declaration (${conflictRows[0].name}) already overlaps this coverage period. Use a different period or finish the existing workflow first.`,
            409,
            "DIVIDEND_DECLARATION_PERIOD_CONFLICT",
          );
        }
        const preview = await selectDividendPreview(connection, input);
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO dividend_declarations
             (declaration_name, coverage_start, coverage_end, available_at,
              total_declared_amount, calculation_method, net_surplus, statutory_reserves,
              share_capital_interest_allocation_rate, total_average_share_month,
              interest_rate, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.name,
            input.coverageStart,
            input.coverageEnd,
            input.availableAt,
            preview.dividendPool,
            preview.calculationMethod,
            preview.netSurplus,
            preview.statutoryReserves,
            preview.interestAllocationRate,
            preview.totalAverageShareMonth,
            preview.interestRate,
            input.notes ?? null,
            actorUserId,
          ],
        );
        const declarationId = String(result.insertId);
        await insertDividendAllocations(connection, declarationId, input.availableAt, preview.qualifiedMembers);
        await connection.execute(
          `UPDATE dividend_declarations declaration
              SET total_declared_amount = (
                SELECT COALESCE(SUM(dividend_amount), 0)
                  FROM member_dividends
                 WHERE dividend_declaration_id = declaration.dividend_declaration_id
              )
            WHERE dividend_declaration_id = ?`,
          [declarationId],
        );
        const [rows] = await connection.execute<DeclarationRow[]>(
          `${declarationSelect()}
            WHERE declaration.dividend_declaration_id = ?
            GROUP BY declaration.dividend_declaration_id`,
          [declarationId],
        );
        return mapDeclaration(rows[0]);
      }, databasePool());
    },

    async approveDividendDeclaration(declarationId, actorUserId) {
      return withTransaction(async (connection) => {
        const [statusRows] = await connection.execute<(RowDataPacket & { status: DividendDeclaration["status"] })[]>(
          `SELECT declaration_status AS status
             FROM dividend_declarations
            WHERE dividend_declaration_id = ?
            LIMIT 1 FOR UPDATE`,
          [declarationId],
        );
        if (!statusRows[0]) throw new AppError("Dividend declaration was not found", 404, "DIVIDEND_DECLARATION_NOT_FOUND");
        if (statusRows[0].status !== "Draft") {
          throw new AppError("Only a draft dividend declaration can be approved", 409, "DIVIDEND_DECLARATION_LOCKED");
        }
        await connection.execute(
          `UPDATE dividend_declarations
              SET declaration_status = 'Approved', approved_by = ?
            WHERE dividend_declaration_id = ? AND declaration_status = 'Draft'`,
          [actorUserId, declarationId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'dividend_declaration.approved', 'dividend_declarations', ?, 'A dividend declaration was approved for publication.', ?)` ,
          [actorUserId, declarationId, JSON.stringify({ status: "Approved" })],
        );
        const [rows] = await connection.execute<DeclarationRow[]>(
          `${declarationSelect()}
            WHERE declaration.dividend_declaration_id = ?
            GROUP BY declaration.dividend_declaration_id`,
          [declarationId],
        );
        return mapDeclaration(rows[0]);
      }, databasePool());
    },

    async rejectDividendDeclaration(declarationId, actorUserId) {
      return withTransaction(async (connection) => {
        const [statusRows] = await connection.execute<(RowDataPacket & { status: DividendDeclaration["status"] })[]>(
          `SELECT declaration_status AS status
             FROM dividend_declarations
            WHERE dividend_declaration_id = ?
            LIMIT 1 FOR UPDATE`,
          [declarationId],
        );
        if (!statusRows[0]) throw new AppError("Dividend declaration was not found", 404, "DIVIDEND_DECLARATION_NOT_FOUND");
        if (statusRows[0].status !== "Draft") {
          throw new AppError("Only a draft dividend declaration can be rejected", 409, "DIVIDEND_DECLARATION_LOCKED");
        }
        await connection.execute(
          `UPDATE dividend_declarations
              SET declaration_status = 'Cancelled'
            WHERE dividend_declaration_id = ? AND declaration_status = 'Draft'`,
          [declarationId],
        );
        await connection.execute(
          `INSERT INTO dividend_action_history
             (member_dividend_id, previous_status, new_status, action_name, remarks, performed_by)
           SELECT member_dividend_id, 'Pending', 'Cancelled', 'Dividend declaration rejected',
                  'The parent dividend declaration was rejected before publication.', ?
             FROM member_dividends
            WHERE dividend_declaration_id = ? AND dividend_status = 'Pending'`,
          [actorUserId, declarationId],
        );
        await connection.execute(
          `UPDATE member_dividends
              SET dividend_status = 'Cancelled'
            WHERE dividend_declaration_id = ? AND dividend_status = 'Pending'`,
          [declarationId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'dividend_declaration.rejected', 'dividend_declarations', ?, 'A dividend declaration was rejected before publication.', ?)`,
          [actorUserId, declarationId, JSON.stringify({ status: "Cancelled" })],
        );
        const [rows] = await connection.execute<DeclarationRow[]>(
          `${declarationSelect()}
            WHERE declaration.dividend_declaration_id = ?
            GROUP BY declaration.dividend_declaration_id`,
          [declarationId],
        );
        return mapDeclaration(rows[0]);
      }, databasePool());
    },

    async publishDividendDeclaration(declarationId, actorUserId) {
      return withTransaction(async (connection) => {
        const [statusRows] = await connection.execute<(RowDataPacket & { status: string })[]>(
          `SELECT declaration_status AS status
             FROM dividend_declarations
            WHERE dividend_declaration_id = ?
            LIMIT 1 FOR UPDATE`,
          [declarationId],
        );
        if (!statusRows[0]) throw new AppError("Dividend declaration was not found", 404, "DIVIDEND_DECLARATION_NOT_FOUND");
        if (statusRows[0].status !== "Approved") {
          throw new AppError("Only an approved dividend declaration can be published", 409, "DIVIDEND_DECLARATION_LOCKED");
        }
        await connection.execute(
          `UPDATE dividend_declarations
              SET declaration_status = 'Published', declared_at = UTC_TIMESTAMP(), approved_by = ?
            WHERE dividend_declaration_id = ?`,
          [actorUserId, declarationId],
        );
        await connection.execute(
          `UPDATE member_dividends dividend
           JOIN dividend_declarations declaration
             ON declaration.dividend_declaration_id = dividend.dividend_declaration_id
              SET dividend.dividend_status = CASE
                    WHEN COALESCE(dividend.available_at, declaration.available_at) <= UTC_TIMESTAMP()
                    THEN 'Available' ELSE 'Pending' END,
                  dividend.available_at = COALESCE(dividend.available_at, declaration.available_at)
            WHERE dividend.dividend_declaration_id = ? AND dividend.dividend_status = 'Pending'`,
          [declarationId],
        );
        await connection.execute(
          `INSERT INTO dividend_action_history
             (member_dividend_id, previous_status, new_status, action_name, remarks, performed_by)
           SELECT member_dividend_id, 'Pending', 'Available', 'Dividend published',
                  'Dividend became available for member decision.', ?
             FROM member_dividends
            WHERE dividend_declaration_id = ? AND dividend_status = 'Available'`,
          [actorUserId, declarationId],
        );
        const [rows] = await connection.execute<DeclarationRow[]>(
          `${declarationSelect()}
            WHERE declaration.dividend_declaration_id = ?
            GROUP BY declaration.dividend_declaration_id`,
          [declarationId],
        );
        return mapDeclaration(rows[0]);
      }, databasePool());
    },

    async listDividendActionRequests() {
      await activateDueDividends(databasePool());
      const [rows] = await databasePool().execute<DividendRow[]>(
        `${dividendSelect()}
          WHERE md.dividend_status IN ('Withdrawal Requested', 'Capitalization Requested')
          ORDER BY md.decided_at DESC, md.member_dividend_id DESC`,
      );
      return rows.map((row) => ({ ...mapDividend(row), memberId: row.memberId, memberCode: row.memberCode, memberName: row.memberName }));
    },

    async listDividendActionHistory() {
      const [rows] = await databasePool().execute<DividendRow[]>(
        `${dividendSelect()}
          WHERE md.dividend_status IN ('Withdrawn', 'Added to Share Capital')
          ORDER BY md.processed_at DESC, md.member_dividend_id DESC`,
      );
      return rows.map((row) => ({ ...mapDividend(row), memberId: row.memberId, memberCode: row.memberCode, memberName: row.memberName }));
    },

    async completeDividendAction(dividendId, input, actorUserId) {
      return withTransaction(async (connection) => {
        const [rows] = await connection.execute<DividendRow[]>(
          `${dividendSelect()}
            WHERE md.member_dividend_id = ?
            LIMIT 1 FOR UPDATE`,
          [dividendId],
        );
        const dividend = rows[0];
        if (!dividend) throw new AppError("Dividend was not found", 404, "DIVIDEND_NOT_FOUND");
        if (dividend.status !== "Withdrawal Requested" && dividend.status !== "Capitalization Requested") {
          throw new AppError("This dividend is not awaiting Bookkeeper processing", 409, "DIVIDEND_ACTION_NOT_PENDING");
        }
        const notes = input.notes?.trim() || null;

        if (dividend.status === "Withdrawal Requested") {
          const normalizedReference = (input.referenceNumber ?? "").trim();
          if (normalizedReference.length < 2) {
            throw new AppError("An official payout reference is required to complete a withdrawal", 400, "DIVIDEND_WITHDRAWAL_REFERENCE_REQUIRED");
          }
          const normalizedReceipt = input.withdrawalReceipt?.trim() || null;
          const normalizedReceiptName = normalizedReceipt ? input.withdrawalReceiptName?.trim() || null : null;
          const [categoryRows] = await connection.execute<IdRow[]>(
            `SELECT CAST(financial_category_id AS CHAR) AS id
               FROM financial_categories
              WHERE category_code IN ('DIVIDEND_PAYMENT', 'OTHER_EXPENSE') AND is_active = 1
              ORDER BY FIELD(category_code, 'DIVIDEND_PAYMENT', 'OTHER_EXPENSE')
              LIMIT 1`,
          );
          if (!categoryRows[0]) throw new AppError("A dividend expense category is required", 409, "DIVIDEND_FINANCE_CATEGORY_REQUIRED");
          await connection.execute(
            `INSERT INTO financial_records
               (record_number, member_id, financial_category_id, recorded_by, approved_by,
                record_type, source_module, source_record_id, amount, record_date, remarks)
               VALUES (?, ?, ?, ?, ?, 'Expense', 'Share Capital', ?, ?, UTC_DATE(), ?)`,
            [
              `DIV-WD-${dividendId}`,
              dividend.memberId,
              categoryRows[0].id,
              actorUserId,
              actorUserId,
              dividendId,
              money(dividend.amount),
              `Dividend withdrawal ${normalizedReference}${notes ? `: ${notes}` : ""}`,
            ],
          );
          const [completionResult] = await connection.execute<ResultSetHeader>(
            `UPDATE member_dividends
                SET dividend_status = 'Withdrawn', processed_at = UTC_TIMESTAMP(),
                    processed_by = ?, withdrawal_reference = ?, processing_notes = ?,
                    withdrawal_receipt = ?, withdrawal_receipt_name = ?
              WHERE member_dividend_id = ? AND dividend_status = 'Withdrawal Requested'`,
            [actorUserId, normalizedReference, notes, normalizedReceipt, normalizedReceiptName, dividendId],
          );
          if (completionResult.affectedRows !== 1) {
            throw new AppError("The withdrawal was already completed", 409, "DIVIDEND_WITHDRAWAL_ALREADY_COMPLETED");
          }
          await connection.execute(
            `INSERT INTO dividend_action_history
               (member_dividend_id, previous_status, new_status, action_name, remarks, performed_by)
             VALUES (?, 'Withdrawal Requested', 'Withdrawn', 'Withdrawal completed', ?, ?)`,
            [dividendId, `Payout reference: ${normalizedReference}${normalizedReceipt ? " Receipt attached." : ""}${notes ? `. ${notes}` : ""}`, actorUserId],
          );
        } else {
          await connection.execute(
            `INSERT INTO share_capital_accounts (member_id) VALUES (?)
             ON DUPLICATE KEY UPDATE member_id = member_id`,
            [dividend.memberId],
          );
          const account = await selectAccount(connection, dividend.memberId, true);
          if (!account) throw new AppError("Share Capital account could not be created", 500, "SHARE_CAPITAL_ACCOUNT_CREATE_FAILED");
          const amount = money(dividend.amount);
          const balanceBefore = money(account.currentBalance);
          const balanceAfter = money(balanceBefore + amount);
          if (balanceAfter > MAX_SHARE_CAPITAL) {
            throw new AppError("Adding this dividend would exceed the PHP 15,000 Share Capital limit", 409, "SHARE_CAPITAL_LIMIT_EXCEEDED");
          }
          const [transactionResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO share_capital_transactions
               (share_capital_account_id, member_id, transaction_date, transaction_type,
                direction, amount, balance_before, balance_after, reference_number,
                source_type, source_id, transaction_status, remarks, created_by)
             VALUES (?, ?, UTC_DATE(), 'Dividend Added to Share Capital', 'Credit',
                     ?, ?, ?, ?, 'member_dividend', ?, 'Posted', ?, ?)`,
            [
              account.accountId,
              dividend.memberId,
              amount,
              balanceBefore,
              balanceAfter,
              `DIV-CAP-${dividendId}`,
              dividendId,
              `Dividend from ${dividend.declarationName} added to Share Capital`,
              actorUserId,
            ],
          );
          const transactionId = String(transactionResult.insertId);
          await connection.execute(
            `UPDATE share_capital_accounts
                SET total_dividends_added = total_dividends_added + ?, current_balance = ?
              WHERE share_capital_account_id = ?`,
            [amount, balanceAfter, account.accountId],
          );
          const [completionResult] = await connection.execute<ResultSetHeader>(
            `UPDATE member_dividends
                SET dividend_status = 'Added to Share Capital', processed_at = UTC_TIMESTAMP(),
                    processed_by = ?, share_capital_transaction_id = ?, processing_notes = ?
              WHERE member_dividend_id = ? AND dividend_status = 'Capitalization Requested'`,
            [actorUserId, transactionId, notes, dividendId],
          );
          if (completionResult.affectedRows !== 1) {
            throw new AppError("The Share Capital addition was already completed", 409, "DIVIDEND_CAPITALIZATION_ALREADY_COMPLETED");
          }
          await connection.execute(
            `INSERT INTO dividend_action_history
               (member_dividend_id, previous_status, new_status, action_name, remarks, performed_by)
             VALUES (?, 'Capitalization Requested', 'Added to Share Capital', 'Share Capital addition approved', ?, ?)`,
            [dividendId, `Added ${amount.toFixed(2)} to Share Capital${notes ? `. ${notes}` : ""}`, actorUserId],
          );
        }
        const [updatedRows] = await connection.execute<DividendRow[]>(
          `${dividendSelect()} WHERE md.member_dividend_id = ? LIMIT 1`,
          [dividendId],
        );
        return mapDividend(updatedRows[0]);
      }, databasePool());
    },
  };
}
