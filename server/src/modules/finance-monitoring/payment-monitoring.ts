import type { Pool, RowDataPacket } from "mysql2/promise";
import { paymentColumns, identityJoins, rentalColumns, posColumns } from "../payment-references/payment-validation.repository";
import type { PaymentReferenceListItem } from "../payment-references/payment-reference.types";
import { addDate, decimal, whereSql, type DateScope, type FinanceFilters, type SqlFilter } from "./finance-monitoring.schema";

// Each derived subquery returns at most one row per payment reference. Joining raw history or
// posting rows would multiply amounts and repeated validation events.
export const paymentSource = `(SELECT pr.*,
 COALESCE(pr.validated_at, vh.validated_at) AS eventValidatedAt, vh.reversed_at AS eventReversedAt,
 (SELECT COUNT(*) FROM financial_records fr WHERE fr.payment_reference_id = pr.payment_reference_id AND fr.record_type = 'Income' AND fr.record_status = 'Active' AND fr.approved_by IS NOT NULL AND fr.reversal_of_record_id IS NULL) AS financeCount,
 (SELECT COUNT(*) FROM financial_records fr WHERE fr.payment_reference_id=pr.payment_reference_id AND fr.record_type='Income' AND fr.record_status='Active' AND fr.approved_by IS NOT NULL AND fr.reversal_of_record_id IS NULL AND fr.amount<>pr.amount) AS financeMismatchCount,
 (SELECT COUNT(*) FROM share_capital_payments sc WHERE sc.payment_reference_id = pr.payment_reference_id AND sc.payment_status = 'Validated') AS capitalCount,
 (SELECT COUNT(*) FROM share_capital_payments sc JOIN share_capital_transactions t ON t.source_type = 'share_capital_payment' AND t.source_id = sc.share_payment_id AND t.transaction_status = 'Posted' AND t.direction = 'Credit' WHERE sc.payment_reference_id = pr.payment_reference_id) AS capitalLedgerCount,
 (SELECT COUNT(*) FROM share_capital_payments sc LEFT JOIN share_capital_transactions st ON st.source_type='share_capital_payment' AND st.source_id=sc.share_payment_id AND st.transaction_status='Posted' WHERE sc.payment_reference_id=pr.payment_reference_id AND (sc.amount<>pr.amount OR sc.member_id<>pr.member_id OR st.amount<>sc.amount OR st.member_id<>sc.member_id)) AS capitalMismatchCount,
 (SELECT COUNT(*) FROM payment_gateway_events ge WHERE ge.payment_reference_id = pr.payment_reference_id AND ge.processing_status = 'Failed') AS failedCount,
 (SELECT MAX(r.processing_status) FROM payment_receipts r WHERE r.payment_reference_id = pr.payment_reference_id) AS receiptState,
 (SELECT COUNT(*) FROM share_capital_payments sc JOIN share_capital_transactions t ON t.source_type = 'share_capital_payment_reversal' AND t.source_id = sc.share_payment_id AND t.transaction_status = 'Posted' AND t.direction = 'Debit' WHERE sc.payment_reference_id = pr.payment_reference_id) AS reversalLedgerCount
 FROM payment_references pr
 LEFT JOIN (SELECT payment_reference_id, MAX(CASE WHEN new_status = 'Validated' THEN changed_at END) AS validated_at,
 MAX(CASE WHEN new_status = 'Reversed' THEN changed_at END) AS reversed_at FROM payment_validation_history GROUP BY payment_reference_id) vh ON vh.payment_reference_id = pr.payment_reference_id) p ${identityJoins()}`;
