import type { Pool,PoolConnection,RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import { readPaymentMonitor,readPaymentDiagnostics } from "./payment-monitoring";
import { readCapitalMonitor } from "./capital-monitoring";
import { capitalList } from "./capital-lists";
import { dateScope,type FinanceFilters } from "./finance-monitoring.schema";
import { financeWorkbook } from "./finance-monitoring.export";
export type FinanceExecutor=Pick<PoolConnection,'execute'>;
const required=['payment_references','payment_validation_history','payment_receipts','payment_gateway_events','share_capital_accounts','share_capital_transactions','share_capital_payments','member_profiles','member_dividends'];
export function createFinanceMonitoringService(pool?:Pool,clock:()=>Date=()=>new Date()){
 const db=()=>pool??getPool();
 async function snapshot<T>(fn:(connection:FinanceExecutor)=>Promise<T>){
  const connection=await db().getConnection();
  try{await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await connection.query('START TRANSACTION READ ONLY');const result=await fn(connection);await connection.commit();return result;}
  catch(error){await connection.rollback();const code=(error as {code?:string}).code;if(code==='ER_NO_SUCH_TABLE'||code==='ER_BAD_FIELD_ERROR')throw new AppError('Required finance tables or columns are unavailable. Verify the ledger and settlement migrations before using monitoring.',503,'FINANCE_SCHEMA_REQUIRED');throw error;}
  finally{connection.release();}
 }
 async function capitalDates(c:FinanceExecutor,f:FinanceFilters){
  const [tables]=await c.execute<(RowDataPacket&{present:number})[]>("SELECT COUNT(*) AS present FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='patronage_capital_transfers'");
  return {...dateScope(f,clock()),patronageAvailable:Number(tables[0]?.present??0)>0};
 }
 return {
  options:async()=>snapshot(async c=>{const [rows]=await c.execute<(RowDataPacket&{barangay:string|null;sector:string|null})[]>('SELECT DISTINCT barangay, sector FROM member_profiles ORDER BY barangay, sector');const [types]=await c.execute<(RowDataPacket&{value:string})[]>('SELECT DISTINCT transaction_type AS value FROM share_capital_transactions ORDER BY transaction_type');return{barangays:[...new Set(rows.map(r=>r.barangay).filter((v):v is string=>Boolean(v)))],sectors:[...new Set(rows.map(r=>r.sector).filter((v):v is string=>Boolean(v)))],transactionTypes:types.map(r=>r.value)};}),
  paymentDiagnostics:(id:string)=>snapshot(c=>readPaymentDiagnostics(c,id)),
  payments:(f:FinanceFilters)=>snapshot(c=>readPaymentMonitor(c,f,dateScope(f,clock()),clock())),
  capital:(f:FinanceFilters)=>snapshot(async c=>{const scope=await capitalDates(c,f);return {...await readCapitalMonitor(c,f,scope,clock()),payments:await capitalList(c,f,scope,'payments')};}),
  accounts:(f:FinanceFilters)=>snapshot(async c=>readCapitalMonitor(c,f,await capitalDates(c,f),clock())),
  transactions:(f:FinanceFilters)=>snapshot(async c=>capitalList(c,f,await capitalDates(c,f),'transactions')),
  export:(kind:'payments'|'capital',f:FinanceFilters)=>snapshot(async c=>financeWorkbook(c,kind,f,kind==='capital'?await capitalDates(c,f):dateScope(f,clock()),clock())),
  schema:async()=>{const [rows]=await db().execute<(RowDataPacket&{tableName:string})[]>('SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');const names=new Set(rows.map(r=>r.tableName));return{requiredPresent:required.every(t=>names.has(t)),missing:required.filter(t=>!names.has(t)),patronageTransferTable:names.has('patronage_capital_transfers'),note:'Table presence is not proof that historical data is complete or reconciled.'};},
 };
}
export type FinanceMonitoringService=ReturnType<typeof createFinanceMonitoringService>;
