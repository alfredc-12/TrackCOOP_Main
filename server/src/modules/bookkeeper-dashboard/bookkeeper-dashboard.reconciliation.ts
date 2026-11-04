/**
 * Read-only financial reconciliation and eligibility comparison helpers.
 *
 * IMPORTANT: These functions are strictly diagnostic and test-facing. They do NOT replace or modify
 * live payout, patronage, dividend, or settlement queries until separately approved by the Cooperative.
 */
import { classifyFinancialRecord, type FinancialRecordLike } from "../finance/financial-posting-rules";
import { formatCentavos, toCentavos, type Centavos } from "./bookkeeper-dashboard.money";

export type ReconcilableFinancialRow = Omit<FinancialRecordLike, "amount"> & {
  id: string;
  recordDate: string;
  amount: string;
  paymentPurpose?: string | null;
  gatewayEnvironment?: "Live" | "Test" | null;
  paymentChannel?: string | null;
  validationStatus?: string | null;
};

export type BasisComparison = {
  /** Authoritative Bookkeeper Dashboard / postedOperatingSql basis. */
  operatingDashboard: {
    income: string;
    expenses: string;
    netSurplus: string;
    adjustmentsDisclosed: string;
  };
  /** Current Patronage financialBasis query behavior in patronage.repository.ts (before proposed fix). */
  incumbentPatronageBasis: {
    posAndRentalIncome: string;
    expenses: string;
    adjustmentsNetted: string;
    netOperatingSurplus: string;
  };
  /** Proposed Patronage basis (postedOperatingSql + adjustments disclosed separately, no reversal double-count). */
  proposedPatronageBasis: {
    posAndRentalIncome: string;
    expenses: string;
    adjustmentsDisclosed: string;
    netOperatingSurplus: string;
  };
  /** Current Annual Interest on Share Capital basis in share-capital-ledger.repository.ts (before proposed fix). */
  incumbentDividendBasis: {
    income: string;
    expenses: string;
    netSurplus: string;
  };
  /** Proposed Annual Interest on Share Capital basis aligned with postedOperatingSql. */
  proposedDividendBasis: {
    income: string;
    expenses: string;
    netSurplus: string;
  };
  discrepancies: Array<{
    code:
      | "PATRONAGE_REVERSAL_DOUBLE_COUNT"
      | "DIVIDEND_INCLUDES_MEMBERSHIP_SHARE_CAPITAL"
      | "DIVIDEND_INCLUDES_TEST_PAYMENT"
      | "PATRONAGE_INCLUDES_TEST_PAYMENT"
      | "PATRONAGE_INCLUDES_CAPITAL_EXPENSE";
    severity: "high-payout-impact";
    centavoDelta: Centavos;
    pesoDelta: string;
    description: string;
  }>;
};

function isTestGateway(row: ReconcilableFinancialRow): boolean {
  return row.paymentChannel === "PayMongo" && row.gatewayEnvironment === "Test";
}

function isEligibleOperating(row: ReconcilableFinancialRow): boolean {
  if (isTestGateway(row)) return false;
  const classification = classifyFinancialRecord({
    ...row,
    amount: toCentavos(row.amount),
    capitalPayment: row.paymentPurpose === "Share Capital" || row.capitalPayment,
  });
  return classification === "operating-income" || classification === "operating-expense";
}

/**
 * Evaluates a dataset of financial records under the incumbent vs. proposed eligibility rules across
 * Operating Dashboard, Patronage Financial Basis, and Annual Interest on Share Capital Basis.
 */