export const expectsFinance = "p.payment_purpose IN ('POS/Product','Rental')";
export const expectsCapital = "p.payment_purpose = 'Share Capital' AND p.member_id IS NOT NULL";
export const exceptionSql = `((p.validation_status = 'Validated' AND ((${expectsFinance} AND (p.financeCount <> 1 OR p.financeMismatchCount > 0)) OR (${expectsCapital} AND (p.capitalCount <> 1 OR p.capitalLedgerCount <> 1 OR p.capitalMismatchCount > 0)))) OR p.failedCount > 0 OR (p.validation_status IN ('Validated','Reversed') AND (p.receiptState IS NULL OR p.receiptState IN ('Failed','Pending','Processing'))) OR (p.validation_status='Reversed' AND ${expectsFinance} AND p.financeCount>0) OR (p.validation_status = 'Reversed' AND ${expectsCapital} AND p.capitalLedgerCount > 0 AND p.reversalLedgerCount <> 1))`;
export function paymentScope(f: FinanceFilters, scope: DateScope, options: { status?: boolean; date?: "selected"|"validated"|"reversed"|"none" } = {}): SqlFilter {
 const q: SqlFilter = { clauses: [], values: [] };
 const eq = (column: string, value: string | undefined) => { if (value) { q.clauses.push(`${column} = ?`); q.values.push(value); } };
 if (f.environment === "Operational") q.clauses.push("NOT (p.payment_channel = 'PayMongo' AND p.gateway_environment = 'Test')");
 else if (f.environment !== "All") eq("p.gateway_environment", f.environment);
 eq("p.payment_purpose", f.purpose); eq("p.payment_channel",f.channel); eq("p.validation_source",f.validationSource); eq("p.member_id",f.memberId);
 if (f.search) { const term = `%${f.search}%`; q.clauses.push("(p.reference_number LIKE ? OR p.payer_name LIKE ? OR p.payer_email LIKE ? OR p.payer_contact LIKE ? OR m.full_name LIKE ? OR m.member_code LIKE ? OR a.application_code LIKE ? OR rental.booking_number LIKE ? OR CAST(p.related_entity_id AS CHAR) = ?)"); q.values.push(term,term,term,term,term,term,term,term,f.search); }
 if (f.reference) { q.clauses.push("p.reference_number LIKE ?"); q.values.push(`%${f.reference}%`); }
 if (f.minAmount !== undefined) { q.clauses.push("p.amount >= ?"); q.values.push(f.minAmount); }
 if (f.maxAmount !== undefined) { q.clauses.push("p.amount <= ?"); q.values.push(f.maxAmount); }
 if (f.failedEvents) q.clauses.push("p.failedCount > 0");
 if (f.receipt === "Missing") q.clauses.push("p.receiptState IS NULL"); else eq("p.receiptState", f.receipt);
 if (f.financialPosting) q.clauses.push(`${expectsFinance} AND p.validation_status = 'Validated' AND p.financeCount ${f.financialPosting === "Missing" ? "= 0" : f.financialPosting === "Duplicate" ? "> 1" : "= 1"}`);
 if (f.capitalPosting) q.clauses.push(`${expectsCapital} AND p.validation_status = 'Validated' AND ${f.capitalPosting === "Missing" ? "(p.capitalCount = 0 OR p.capitalLedgerCount = 0)" : f.capitalPosting === "Duplicate" ? "(p.capitalCount > 1 OR p.capitalLedgerCount > 1)" : "(p.capitalCount = 1 AND p.capitalLedgerCount = 1)"}`);
 let dimension = options.date ?? "selected";
 if (options.status !== false) {
  eq("p.validation_status",f.status);
  if (f.view === "manual") q.clauses.push("p.validation_status = 'Pending' AND p.payment_channel <> 'PayMongo'");
  if (f.view === "gateway") q.clauses.push("p.validation_status = 'Pending' AND p.payment_channel = 'PayMongo'");
  if (f.view === "exceptions") q.clauses.push(exceptionSql);
  if (f.view === "validations") { q.clauses.push("p.validation_status IN ('Validated','Reversed') AND p.eventValidatedAt IS NOT NULL"); dimension = "validated"; }
  if (f.view === "reversals") { q.clauses.push("p.validation_status = 'Reversed' AND p.eventReversedAt IS NOT NULL"); dimension = "reversed"; }
 }
 if (dimension !== "none") addDate(q, dimension === "validated" ? "p.eventValidatedAt" : dimension === "reversed" ? "p.eventReversedAt" : ({submitted:"p.submitted_at",paid:"p.paid_at",validated:"p.eventValidatedAt"}[f.dateType]), scope, true);
 return q;
}
export type MonitoredPayment = PaymentReferenceListItem & { rentalNumber: string | null; rentalEquipmentName: string | null; rentalStartAt: Date | null; rentalEndAt: Date | null; rentalQuantity: string | null; rentalUnit: string | null; posItemQuantity: number | null; financeCount: number; capitalCount: number; capitalLedgerCount: number; receiptState: string | null; eventValidatedAt: Date | null; eventReversedAt: Date | null; exception: number };
export type PaymentMonitor = { items: MonitoredPayment[]; total: number; page: number; pageSize: number; summary: { pendingManual: number; needsClarification: number; validatedCount: number; validatedVolume: string; validatedToday: number; pendingGateway: number; rejected: number; reversedCount: number; reversedVolume: string; exceptions: number; missingValidationDate: number }; purposes: Array<{ label: string; count: number; amount: string }>; channels: Array<{ label: string; count: number; amount: string }>; scope: DateScope; filters: FinanceFilters; generatedAt: string };
type Stats = RowDataPacket & Record<string,string|number|null>;
export async function readPaymentMonitor(pool: Pick<Pool,"execute">, f: FinanceFilters, scope: DateScope, now = new Date()): Promise<PaymentMonitor> {
 const base = paymentScope(f,scope,{status:false});
 const list = paymentScope(f,scope);
 const [counts] = await pool.execute<Stats[]>(`SELECT COUNT(*) AS total FROM ${paymentSource}${whereSql(list)}`,list.values);
 const total = Number(counts[0]?.total ?? 0), page = Math.min(f.page,Math.max(1,Math.ceil(total/f.pageSize)));
 const order = {date: f.view === "validations" ? "p.eventValidatedAt" : f.view === "reversals" ? "p.eventReversedAt" : {submitted:"p.submitted_at",paid:"p.paid_at",validated:"p.eventValidatedAt"}[f.dateType], name:"COALESCE(p.payer_name,m.full_name)",amount:"p.amount",balance:"p.amount",reference:"p.reference_number"}[f.sortBy];
 const [rows] = await pool.execute<(RowDataPacket & MonitoredPayment)[]>(`SELECT ${paymentColumns()}, m.member_code AS memberCode, m.full_name AS memberName, a.application_code AS applicationCode,
 TRIM(CONCAT_WS(' ',a.first_name,a.middle_name,a.last_name)) AS applicationName, ${rentalColumns()}, ${posColumns()}, p.failedCount AS failedGatewayEvents,
 p.financeCount,p.capitalCount,p.capitalLedgerCount,p.receiptState,p.eventValidatedAt,p.eventReversedAt, ${exceptionSql} AS exception FROM ${paymentSource}${whereSql(list)}
 ORDER BY ${order} ${f.sortDirection === "asc" ? "ASC" : "DESC"}, p.payment_reference_id DESC LIMIT ${f.pageSize} OFFSET ${(page-1)*f.pageSize}`,list.values);
 const [current] = await pool.execute<Stats[]>(`SELECT COALESCE(SUM(p.validation_status='Pending' AND p.payment_channel<>'PayMongo'),0) AS pendingManual,
 COALESCE(SUM(p.validation_status='Needs Clarification'),0) AS needsClarification, COALESCE(SUM(p.validation_status='Pending' AND p.payment_channel='PayMongo'),0) AS pendingGateway,
 COALESCE(SUM(p.validation_status='Rejected'),0) AS rejected, COALESCE(SUM(${exceptionSql}),0) AS exceptions,
 COALESCE(SUM(p.validation_status IN ('Validated','Reversed') AND p.eventValidatedAt IS NULL),0) AS missingValidationDate FROM ${paymentSource}${whereSql(base)}`,base.values);
 const validation = paymentScope(f,scope,{status:false,date:"validated"}); validation.clauses.push("p.validation_status IN ('Validated','Reversed') AND p.eventValidatedAt IS NOT NULL");
 const [validated] = await pool.execute<Stats[]>(`SELECT COUNT(*) AS count, COALESCE(SUM(p.amount),0) AS amount FROM ${paymentSource}${whereSql(validation)}`,validation.values);
 const reversal = paymentScope(f,scope,{status:false,date:"reversed"}); reversal.clauses.push("p.validation_status='Reversed' AND p.eventReversedAt IS NOT NULL");
 const [reversed] = await pool.execute<Stats[]>(`SELECT COUNT(*) AS count, COALESCE(SUM(p.amount),0) AS amount FROM ${paymentSource}${whereSql(reversal)}`,reversal.values);
 const today = paymentScope(f,{...scope,start:scope.today,end:scope.today},{status:false,date:"validated"}); today.clauses.push("p.validation_status IN ('Validated','Reversed') AND p.eventValidatedAt IS NOT NULL");
 const [daily] = await pool.execute<Stats[]>(`SELECT COUNT(*) AS count FROM ${paymentSource}${whereSql(today)}`,today.values);
 const group = async (column: string) => { const [g] = await pool.execute<(Stats & {label:string})[]>(`SELECT ${column} AS label, COUNT(*) AS count, COALESCE(SUM(p.amount),0) AS amount FROM ${paymentSource}${whereSql(validation)} GROUP BY ${column} ORDER BY SUM(p.amount) DESC, ${column}`,validation.values); return g.map(r=>({label:r.label,count:Number(r.count),amount:decimal(r.amount)})); };
 const n = (key:string) => Number(current[0]?.[key] ?? 0);
 return { items:rows.map(r=>({...r,amount:Number(r.amount),gatewayFeeAmount:r.gatewayFeeAmount === null ? null : Number(r.gatewayFeeAmount),gatewayNetAmount:r.gatewayNetAmount === null ? null : Number(r.gatewayNetAmount),failedGatewayEvents:Number(r.failedGatewayEvents),posItemQuantity:r.posItemQuantity == null ? null : Number(r.posItemQuantity),financeCount:Number(r.financeCount),capitalCount:Number(r.capitalCount),capitalLedgerCount:Number(r.capitalLedgerCount),exception:Number(r.exception)})),total,page,pageSize:f.pageSize,
 summary:{pendingManual:n("pendingManual"),needsClarification:n("needsClarification"),validatedCount:Number(validated[0]?.count ?? 0),validatedVolume:decimal(validated[0]?.amount),validatedToday:Number(daily[0]?.count ?? 0),pendingGateway:n("pendingGateway"),rejected:n("rejected"),reversedCount:Number(reversed[0]?.count ?? 0),reversedVolume:decimal(reversed[0]?.amount),exceptions:n("exceptions"),missingValidationDate:n("missingValidationDate")},purposes:await group("p.payment_purpose"),channels:await group("p.payment_channel"),scope,filters:f,generatedAt:now.toISOString() };
}

