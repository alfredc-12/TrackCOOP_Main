import type { Pool,RowDataPacket } from "mysql2/promise";
import { capitalScope,capitalSource,transactionIssueSql } from "./capital-monitoring";
import { addDate,decimal,whereSql,type FinanceFilters,type DateScope,type SqlFilter } from "./finance-monitoring.schema";
export type CapitalPaymentRow={id:string;memberId:string;memberName:string;memberCode:string;amount:string;paymentChannel:string|null;referenceNumber:string|null;paymentStatus:string;paymentDate:string;paymentReferenceId:string|null};
export type CapitalTransactionRow={id:string;memberId:string;memberName:string;memberCode:string;transactionDate:string;transactionType:string;direction:string;amount:string;balanceAfter:string;status:string;sourceType:string;sourceId:string|null;referenceNumber:string;paymentReferenceId:string|null;issue:number};
export function capitalListScope(f:FinanceFilters,scope:DateScope,kind:'payments'|'transactions'){
 const source=capitalSource(scope),population=capitalScope(f,scope);const alias=kind==='payments'?'s':'t';
 const q:SqlFilter={clauses:[`${alias}.member_id IN (SELECT c.memberId FROM ${source.sql}${whereSql(population)})`],values:[...source.values,...population.values]};
 addDate(q,kind==='payments'?'s.payment_date':'t.transaction_date',scope,false);
 if(f.reference){q.clauses.push(`${kind==='payments'?'p.reference_number':'t.reference_number'} LIKE ?`);q.values.push(`%${f.reference}%`);}
 if(kind==='payments'&&f.status){q.clauses.push('s.payment_status=?');q.values.push(f.status);}
 if(kind==='transactions'){
  if(f.transactionGroup==='contributions')q.clauses.push("t.source_type='share_capital_payment' AND t.direction='Credit' AND t.transaction_status='Posted' AND sp.payment_status='Validated' AND sp.member_id=t.member_id AND sp.amount=t.amount AND (p.payment_reference_id IS NULL OR (p.payment_purpose='Share Capital' AND p.validation_status='Validated' AND p.amount=sp.amount AND (p.member_id IS NULL OR p.member_id=sp.member_id))) AND t.share_capital_transaction_id=(SELECT MIN(first_t.share_capital_transaction_id) FROM share_capital_transactions first_t WHERE first_t.source_type=t.source_type AND first_t.source_id=t.source_id AND first_t.transaction_status='Posted' AND first_t.direction='Credit')");
  if(f.direction){q.clauses.push('t.direction=?');q.values.push(f.direction);}
  if(f.transactionStatus){q.clauses.push('t.transaction_status=?');q.values.push(f.transactionStatus);}
  if(f.transactionType){q.clauses.push('t.transaction_type=?');q.values.push(f.transactionType);}
 }
 if(f.channel){q.clauses.push('p.payment_channel=?');q.values.push(f.channel);}
 if(f.minAmount!==undefined){q.clauses.push(`${alias}.amount>=?`);q.values.push(f.minAmount);}if(f.maxAmount!==undefined){q.clauses.push(`${alias}.amount<=?`);q.values.push(f.maxAmount);}
 // Environment scopes collection activity, never the current capital liability.
 if(f.environment==='Operational')q.clauses.push("(p.payment_reference_id IS NULL OR NOT(p.payment_channel='PayMongo' AND p.gateway_environment='Test'))");
 else if(f.environment!=='All'){q.clauses.push("COALESCE(p.gateway_environment,'Manual')=?");q.values.push(f.environment);}
 return q;
}
export async function capitalList(pool:Pick<Pool,'execute'>,f:FinanceFilters,scope:DateScope,kind:'payments'|'transactions'){
 const q=capitalListScope(f,scope,kind),alias=kind==='payments'?'s':'t';
 const from=kind==='payments'?`share_capital_payments s JOIN member_profiles m ON m.member_id=s.member_id LEFT JOIN payment_references p ON p.payment_reference_id=s.payment_reference_id`:
 `share_capital_transactions t JOIN member_profiles m ON m.member_id=t.member_id LEFT JOIN share_capital_payments sp ON t.source_type IN ('share_capital_payment','share_capital_payment_reversal') AND sp.share_payment_id=t.source_id LEFT JOIN payment_references p ON p.payment_reference_id=sp.payment_reference_id`;
 const [counts]=await pool.execute<(RowDataPacket & {total:number})[]>(`SELECT COUNT(*) AS total FROM ${from}${whereSql(q)}`,q.values);
 const total=Number(counts[0]?.total??0),page=Math.min(f.page,Math.max(1,Math.ceil(total/f.pageSize)));
 const order={date:kind==='payments'?'s.payment_date':'t.transaction_date',name:'m.full_name',amount:`${alias}.amount`,balance:kind==='payments'?'s.amount':'t.balance_after',reference:kind==='payments'?'p.reference_number':'t.reference_number'}[f.sortBy];
 const selection=kind==='payments'?`CAST(s.share_payment_id AS CHAR) AS id,CAST(s.member_id AS CHAR) AS memberId,m.full_name AS memberName,m.member_code AS memberCode,CAST(s.amount AS CHAR) AS amount,p.payment_channel AS paymentChannel,p.reference_number AS referenceNumber,s.payment_status AS paymentStatus,DATE_FORMAT(s.payment_date,'%Y-%m-%d') AS paymentDate,CAST(s.payment_reference_id AS CHAR) AS paymentReferenceId`:
 `CAST(t.share_capital_transaction_id AS CHAR) AS id,CAST(t.member_id AS CHAR) AS memberId,m.full_name AS memberName,m.member_code AS memberCode,DATE_FORMAT(t.transaction_date,'%Y-%m-%d') AS transactionDate,t.transaction_type AS transactionType,t.direction,CAST(t.amount AS CHAR) AS amount,CAST(t.balance_after AS CHAR) AS balanceAfter,t.transaction_status AS status,t.source_type AS sourceType,CAST(t.source_id AS CHAR) AS sourceId,t.reference_number AS referenceNumber,CAST(p.payment_reference_id AS CHAR) AS paymentReferenceId,${transactionIssueSql(scope)} AS issue`;
 const [rows]=await pool.execute<(RowDataPacket & CapitalPaymentRow & CapitalTransactionRow)[]>(`SELECT ${selection} FROM ${from}${whereSql(q)} ORDER BY ${order} ${f.sortDirection==='asc'?'ASC':'DESC'},${alias}.${kind==='payments'?'share_payment_id':'share_capital_transaction_id'} DESC LIMIT ${f.pageSize} OFFSET ${(page-1)*f.pageSize}`,q.values);
 return {items:rows.map(r=>({...r,amount:decimal(r.amount)})),total,page,pageSize:f.pageSize};
}