export function compareFinancialBases(rows: ReconcilableFinancialRow[]): BasisComparison {
  let opIncome = 0;
  let opExpense = 0;
  let opAdjustments = 0;

  let patIncumbentIncome = 0;
  let patIncumbentExpense = 0;
  let patIncumbentAdjustments = 0;

  let patProposedIncome = 0;
  let patProposedExpense = 0;

  let divIncumbentIncome = 0;
  let divIncumbentExpense = 0;

  let membershipCapitalInDividend = 0;
  let testInDividend = 0;
  let testInPatronage = 0;
  let capitalExpenseInPatronage = 0;

  for (const row of rows) {
    const cents = toCentavos(row.amount);
    const postedActive = row.recordStatus === "Active" && Boolean(row.approvedBy);

    // 1. Authoritative Operating Dashboard (postedOperatingSql)
    if (isEligibleOperating(row)) {
      if (row.recordType === "Income") opIncome += cents;
      if (row.recordType === "Expense") opExpense += cents;
    }
    if (postedActive && row.recordType === "Adjustment" && !isTestGateway(row)) {
      opAdjustments += cents;
    }

    // 2. Incumbent Patronage Financial Basis (patronage.repository.ts lines 235-267)
    if (postedActive) {
      if (row.recordType === "Income" && (row.sourceModule === "POS" || row.sourceModule === "Rental")) {
        patIncumbentIncome += cents;
        if (isTestGateway(row)) testInPatronage += cents;
      }
      if (row.recordType === "Expense") {
        patIncumbentExpense += cents;
        if (!isEligibleOperating(row) && !isTestGateway(row)) {
          capitalExpenseInPatronage += cents;
        }
      }
      if (row.recordType === "Adjustment") {
        patIncumbentAdjustments += cents;
      }
    }

    // 3. Proposed Patronage Basis (aligned to postedOperatingSql, adjustments disclosed separately)
    if (isEligibleOperating(row)) {
      if (row.recordType === "Income" && (row.sourceModule === "POS" || row.sourceModule === "Rental")) {
        patProposedIncome += cents;
      }
      if (row.recordType === "Expense") {
        patProposedExpense += cents;
      }
    }

    // 4. Incumbent Dividend / Interest on Share Capital Basis (share-capital-ledger.repository.ts lines 286-291)
    if (postedActive) {
      if (row.recordType === "Income" && row.sourceModule !== "Share Capital" && !row.superseded) {
        divIncumbentIncome += cents;
        const isCapitalLeak =
          !isEligibleOperating(row) &&
          (row.paymentPurpose === "Share Capital" ||
            (row.categoryCode ?? "").toUpperCase() === "SHARE_CAPITAL" ||
            (row.categoryName ?? "").toUpperCase().includes("SHARE CAPITAL"));
        if (isCapitalLeak) membershipCapitalInDividend += cents;
        if (isTestGateway(row)) testInDividend += cents;
      }
      if (row.recordType === "Expense" && !row.superseded) {
        divIncumbentExpense += cents;
      }
    }
  }

  const discrepancies: BasisComparison["discrepancies"] = [];

  if (patIncumbentAdjustments !== 0) {
    discrepancies.push({
      code: "PATRONAGE_REVERSAL_DOUBLE_COUNT",
      severity: "high-payout-impact",
      centavoDelta: patIncumbentAdjustments,
      pesoDelta: formatCentavos(patIncumbentAdjustments),
      description:
        "Incumbent patronage basis adds negative reversal Adjustments while also excluding the reversed original Income row, reducing netOperatingSurplus twice.",
    });
  }

  if (membershipCapitalInDividend !== 0) {
    discrepancies.push({
      code: "DIVIDEND_INCLUDES_MEMBERSHIP_SHARE_CAPITAL",
      severity: "high-payout-impact",
      centavoDelta: membershipCapitalInDividend,
      pesoDelta: formatCentavos(membershipCapitalInDividend),
      description:
        "Incumbent dividend basis only filters source_module <> 'Share Capital', allowing Membership-settled share-capital contributions to inflate distributable surplus.",
    });
  }

  if (testInDividend !== 0) {
    discrepancies.push({
      code: "DIVIDEND_INCLUDES_TEST_PAYMENT",
      severity: "high-payout-impact",
      centavoDelta: testInDividend,
      pesoDelta: formatCentavos(testInDividend),
      description: "Incumbent dividend basis does not exclude PayMongo Test-environment settlements.",
    });
  }

  if (testInPatronage !== 0) {
    discrepancies.push({
      code: "PATRONAGE_INCLUDES_TEST_PAYMENT",
      severity: "high-payout-impact",
      centavoDelta: testInPatronage,
      pesoDelta: formatCentavos(testInPatronage),
      description: "Incumbent patronage basis does not exclude PayMongo Test-environment settlements.",
    });
  }

  if (capitalExpenseInPatronage !== 0) {
    discrepancies.push({
      code: "PATRONAGE_INCLUDES_CAPITAL_EXPENSE",
      severity: "high-payout-impact",
      centavoDelta: -capitalExpenseInPatronage,
      pesoDelta: formatCentavos(-capitalExpenseInPatronage),
      description:
        "Incumbent patronage basis includes Expense rows with source_module = 'Share Capital' or capital/payout codes.",
    });
  }

  const opNet = opIncome - opExpense;
  const patIncumbentNet = patIncumbentIncome - patIncumbentExpense + patIncumbentAdjustments;
  const patProposedNet = patProposedIncome - patProposedExpense;
  const divIncumbentNet = divIncumbentIncome - divIncumbentExpense;

  return {
    operatingDashboard: {
      income: formatCentavos(opIncome),
      expenses: formatCentavos(opExpense),
      netSurplus: formatCentavos(opNet),
      adjustmentsDisclosed: formatCentavos(opAdjustments),
    },
    incumbentPatronageBasis: {
      posAndRentalIncome: formatCentavos(patIncumbentIncome),
      expenses: formatCentavos(patIncumbentExpense),
      adjustmentsNetted: formatCentavos(patIncumbentAdjustments),
      netOperatingSurplus: formatCentavos(patIncumbentNet),
    },
    proposedPatronageBasis: {
      posAndRentalIncome: formatCentavos(patProposedIncome),
      expenses: formatCentavos(patProposedExpense),
      adjustmentsDisclosed: formatCentavos(opAdjustments),
      netOperatingSurplus: formatCentavos(patProposedNet),
    },
    incumbentDividendBasis: {
      income: formatCentavos(divIncumbentIncome),
      expenses: formatCentavos(divIncumbentExpense),
      netSurplus: formatCentavos(divIncumbentNet),
    },
    proposedDividendBasis: {
      income: formatCentavos(opIncome),
      expenses: formatCentavos(opExpense),
      netSurplus: formatCentavos(opNet),
    },
    discrepancies,
  };
}