export type PaymentDiagnostics={paymentId:string;memberId:string|null;capitalTransactionId:string|null;warnings:string[]};
export async function readPaymentDiagnostics(pool:Pick<Pool,'execute'>,id:string):Promise<PaymentDiagnostics|null>{
 const [rows]=await pool.execute<(RowDataPacket&{memberId:string|null;paymentPurpose:string;validationStatus:string;financeCount:number;financeMismatchCount:number;capitalCount:number;capitalLedgerCount:number;capitalMismatchCount:number;failedCount:number;receiptState:string|null;reversalLedgerCount:number;capitalTransactionId:string|null})[]>(`SELECT CAST(p.member_id AS CHAR) AS memberId,p.payment_purpose AS paymentPurpose,p.validation_status AS validationStatus,p.financeCount,p.financeMismatchCount,p.capitalCount,p.capitalLedgerCount,p.capitalMismatchCount,p.failedCount,p.receiptState,p.reversalLedgerCount,
 (SELECT CAST(st.share_capital_transaction_id AS CHAR) FROM share_capital_transactions st JOIN share_capital_payments sp ON sp.share_payment_id=st.source_id AND st.source_type='share_capital_payment' WHERE sp.payment_reference_id=p.payment_reference_id ORDER BY st.share_capital_transaction_id LIMIT 1) AS capitalTransactionId FROM ${paymentSource} WHERE p.payment_reference_id=?`,[id]);
 const r=rows[0];if(!r)return null;const warnings:string[]=[];
 if(r.validationStatus==='Validated'){
  if(['Rental','POS/Product'].includes(r.paymentPurpose)&&Number(r.financeCount)!==1)warnings.push(`${Number(r.financeCount)} active approved income postings; one is expected for this settlement purpose.`);
  if(['Rental','POS/Product'].includes(r.paymentPurpose)&&Number(r.financeMismatchCount)>0)warnings.push('The linked approved income amount does not match the validated payment amount.');
  if(r.paymentPurpose==='Share Capital'&&r.memberId&&(Number(r.capitalCount)!==1||Number(r.capitalLedgerCount)!==1))warnings.push(`${Number(r.capitalCount)} validated capital payments and ${Number(r.capitalLedgerCount)} posted credits; one of each is expected for a member-linked capital settlement.`);
  if(Number(r.capitalMismatchCount)>0)warnings.push('A linked capital amount or member does not match its source payment.');
 }
 if(['Validated','Reversed'].includes(r.validationStatus)&&r.receiptState!=='Generated')warnings.push(`Receipt ${r.receiptState??'not recorded'}. This is a document-processing issue, not proof that settlement failed.`);
 if(r.validationStatus==='Reversed'&&['Rental','POS/Product'].includes(r.paymentPurpose)&&Number(r.financeCount)>0)warnings.push('A reversed reference still has an active approved income posting.');
 if(Number(r.failedCount)>0)warnings.push(`${Number(r.failedCount)} failed gateway processing events require review.`);
 if(r.validationStatus==='Reversed'&&r.paymentPurpose==='Share Capital'&&Number(r.capitalLedgerCount)>0&&Number(r.reversalLedgerCount)!==1)warnings.push('A reversed member-capital reference has an original credit without exactly one matching posted reversal debit.');
 return{paymentId:id,memberId:r.memberId,capitalTransactionId:r.capitalTransactionId,warnings};
}
