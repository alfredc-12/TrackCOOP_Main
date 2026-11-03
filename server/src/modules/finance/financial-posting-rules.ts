/** Authoritative eligibility used by operational overview, summaries, trends and analytics.
 * Capital/transfers/principal are not operating flows. Category labels are a legacy guard;
 * source identity, category code and the original payment purpose are authoritative checks.
 */
export const excludedOperatingCodes = [
  "SHARE_CAPITAL",
  "CAPITAL_REFUND",
  "DIVIDEND_PAYMENT",
  "PATRONAGE_REFUND",
  "TRANSFER",
  "INTERNAL_TRANSFER",
  "LOAN_PRINCIPAL",
  "LOAN_PROCEEDS",
  "PRINCIPAL_REPAYMENT",
  "CAPITAL_EXPENDITURE",
  "EQUIPMENT_PURCHASE",
  "ASSET_ACQUISITION",
  "FIXED_ASSETS",
] as const;
export type FinancialRecordLike = {
  recordType: string;
  recordStatus: string;
  approvedBy: string | null;
  sourceModule: string;
  categoryCode?: string | null;
  categoryName?: string | null;
  categoryType?: string | null;
  amount?: number;
  superseded?: boolean;
  duplicate?: boolean;
  reversalOfId?: string | null;
  capitalPayment?: boolean;
};
export type FinancialRecordClassification =
  | "operating-income"
  | "operating-expense"
  | "adjustment"
  | "capital-movement"
  | "unposted"
  | "inactive"
  | "classification-review";
export function isCapitalMovement(
  r: Pick<
    FinancialRecordLike,
    "sourceModule" | "categoryCode" | "categoryName"
  >,
) {
  return (
    r.sourceModule === "Share Capital" ||
    (excludedOperatingCodes as readonly string[]).includes(
      (r.categoryCode ?? "").toUpperCase(),
    ) ||
    (r.categoryName ?? "").toUpperCase().includes("SHARE CAPITAL")
  );
}
export function classifyFinancialRecord(
  r: FinancialRecordLike,
): FinancialRecordClassification {
  if (r.recordStatus !== "Active" || r.superseded || r.reversalOfId)
    return "inactive";
  if (!r.approvedBy) return "unposted";
  if (r.recordType === "Adjustment") return "adjustment";
  if (!["Income", "Expense"].includes(r.recordType)) return "inactive";
  if (isCapitalMovement(r) || r.capitalPayment) return "capital-movement";
  if (
    r.duplicate ||
    (r.amount !== undefined && r.amount <= 0) ||
    (r.categoryType &&
      r.categoryType !== "Both" &&
      r.categoryType !== r.recordType)
  )
    return "classification-review";
  return r.recordType === "Income" ? "operating-income" : "operating-expense";
}
export function postedRecordSql(r = "fr") {
  return `${r}.record_status = 'Active' AND ${r}.approved_by IS NOT NULL`;
}
export function capitalMovementSql(r = "fr", c = "fc") {
  return `(${r}.source_module='Share Capital' OR UPPER(COALESCE(${c}.category_code,'')) IN (${excludedOperatingCodes.map((x) => `'${x}'`).join(",")}) OR UPPER(COALESCE(${c}.category_name,'')) LIKE '%SHARE CAPITAL%' OR EXISTS(SELECT 1 FROM payment_references cap_ref WHERE cap_ref.payment_reference_id=${r}.payment_reference_id AND cap_ref.payment_purpose='Share Capital'))`;
}
export function supersededSql(r = "fr") {
  return `(${r}.reversal_of_record_id IS NOT NULL OR EXISTS(SELECT 1 FROM financial_records child WHERE child.record_status='Active' AND child.approved_by IS NOT NULL AND (child.correction_of_record_id=${r}.financial_record_id OR child.reversal_of_record_id=${r}.financial_record_id)))`;
}
export function duplicatePostingSql(r = "fr") {
  return `(${r}.record_type='Income' AND ${r}.payment_reference_id IS NOT NULL AND EXISTS(SELECT 1 FROM financial_records duplicate_record WHERE duplicate_record.payment_reference_id=${r}.payment_reference_id AND duplicate_record.financial_record_id<>${r}.financial_record_id AND duplicate_record.record_type=${r}.record_type AND duplicate_record.record_status='Active' AND duplicate_record.approved_by IS NOT NULL AND duplicate_record.reversal_of_record_id IS NULL AND NOT EXISTS(SELECT 1 FROM financial_records replacement WHERE replacement.correction_of_record_id=duplicate_record.financial_record_id AND replacement.record_status='Active' AND replacement.approved_by IS NOT NULL)))`;
}
export function compatibleCategorySql(r = "fr", c = "fc") {
  return `(${c}.financial_category_id IS NOT NULL AND (${c}.category_type=${r}.record_type OR ${c}.category_type='Both'))`;
}
export function sourceMismatchSql(r = "fr") {
  return `(${r}.payment_reference_id IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM payment_references linked_ref WHERE linked_ref.payment_reference_id=${r}.payment_reference_id) OR EXISTS(SELECT 1 FROM payment_references linked_ref WHERE linked_ref.payment_reference_id=${r}.payment_reference_id AND ((linked_ref.payment_channel='PayMongo' AND linked_ref.gateway_environment='Test') OR (${r}.record_type='Income' AND ${r}.source_module IN ('POS','Rental','Payment') AND (linked_ref.validation_status<>'Validated' OR linked_ref.amount<>${r}.amount))))))`;
}
export function relationshipIssueSql(r = "fr") {
  return `((${r}.correction_of_record_id IS NOT NULL AND (${r}.correction_of_record_id=${r}.financial_record_id OR NOT EXISTS(SELECT 1 FROM financial_records parent WHERE parent.financial_record_id=${r}.correction_of_record_id AND parent.record_type=${r}.record_type))) OR (${r}.reversal_of_record_id IS NOT NULL AND (${r}.reversal_of_record_id=${r}.financial_record_id OR NOT EXISTS(SELECT 1 FROM financial_records parent WHERE parent.financial_record_id=${r}.reversal_of_record_id))) OR (${r}.record_status='Reversed' AND NOT EXISTS(SELECT 1 FROM financial_records rev WHERE rev.reversal_of_record_id=${r}.financial_record_id AND rev.record_status='Active' AND rev.approved_by IS NOT NULL)))`;
}
export function brokenOperationalSourceSql(r = "fr") {
  return `(${r}.record_type='Income' AND ((${r}.source_module='POS' AND ${r}.source_record_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pos_sales ps WHERE ps.pos_sale_id=${r}.source_record_id)) OR (${r}.source_module='Rental' AND ${r}.source_record_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM rental_bookings rb WHERE rb.rental_booking_id=${r}.source_record_id))))`;
}
export function postedOperatingSql(r = "fr", c = "fc") {
  return `(${postedRecordSql(r)} AND ${r}.record_type IN ('Income','Expense') AND ${r}.amount>0 AND ${compatibleCategorySql(r, c)} AND NOT ${capitalMovementSql(r, c)} AND NOT ${supersededSql(r)} AND NOT ${duplicatePostingSql(r)} AND NOT ${sourceMismatchSql(r)} AND NOT ${relationshipIssueSql(r)} AND NOT ${brokenOperationalSourceSql(r)})`;
}