/**
 * Proposed strict category resolution for membership settlement (Decision 4 — prepared and tested,
 * NOT wired into paymongo.settlement.finance.ts without separate approval).
 *
 * Unlike the incumbent fallback `["SHARE_CAPITAL", "MEMBERSHIP_FEE", "OTHER_INCOME"]`, a Share Capital
 * settlement never falls back to an ordinary income category.
 */
export function resolveStrictSettlementCategoryCodes(paymentPurpose: string): readonly string[] {
  if (paymentPurpose === "Share Capital") {
    return ["SHARE_CAPITAL"] as const;
  }
  return ["ASSOCIATE_MEMBERSHIP_FEE", "MEMBERSHIP_FEE"] as const;
}

/**
 * Proposed Asia/Manila settlement record date helper (Decision 5 — prepared and tested,
 * NOT wired into live settlement writers without separate approval).
 */
export function proposedManilaSettlementRecordDate(paidAt: Date | null | undefined, now = new Date()): string {
  const reference = paidAt ?? now;
  return new Date(reference.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Schema-verified read-only SQL reconciliation queries for production verification.
 * Verified against TrackCOOP_MAIN_Database.sql and server/database/migrations/*.sql.
 * Do NOT execute against production without separate cooperative authorization.
 */
export const READ_ONLY_RECONCILIATION_QUERIES = {
  patronageReversalDoubleCount: `SELECT
  YEAR(fr.record_date) AS reversal_year,
  pp.patronage_period_id,
  pp.period_name,
  pp.period_status,
  COUNT(fr.financial_record_id) AS reversal_adjustment_count,
  CAST(COALESCE(SUM(fr.amount), 0.00) AS DECIMAL(18, 2)) AS total_double_counted_delta_php,
  CAST(COALESCE(SUM(CASE WHEN orig.record_status = 'Reversed' THEN orig.amount ELSE 0.00 END), 0.00) AS DECIMAL(18, 2)) AS excluded_original_income_php
FROM financial_records fr
INNER JOIN financial_records orig
  ON orig.financial_record_id = fr.reversal_of_record_id
LEFT JOIN patronage_periods pp
  ON fr.record_date >= pp.period_start
 AND fr.record_date < DATE_ADD(pp.period_end, INTERVAL 1 DAY)
WHERE fr.record_status = 'Active'
  AND fr.approved_by IS NOT NULL
  AND fr.record_type = 'Adjustment'
  AND fr.reversal_of_record_id IS NOT NULL
  AND orig.source_module IN ('POS', 'Rental')
  AND orig.record_type = 'Income'
GROUP BY
  YEAR(fr.record_date),
  pp.patronage_period_id,
  pp.period_name,
  pp.period_status
ORDER BY reversal_year DESC, pp.patronage_period_id DESC`,

  membershipShareCapitalInDividendBasis: `SELECT
  fr.financial_record_id,
  fr.record_number,
  DATE_FORMAT(fr.record_date, '%Y-%m-%d') AS record_date,
  fr.source_module,
  fc.financial_category_id,
  fc.category_code,
  fc.category_name,
  pr.payment_reference_id,
  pr.reference_number AS payment_reference_number,
  pr.payment_purpose,
  pr.related_entity_type,
  sp.share_payment_id,
  sp.payment_status AS share_payment_status,
  dd.dividend_declaration_id,
  dd.declaration_name,
  dd.declaration_status,
  CAST(fr.amount AS DECIMAL(18, 2)) AS leaked_capital_amount_php
FROM financial_records fr
INNER JOIN financial_categories fc
  ON fc.financial_category_id = fr.financial_category_id
LEFT JOIN payment_references pr
  ON pr.payment_reference_id = fr.payment_reference_id
LEFT JOIN share_capital_payments sp
  ON sp.payment_reference_id = fr.payment_reference_id
LEFT JOIN dividend_declarations dd
  ON fr.record_date >= dd.coverage_start
 AND fr.record_date < DATE_ADD(dd.coverage_end, INTERVAL 1 DAY)
 AND dd.declaration_status <> 'Cancelled'
WHERE fr.record_status = 'Active'
  AND fr.approved_by IS NOT NULL
  AND fr.record_type = 'Income'
  AND fr.source_module <> 'Share Capital'
  AND (
    UPPER(COALESCE(fc.category_code, '')) = 'SHARE_CAPITAL'
    OR UPPER(COALESCE(fc.category_name, '')) LIKE '%SHARE CAPITAL%'
    OR pr.payment_purpose = 'Share Capital'
    OR sp.share_payment_id IS NOT NULL
  )
ORDER BY fr.record_date DESC, fr.financial_record_id DESC`,

  paymongoTestPaymentsInLiveTables: `SELECT
  pr.gateway_environment,
  pr.payment_purpose,
  pr.validation_status,
  COUNT(pr.payment_reference_id) AS test_payment_ref_count,
  CAST(COALESCE(SUM(pr.amount), 0.00) AS DECIMAL(18, 2)) AS test_payment_ref_amount_php,
  COALESCE(SUM(fin.active_record_count), 0) AS active_financial_record_count,
  CAST(COALESCE(SUM(fin.active_record_amount), 0.00) AS DECIMAL(18, 2)) AS active_financial_amount_php,
  COALESCE(SUM(cap.validated_payment_count), 0) AS validated_share_payment_count,
  COALESCE(SUM(cap.posted_ledger_count), 0) AS posted_capital_ledger_count,
  CAST(COALESCE(SUM(cap.posted_ledger_amount), 0.00) AS DECIMAL(18, 2)) AS posted_capital_ledger_amount_php
FROM payment_references pr
LEFT JOIN (
  SELECT
    fr.payment_reference_id,
    COUNT(fr.financial_record_id) AS active_record_count,
    SUM(fr.amount) AS active_record_amount
  FROM financial_records fr
  WHERE fr.record_status = 'Active'
    AND fr.approved_by IS NOT NULL
  GROUP BY fr.payment_reference_id
) fin ON fin.payment_reference_id = pr.payment_reference_id
LEFT JOIN (
  SELECT
    sp.payment_reference_id,
    COUNT(DISTINCT sp.share_payment_id) AS validated_payment_count,
    COUNT(DISTINCT sct.share_capital_transaction_id) AS posted_ledger_count,
    SUM(CASE WHEN sct.direction = 'Credit' THEN sct.amount WHEN sct.direction = 'Debit' THEN -sct.amount ELSE 0.00 END) AS posted_ledger_amount
  FROM share_capital_payments sp
  LEFT JOIN share_capital_transactions sct
    ON sct.source_type IN ('share_capital_payment', 'share_capital_payment_reversal')
   AND sct.source_id = CAST(sp.share_payment_id AS CHAR)
   AND sct.transaction_status = 'Posted'
  WHERE sp.payment_status IN ('Validated', 'Reversed')
  GROUP BY sp.payment_reference_id
) cap ON cap.payment_reference_id = pr.payment_reference_id
WHERE pr.payment_channel = 'PayMongo'
  AND pr.gateway_environment = 'Test'
GROUP BY
  pr.gateway_environment,
  pr.payment_purpose,
  pr.validation_status
ORDER BY pr.payment_purpose ASC, pr.validation_status ASC`,

  unpostedExpensesInBudgetCalculations: `SELECT
  YEAR(fr.record_date) AS expense_year,
  fc.financial_category_id,
  fc.category_code,
  fc.category_name,
  fr.season_id,
  b.budget_id,
  b.budget_name,
  b.budget_status,
  COUNT(fr.financial_record_id) AS unposted_active_expense_count,
  CAST(COALESCE(SUM(fr.amount), 0.00) AS DECIMAL(18, 2)) AS unposted_expense_amount_php
FROM financial_records fr
INNER JOIN financial_categories fc
  ON fc.financial_category_id = fr.financial_category_id
LEFT JOIN budget_lines bl
  ON bl.financial_category_id = fr.financial_category_id
 AND (
   (bl.season_id IS NULL AND fr.season_id IS NULL)
   OR (bl.season_id IS NOT NULL AND fr.season_id = bl.season_id)
 )
LEFT JOIN budgets b
  ON b.budget_id = bl.budget_id
 AND fr.record_date BETWEEN b.coverage_start AND b.coverage_end
WHERE fr.record_type = 'Expense'
  AND fr.record_status = 'Active'
  AND fr.approved_by IS NULL
GROUP BY
  YEAR(fr.record_date),
  fc.financial_category_id,
  fc.category_code,
  fc.category_name,
  fr.season_id,
  b.budget_id,
  b.budget_name,
  b.budget_status
ORDER BY expense_year DESC, unposted_expense_amount_php DESC`,

  utcVsManilaSettlementRecordDates: `SELECT
  scoped.financial_record_id,
  scoped.record_number,
  scoped.source_module,
  scoped.record_type,
  scoped.record_status,
  scoped.payment_reference_id,
  scoped.reference_number,
  scoped.validation_source,
  scoped.event_kind,
  DATE_FORMAT(scoped.record_date, '%Y-%m-%d') AS recorded_utc_date,
  DATE_FORMAT(DATE(DATE_ADD(scoped.utc_event_at, INTERVAL 8 HOUR)), '%Y-%m-%d') AS manila_calendar_date,
  DATE_FORMAT(scoped.utc_event_at, '%Y-%m-%d %H:%i:%s') AS utc_event_timestamp,
  DATE_FORMAT(DATE_ADD(scoped.utc_event_at, INTERVAL 8 HOUR), '%Y-%m-%d %H:%i:%s') AS manila_event_timestamp,
  CAST(scoped.amount AS DECIMAL(18, 2)) AS amount_php
FROM (
  SELECT
    fr.financial_record_id,
    fr.record_number,
    fr.source_module,
    fr.record_type,
    fr.record_status,
    fr.record_date,
    fr.amount,
    pr.payment_reference_id,
    pr.reference_number,
    pr.validation_source,
    CASE
      WHEN fr.reversal_of_record_id IS NOT NULL THEN 'payment_reversal'
      ELSE 'payment_settlement'
    END AS event_kind,
    CASE
      WHEN fr.reversal_of_record_id IS NOT NULL THEN COALESCE(rec.reversed_at, pr.updated_at)
      WHEN pr.validation_source = 'PayMongo Webhook' THEN COALESCE(pr.paid_at, pr.validated_at)
      ELSE COALESCE(pr.validated_at, pr.paid_at)
    END AS utc_event_at
  FROM financial_records fr
  INNER JOIN payment_references pr
    ON pr.payment_reference_id = fr.payment_reference_id
  LEFT JOIN (
    SELECT payment_reference_id, MAX(reversed_at) AS reversed_at
    FROM payment_receipts
    GROUP BY payment_reference_id
  ) rec ON rec.payment_reference_id = pr.payment_reference_id
) scoped
WHERE scoped.utc_event_at IS NOT NULL
  AND scoped.record_date = DATE(scoped.utc_event_at)
  AND scoped.record_date <> DATE(DATE_ADD(scoped.utc_event_at, INTERVAL 8 HOUR))
ORDER BY scoped.financial_record_id DESC`,
} as const;

