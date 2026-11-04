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

