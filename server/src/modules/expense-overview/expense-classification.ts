/**
 * Economic classification of ledger Expense rows for the Chairman Financial Overview.
 *
 * `financial_categories.category_type` only says Income / Expense / Both, so it cannot separate operating
 * costs from capital purchases or from money that merely leaves the cooperative (dividends, refunds,
 * transfers). Until an approved, stored classification exists (see the proposal in
 * server/database/proposals/), the class is derived from the category code with this registry. Nothing is
 * written to the database and historical rows are never reclassified.
 *
 * `basis` says how trustworthy a class is:
 *  - registry:   the category code is named in this registry.
 *  - default:    an Expense-type category the registry does not know; treated as operating so a custom
 *                category is never silently dropped, and surfaced in the integrity panel for confirmation.
 *  - unresolved: the category is not an Expense category (Income / Both) yet carries an Expense row.
 */
export const expenseClasses = [
  "operating",
  "other_recognized",
  "capital",
  "non_expense_disbursement",
  "unclassified",
] as const;
export type ExpenseClass = (typeof expenseClasses)[number];
export type ClassificationBasis = "registry" | "default" | "unresolved";

export const expenseClassLabels: Record<ExpenseClass, string> = {
  operating: "Operating expense",
  other_recognized: "Other recognized expense",
  capital: "Capital expenditure",
  non_expense_disbursement: "Non-expense disbursement",
  unclassified: "Needs classification",
};

export const expenseClassDescriptions: Record<ExpenseClass, string> = {
  operating: "Day-to-day running costs of the cooperative.",
  other_recognized: "Recognized expenses outside the operating set, such as the cost of goods bought for resale.",
  capital: "Money used to acquire long-lived assets. Not an ordinary operating expense.",
  non_expense_disbursement: "Money that left the cooperative without being an expense: dividends, refunds, principal repayments, transfers.",
  unclassified: "The economic nature cannot be established from the category. Review before relying on totals.",
};

const operatingCodes = [
  "SALARIES_WAGES",
  "FUEL_GASOLINE",
  "UTILITIES",
  "REPAIR_MAINTENANCE",
  "OFFICE_SUPPLIES",
  "SUPPLIES",
  "INSURANCE",
  "TRANSPORTATION",
  "OTHER_EXPENSE",
] as const;
const otherRecognizedCodes = ["PRODUCT_COST"] as const;
const capitalCodes = ["CAPITAL_EXPENDITURE", "EQUIPMENT_PURCHASE", "ASSET_ACQUISITION", "FIXED_ASSETS"] as const;
const nonExpenseCodes = [
  "DIVIDEND_PAYMENT",
  "SHARE_CAPITAL",
  "CAPITAL_REFUND",
  "LOAN_PRINCIPAL",
  "PRINCIPAL_REPAYMENT",
  "PATRONAGE_REFUND",
  "TRANSFER",
] as const;

export const classificationRegistry = {
  operating: operatingCodes,
  other_recognized: otherRecognizedCodes,
  capital: capitalCodes,
  non_expense_disbursement: nonExpenseCodes,
} as const;

const classByCode = new Map<string, ExpenseClass>();
for (const [expenseClass, codes] of Object.entries(classificationRegistry)) {
  for (const code of codes) classByCode.set(code, expenseClass as ExpenseClass);
}

export type ClassificationInput = {
  categoryCode: string | null;
  categoryType: string | null;
  sourceModule: string | null;
};

/** TypeScript twin of {@link classificationSql}; the integration tests keep the two in agreement. */
export function classifyExpense(input: ClassificationInput): { expenseClass: ExpenseClass; basis: ClassificationBasis } {
  const code = (input.categoryCode ?? "").toUpperCase();
  // Share-capital movements (including dividend withdrawals from capital accounts) are not expenses.
  if (input.sourceModule === "Share Capital") return { expenseClass: "non_expense_disbursement", basis: "registry" };
  const known = classByCode.get(code);
  if (known) return { expenseClass: known, basis: "registry" };
  if (input.categoryType === "Expense") return { expenseClass: "operating", basis: "default" };
  return { expenseClass: "unclassified", basis: "unresolved" };
}

function codeList(codes: readonly string[]) {
  for (const code of codes) {
    if (!/^[A-Z0-9_]+$/.test(code)) throw new Error(`Invalid category code in classification registry: ${code}`);
  }
  return codes.map((code) => `'${code}'`).join(", ");
}

/** SQL expression yielding the expense class of one financial_records row `r` joined to its category `c`. */
export function classificationSql(record = "r", category = "c") {
  const code = `UPPER(${category}.category_code)`;
  return `(CASE
    WHEN ${record}.source_module = 'Share Capital' THEN 'non_expense_disbursement'
    WHEN ${code} IN (${codeList(nonExpenseCodes)}) THEN 'non_expense_disbursement'
    WHEN ${code} IN (${codeList(capitalCodes)}) THEN 'capital'
    WHEN ${code} IN (${codeList(otherRecognizedCodes)}) THEN 'other_recognized'
    WHEN ${code} IN (${codeList(operatingCodes)}) THEN 'operating'
    WHEN ${category}.category_type = 'Expense' THEN 'operating'
    ELSE 'unclassified'
  END)`;
}

/** SQL expression: 1 when the class comes from the registry, 0 when it is a default or unresolved. */
export function registryBackedSql(record = "r", category = "c") {
  const code = `UPPER(${category}.category_code)`;
  const all = [...nonExpenseCodes, ...capitalCodes, ...otherRecognizedCodes, ...operatingCodes];
  return `(CASE WHEN ${record}.source_module = 'Share Capital' OR ${code} IN (${codeList(all)}) THEN 1 ELSE 0 END)`;
}

export function isExpenseClass(value: string): value is ExpenseClass {
  return (expenseClasses as readonly string[]).includes(value);
}
