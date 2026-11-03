import type { Pool, RowDataPacket } from "mysql2/promise";
import { FULL_SHARE_CAPITAL, INITIAL_SHARE_CAPITAL, MAX_SHARE_CAPITAL } from "../share-capital/share-capital.constants";
import { addDate, decimal, whereSql, type DateScope, type FinanceFilters, type SqlFilter } from "./finance-monitoring.schema";

export const assessedSql = "((c.accountId IS NULL AND c.missingCredits=0) OR (c.reconciled=1 AND c.sourceIssues=0 AND c.unverifiedSources=0 AND c.missingCredits=0))";
export const eligibleSql = "c.approvalStatus = 'Approved' AND c.membershipType = 'True Member' AND c.officialStatus = 'Active'";
// Current liabilities include all account holders. Eligibility is used only for requirements.
// Original posted credits plus posted reversal debits remain in the signed ledger.

export function transactionIssueSql(scope:DateScope){
 const patronage=scope.patronageAvailable?` OR (t.source_type='patronage_capital_transfer' AND NOT EXISTS (SELECT 1 FROM patronage_capital_transfers pc WHERE pc.transfer_id=t.source_id AND pc.member_id=t.member_id AND pc.amount=t.amount AND pc.transfer_status='Approved' AND pc.share_capital_transaction_id=t.share_capital_transaction_id))`:'';
 return `(t.balance_after <> t.balance_before + IF(t.direction='Credit',t.amount,-t.amount)
 OR t.balance_before <> COALESCE((SELECT prev.balance_after FROM share_capital_transactions prev WHERE prev.member_id=t.member_id AND prev.transaction_status='Posted' AND (prev.created_at<t.created_at OR (prev.created_at=t.created_at AND prev.share_capital_transaction_id<t.share_capital_transaction_id)) ORDER BY prev.created_at DESC,prev.share_capital_transaction_id DESC LIMIT 1),0)
 OR (SELECT COUNT(*) FROM share_capital_transactions dupe WHERE dupe.source_type=t.source_type AND dupe.source_id=t.source_id AND dupe.transaction_status='Posted')>1
 OR (t.source_type='share_capital_payment' AND (t.direction<>'Credit' OR NOT EXISTS (SELECT 1 FROM share_capital_payments sp0 WHERE sp0.share_payment_id=t.source_id AND sp0.member_id=t.member_id AND sp0.amount=t.amount AND sp0.payment_status IN ('Validated','Reversed') AND (sp0.payment_reference_id IS NULL OR EXISTS (SELECT 1 FROM payment_references source_ref WHERE source_ref.payment_reference_id=sp0.payment_reference_id AND source_ref.payment_purpose='Share Capital' AND source_ref.validation_status=sp0.payment_status AND source_ref.amount=sp0.amount AND (source_ref.member_id IS NULL OR source_ref.member_id=sp0.member_id))) AND (sp0.payment_status<>'Reversed' OR EXISTS (SELECT 1 FROM share_capital_transactions rev WHERE rev.source_type='share_capital_payment_reversal' AND rev.source_id=sp0.share_payment_id AND rev.direction='Debit' AND rev.transaction_status='Posted' AND rev.amount=t.amount)))))
 OR (t.source_type='share_capital_payment_reversal' AND (t.direction<>'Debit' OR NOT EXISTS (SELECT 1 FROM share_capital_payments sp0 WHERE sp0.share_payment_id=t.source_id AND sp0.member_id=t.member_id AND sp0.amount=t.amount AND sp0.payment_status='Reversed')))
 OR (t.source_type='member_dividend' AND NOT EXISTS (SELECT 1 FROM member_dividends md WHERE md.member_dividend_id=t.source_id AND md.member_id=t.member_id AND md.dividend_amount=t.amount AND md.dividend_status='Added to Share Capital' AND md.share_capital_transaction_id=t.share_capital_transaction_id))${patronage})`;
}
export function capitalSource(scope: DateScope) {
 const balance = scope.historical ? "CASE WHEN (COALESCE(l.transactionCount,0)=0 AND COALESCE(a.current_balance,0)<>0) OR EXISTS (SELECT 1 FROM share_capital_transactions uncertain WHERE uncertain.member_id=m.member_id AND uncertain.transaction_status='Reversed') THEN NULL ELSE COALESCE(h.balance,0) END" : "COALESCE(a.current_balance,0)";
 return { sql:`(SELECT CAST(m.member_id AS CHAR) AS memberId, m.member_code AS memberCode,m.full_name AS memberName,
 m.membership_type AS membershipType,m.approval_status AS approvalStatus,m.official_member_status AS officialStatus,m.barangay,m.sector,
 DATE_FORMAT(m.share_capital_deadline,'%Y-%m-%d') AS deadline, CAST(a.share_capital_account_id AS CHAR) AS accountId,
 COALESCE(a.current_balance,0) AS currentBalance, ${balance} AS balance,
 COALESCE(a.initial_capital,0)+COALESCE(a.total_additional_contributions,0)+COALESCE(a.total_dividends_added,0)-COALESCE(a.total_deductions,0) AS counterBalance,
 COALESCE(l.postedBalance,0) AS postedBalance,COALESCE(l.transactionCount,0) AS transactionCount,
 COALESCE(l.initialCapital,0) AS initialCapital,COALESCE(l.memberContributions,0) AS memberContributions,
 COALESCE(l.interestCapitalized,0) AS interestCapitalized,COALESCE(l.patronageCapitalized,0) AS patronageCapitalized,
 COALESCE(l.otherCredits,0) AS otherCredits,COALESCE(l.deductions,0) AS deductions,COALESCE(l.sourceIssues,0) AS sourceIssues,COALESCE(l.unverifiedSources,0) AS unverifiedSources,
 (SELECT COUNT(*) FROM share_capital_payments sp WHERE sp.member_id=m.member_id AND sp.payment_status='Validated' AND NOT EXISTS (SELECT 1 FROM share_capital_transactions st WHERE st.source_type='share_capital_payment' AND st.source_id=sp.share_payment_id AND st.transaction_status='Posted' AND st.direction='Credit')) AS missingCredits,
 (a.share_capital_account_id IS NOT NULL AND a.current_balance=COALESCE(l.postedBalance,0) AND a.current_balance=a.initial_capital+a.total_additional_contributions+a.total_dividends_added-a.total_deductions) AS reconciled,
 a.updated_at AS updatedAt
 FROM member_profiles m LEFT JOIN share_capital_accounts a ON a.member_id=m.member_id
 LEFT JOIN (SELECT t.member_id,COUNT(*) AS transactionCount,SUM(IF(t.direction='Credit',t.amount,-t.amount)) AS postedBalance,
 SUM(CASE WHEN t.direction='Credit' AND t.transaction_type='Initial Share Capital' AND t.source_type='share_capital_payment' THEN t.amount ELSE 0 END) AS initialCapital,
 SUM(CASE WHEN t.direction='Credit' AND t.source_type='share_capital_payment' THEN t.amount ELSE 0 END) AS memberContributions,
 SUM(CASE WHEN t.direction='Credit' AND t.transaction_type='Dividend Added to Share Capital' THEN t.amount ELSE 0 END) AS interestCapitalized,
 SUM(CASE WHEN t.direction='Credit' AND t.source_type='patronage_capital_transfer' THEN t.amount ELSE 0 END) AS patronageCapitalized,
 SUM(CASE WHEN t.direction='Credit' AND t.source_type NOT IN ('share_capital_payment','patronage_capital_transfer') AND t.transaction_type<>'Dividend Added to Share Capital' THEN t.amount ELSE 0 END) AS otherCredits,
 SUM(CASE WHEN t.direction='Debit' THEN t.amount ELSE 0 END) AS deductions,
 SUM(${transactionIssueSql(scope)}) AS sourceIssues,
 SUM((t.source_type='patronage_capital_transfer' AND ${scope.patronageAvailable ? "0" : "1"}) OR (t.source_type='share_capital_payment' AND EXISTS (SELECT 1 FROM payment_references test_ref WHERE test_ref.payment_reference_id=sp.payment_reference_id AND test_ref.payment_channel='PayMongo' AND test_ref.gateway_environment='Test'))) AS unverifiedSources
 FROM share_capital_transactions t LEFT JOIN share_capital_payments sp ON t.source_type='share_capital_payment' AND sp.share_payment_id=t.source_id
 WHERE t.transaction_status='Posted' GROUP BY t.member_id) l ON l.member_id=m.member_id
 LEFT JOIN (SELECT member_id,SUM(IF(direction='Credit',amount,-amount)) AS balance FROM share_capital_transactions WHERE transaction_status='Posted' AND transaction_date<=? GROUP BY member_id) h ON h.member_id=m.member_id) c`,values:[scope.asOf] as Array<string|number> };
}
export function capitalScope(f: FinanceFilters, scope: DateScope, applyStage = true): SqlFilter {
 const q: SqlFilter={clauses:[],values:[]};
 if(f.eligibilityOnly)q.clauses.push(eligibleSql);
 const eq=(col:string,v:string|undefined)=>{if(v){q.clauses.push(`${col}=?`);q.values.push(v);}};
 eq('c.membershipType',f.membershipType);eq('c.barangay',f.barangay);eq('c.sector',f.sector);eq('c.memberId',f.memberId);
 if(f.search){q.clauses.push('(c.memberName LIKE ? OR c.memberCode LIKE ?)');q.values.push(`%${f.search}%`,`%${f.search}%`);}
 if(f.balanceMin!==undefined){q.clauses.push('c.balance>=?');q.values.push(f.balanceMin);} if(f.balanceMax!==undefined){q.clauses.push('c.balance<=?');q.values.push(f.balanceMax);}
 if(f.reconciliation==='noAccount')q.clauses.push('c.accountId IS NULL');
 if(f.reconciliation==='reconciled')q.clauses.push('c.reconciled=1 AND c.sourceIssues=0 AND c.unverifiedSources=0 AND c.missingCredits=0');
 if(f.reconciliation==='review')q.clauses.push('(c.accountId IS NOT NULL AND (c.reconciled=0 OR c.sourceIssues>0 OR c.unverifiedSources>0 OR c.missingCredits>0) OR c.missingCredits>0)');
 if(applyStage && f.stage){const b='c.balance';q.clauses.push(({none:`${b}=0`,belowInitial:`${b}>0 AND ${b}<${INITIAL_SHARE_CAPITAL}`,initialToFull:`${b}>=${INITIAL_SHARE_CAPITAL} AND ${b}<${FULL_SHARE_CAPITAL}`,fullToMax:`${b}>=${FULL_SHARE_CAPITAL} AND ${b}<${MAX_SHARE_CAPITAL}`,atMax:`${b}=${MAX_SHARE_CAPITAL}`,aboveMax:`${b}>${MAX_SHARE_CAPITAL}`} as const)[f.stage]);}
 if(f.deadline){const due=`DATE_ADD(?,INTERVAL ${f.dueSoonDays} DAY)`;const applicable=`(${eligibleSql} AND ${assessedSql})`; const met=`c.currentBalance>=${FULL_SHARE_CAPITAL} AND c.reconciled=1`;const clauses={met:`${applicable} AND ${met}`,dueSoon:`${applicable} AND c.currentBalance<${FULL_SHARE_CAPITAL} AND c.deadline>=? AND c.deadline<=${due}`,overdue:`${applicable} AND c.currentBalance<${FULL_SHARE_CAPITAL} AND c.deadline<?`,missing:`${applicable} AND c.currentBalance<${FULL_SHARE_CAPITAL} AND c.deadline IS NULL`,na:`NOT (${eligibleSql})`};q.clauses.push(clauses[f.deadline]);if(f.deadline==='dueSoon')q.values.push(scope.today,scope.today);if(f.deadline==='overdue')q.values.push(scope.today);}
 return q;
}
export type CapitalAccount = {memberId:string;memberCode:string;memberName:string;membershipType:string;officialStatus:string;accountId:string|null;balance:string|null;currentBalance:string;postedBalance:string;counterBalance:string;difference:string;transactionCount:number;reconciled:boolean;sourceIssues:number;unverifiedSources:number;missingCredits:number;deadline:string|null;initialCapital:string;memberContributions:string;interestCapitalized:string;patronageCapitalized:string;otherCredits:string;deductions:string};
export type CapitalMonitor = { accounts:CapitalAccount[]; total:number;page:number;pageSize:number; summary:{balance:string;holders:number;eligible:number;completed:number;completionPercent:number|null;unassessedEligible:number;unknownBalances:number;review:number;noAccount:number;noCapital:number;pending:string;periodContributions:string;reversedContributions:string;dueSoon:number;overdue:number;missingDeadline:number;requirement:number;initial:number;maximum:number}; composition:Array<{label:string;amount:string}>; scope:DateScope;filters:FinanceFilters;generatedAt:string };
type Stats=RowDataPacket & Record<string,string|number|null>;
export async function readCapitalMonitor(pool:Pick<Pool,'execute'>,f:FinanceFilters,scope:DateScope,now=new Date()):Promise<CapitalMonitor>{
 const source=capitalSource(scope), q=capitalScope(f,scope), values=[...source.values,...q.values];
 const [counts]=await pool.execute<Stats[]>(`SELECT COUNT(*) AS total FROM ${source.sql}${whereSql(q)}`,values);const total=Number(counts[0]?.total??0),page=Math.min(f.page,Math.max(1,Math.ceil(total/f.pageSize)));
 const order={date:'c.updatedAt',name:'c.memberName',balance:'c.balance',amount:'c.balance',reference:'c.memberCode'}[f.sortBy];
 const [rows]=await pool.execute<(RowDataPacket & CapitalAccount)[]>(`SELECT c.*, c.currentBalance-c.postedBalance AS difference FROM ${source.sql}${whereSql(q)} ORDER BY ${order} ${f.sortDirection==='asc'?'ASC':'DESC'},c.memberId ASC LIMIT ${f.pageSize} OFFSET ${(page-1)*f.pageSize}`,values);
 const eligible=`(${eligibleSql})`;const assessed=`(${assessedSql})`;
 const [stats]=await pool.execute<Stats[]>(`SELECT COALESCE(SUM(c.balance),0) AS balance,COALESCE(SUM(c.balance>0),0) AS holders,SUM(${eligible}) AS eligible,SUM(${eligible} AND NOT ${assessed}) AS unassessedEligible,
 SUM(${eligible} AND c.currentBalance>=${FULL_SHARE_CAPITAL} AND c.reconciled=1 AND c.sourceIssues=0 AND c.unverifiedSources=0 AND c.missingCredits=0) AS completed,
 SUM(c.balance IS NULL) AS unknownBalances,SUM((c.accountId IS NOT NULL AND (c.reconciled=0 OR c.sourceIssues>0 OR c.unverifiedSources>0 OR c.missingCredits>0)) OR c.missingCredits>0) AS review,
 SUM(c.accountId IS NULL) AS noAccount,SUM(c.balance=0) AS noCapital,
 SUM(${eligible} AND ${assessed} AND c.currentBalance<${FULL_SHARE_CAPITAL} AND c.deadline>=? AND c.deadline<=DATE_ADD(?,INTERVAL ${f.dueSoonDays} DAY)) AS dueSoon,
 SUM(${eligible} AND ${assessed} AND c.currentBalance<${FULL_SHARE_CAPITAL} AND c.deadline<?) AS overdue,SUM(${eligible} AND ${assessed} AND c.currentBalance<${FULL_SHARE_CAPITAL} AND c.deadline IS NULL) AS missingDeadline,
 COALESCE(SUM(c.initialCapital),0) AS initialCapital,COALESCE(SUM(c.memberContributions-c.initialCapital),0) AS additionalMemberContributions,COALESCE(SUM(c.memberContributions),0) AS memberContributions,COALESCE(SUM(c.interestCapitalized),0) AS interestCapitalized,
 COALESCE(SUM(c.patronageCapitalized),0) AS patronageCapitalized,COALESCE(SUM(c.otherCredits),0) AS otherCredits,COALESCE(SUM(c.deductions),0) AS deductions
 FROM ${source.sql}${whereSql(q)}`,[scope.today,scope.today,scope.today,...values]);
 const payment:SqlFilter={clauses:[],values:[]};addDate(payment,'s.payment_date',scope,false);
 if(f.minAmount!==undefined){payment.clauses.push('s.amount>=?');payment.values.push(f.minAmount);}if(f.maxAmount!==undefined){payment.clauses.push('s.amount<=?');payment.values.push(f.maxAmount);}
 if(f.channel){payment.clauses.push('p.payment_channel=?');payment.values.push(f.channel);}
 if(f.reference){payment.clauses.push('p.reference_number LIKE ?');payment.values.push(`%${f.reference}%`);}
 if(f.environment==='Operational')payment.clauses.push("(p.payment_reference_id IS NULL OR NOT(p.payment_channel='PayMongo' AND p.gateway_environment='Test'))");else if(f.environment!=='All'){payment.clauses.push("COALESCE(p.gateway_environment,'Manual')=?");payment.values.push(f.environment);}
 const population=`s.member_id IN (SELECT c.memberId FROM ${source.sql}${whereSql(q)})`;
 const [pending]=await pool.execute<Stats[]>(`SELECT COALESCE(SUM(s.amount),0) AS amount FROM share_capital_payments s LEFT JOIN payment_references p ON p.payment_reference_id=s.payment_reference_id WHERE s.payment_status='Pending' AND ${population}${payment.clauses.length?' AND '+payment.clauses.join(' AND '):''}`,[...values,...payment.values]);
 const movement:SqlFilter={clauses:[],values:[]};addDate(movement,'t.transaction_date',scope,false);
 if(f.minAmount!==undefined){movement.clauses.push('t.amount>=?');movement.values.push(f.minAmount);}if(f.maxAmount!==undefined){movement.clauses.push('t.amount<=?');movement.values.push(f.maxAmount);}
 if(f.channel){movement.clauses.push('p.payment_channel=?');movement.values.push(f.channel);}
 if(f.environment==='Operational')movement.clauses.push("(p.payment_reference_id IS NULL OR NOT(p.payment_channel='PayMongo' AND p.gateway_environment='Test'))");else if(f.environment!=='All'){movement.clauses.push("COALESCE(p.gateway_environment,'Manual')=?");movement.values.push(f.environment);}
 if(f.direction){movement.clauses.push('t.direction=?');movement.values.push(f.direction);}if(f.transactionStatus){movement.clauses.push('t.transaction_status=?');movement.values.push(f.transactionStatus);}if(f.transactionType){movement.clauses.push('t.transaction_type=?');movement.values.push(f.transactionType);}if(f.reference){movement.clauses.push('t.reference_number LIKE ?');movement.values.push(`%${f.reference}%`);}
 const [activity]=await pool.execute<Stats[]>(`SELECT COALESCE(SUM(CASE WHEN t.source_type='share_capital_payment' AND t.direction='Credit' AND s.payment_status='Validated' AND s.member_id=t.member_id AND s.amount=t.amount AND (p.payment_reference_id IS NULL OR (p.payment_purpose='Share Capital' AND p.validation_status='Validated' AND p.amount=s.amount AND (p.member_id IS NULL OR p.member_id=s.member_id))) AND t.transaction_status='Posted' AND t.share_capital_transaction_id=(SELECT MIN(first_t.share_capital_transaction_id) FROM share_capital_transactions first_t WHERE first_t.source_type=t.source_type AND first_t.source_id=t.source_id AND first_t.transaction_status='Posted' AND first_t.direction='Credit') THEN t.amount ELSE 0 END),0) AS contributions,
 COALESCE(SUM(CASE WHEN t.source_type='share_capital_payment_reversal' AND t.direction='Debit' AND t.transaction_status='Posted' AND s.payment_status='Reversed' AND s.member_id=t.member_id AND s.amount=t.amount AND t.share_capital_transaction_id=(SELECT MIN(first_rev.share_capital_transaction_id) FROM share_capital_transactions first_rev WHERE first_rev.source_type=t.source_type AND first_rev.source_id=t.source_id AND first_rev.transaction_status='Posted' AND first_rev.direction='Debit') THEN t.amount ELSE 0 END),0) AS reversals
 FROM share_capital_transactions t LEFT JOIN share_capital_payments s ON t.source_type IN ('share_capital_payment','share_capital_payment_reversal') AND s.share_payment_id=t.source_id LEFT JOIN payment_references p ON p.payment_reference_id=s.payment_reference_id WHERE t.member_id IN (SELECT c.memberId FROM ${source.sql}${whereSql(q)})${movement.clauses.length?' AND '+movement.clauses.join(' AND '):''}`,[...values,...movement.values]);
 const row=stats[0]??{},n=(k:string)=>Number(row[k]??0);const eligibleCount=n('eligible');
 return {accounts:rows.map(r=>({...r,balance:r.balance===null?null:decimal(r.balance),currentBalance:decimal(r.currentBalance),postedBalance:decimal(r.postedBalance),counterBalance:decimal(r.counterBalance),difference:decimal(r.difference),transactionCount:Number(r.transactionCount),reconciled:Boolean(Number(r.reconciled)),sourceIssues:Number(r.sourceIssues),unverifiedSources:Number(r.unverifiedSources),missingCredits:Number(r.missingCredits),initialCapital:decimal(r.initialCapital),memberContributions:decimal(r.memberContributions),interestCapitalized:decimal(r.interestCapitalized),patronageCapitalized:decimal(r.patronageCapitalized),otherCredits:decimal(r.otherCredits),deductions:decimal(r.deductions)})),total,page,pageSize:f.pageSize,
 summary:{balance:decimal(row.balance),holders:n('holders'),eligible:eligibleCount,completed:n('completed'),completionPercent:scope.historical||!eligibleCount||n('unassessedEligible')>0?null:n('completed')/eligibleCount*100,unassessedEligible:n('unassessedEligible'),unknownBalances:n('unknownBalances'),review:n('review'),noAccount:n('noAccount'),noCapital:n('noCapital'),pending:decimal(pending[0]?.amount),periodContributions:decimal(activity[0]?.contributions),reversedContributions:decimal(activity[0]?.reversals),dueSoon:n('dueSoon'),overdue:n('overdue'),missingDeadline:n('missingDeadline'),requirement:FULL_SHARE_CAPITAL,initial:INITIAL_SHARE_CAPITAL,maximum:MAX_SHARE_CAPITAL},
 composition:[['Initial capital','initialCapital'],['Additional member contributions','additionalMemberContributions'],['Interest capitalized','interestCapitalized'],['Patronage capitalized','patronageCapitalized'],['Other credits','otherCredits'],['Deductions and reversals','deductions']].map(([label,key])=>({label,amount:decimal(row[key])})),scope,filters:f,generatedAt:now.toISOString()};
}
