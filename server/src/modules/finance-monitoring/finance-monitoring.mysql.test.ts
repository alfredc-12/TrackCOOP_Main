import assert from "node:assert/strict";
import test from "node:test";
import mysql,{type Pool} from "mysql2/promise";
import JSZip from "jszip";
import { financeFilterSchema,dateScope,type FinanceFilters } from "./finance-monitoring.schema";
import { readPaymentMonitor,readPaymentDiagnostics } from "./payment-monitoring";
import { readCapitalMonitor } from "./capital-monitoring";
import { capitalList } from "./capital-lists";
import { financeWorkbook } from "./finance-monitoring.export";
const enabled=process.env.FINANCE_LOCAL_SQL_TEST==='1';
const now=new Date('2026-11-03T02:00:00Z');
const testScope=(f:FinanceFilters,at=now)=>({...dateScope(f,at),patronageAvailable:true});
const parse=(patch:Record<string,unknown>={})=>financeFilterSchema.parse({period:'all',...patch});
const ddl=[
`CREATE TABLE member_profiles(member_id BIGINT PRIMARY KEY,member_code VARCHAR(80),full_name VARCHAR(255),membership_type VARCHAR(40),approval_status VARCHAR(40),official_member_status VARCHAR(40),share_capital_deadline DATE NULL,barangay VARCHAR(100),sector VARCHAR(100))`,
`CREATE TABLE membership_applications(membership_application_id BIGINT PRIMARY KEY,application_code VARCHAR(80),first_name VARCHAR(80),middle_name VARCHAR(80),last_name VARCHAR(80),suffix VARCHAR(20))`,
`CREATE TABLE rental_assets(rental_asset_id BIGINT PRIMARY KEY,asset_name VARCHAR(80))`,
`CREATE TABLE rental_bookings(rental_booking_id BIGINT PRIMARY KEY,rental_asset_id BIGINT,booking_number VARCHAR(80),requester_name VARCHAR(80),start_datetime DATETIME,end_datetime DATETIME,purpose TEXT)`,
`CREATE TABLE pos_sale_items(pos_sale_id BIGINT,quantity DECIMAL(12,2))`,
`CREATE TABLE payment_references(payment_reference_id BIGINT PRIMARY KEY,member_id BIGINT NULL,submitted_by BIGINT NULL,payer_name VARCHAR(255),payer_email VARCHAR(100),payer_contact VARCHAR(80),provider VARCHAR(80),reference_number VARCHAR(100),payment_purpose VARCHAR(80),related_entity_type VARCHAR(80),related_entity_id BIGINT NULL,amount DECIMAL(14,2),proof_file_path VARCHAR(500),validation_status VARCHAR(40),payment_channel VARCHAR(40),gateway_environment VARCHAR(20),gateway_checkout_id VARCHAR(100),gateway_payment_id VARCHAR(100),gateway_payment_intent_id VARCHAR(100),gateway_status VARCHAR(40),gateway_payment_method VARCHAR(40),gateway_fee_amount DECIMAL(14,2) NULL,gateway_net_amount DECIMAL(14,2) NULL,paid_at DATETIME NULL,webhook_received_at DATETIME NULL,validation_source VARCHAR(40),validated_by BIGINT NULL,validated_at DATETIME NULL,rejection_reason TEXT,notes TEXT,submitted_at DATETIME,updated_at DATETIME)`,
`CREATE TABLE payment_validation_history(payment_validation_history_id BIGINT AUTO_INCREMENT PRIMARY KEY,payment_reference_id BIGINT,new_status VARCHAR(40),changed_at DATETIME)`,
`CREATE TABLE payment_gateway_events(payment_gateway_event_id BIGINT AUTO_INCREMENT PRIMARY KEY,payment_reference_id BIGINT,processing_status VARCHAR(40))`,
`CREATE TABLE member_dividends(member_dividend_id BIGINT PRIMARY KEY,member_id BIGINT,dividend_amount DECIMAL(14,2),dividend_status VARCHAR(40),share_capital_transaction_id BIGINT)`,
`CREATE TABLE patronage_capital_transfers(transfer_id BIGINT PRIMARY KEY,member_id BIGINT,amount DECIMAL(14,2),transfer_status VARCHAR(40),share_capital_transaction_id BIGINT)`,
`CREATE TABLE payment_receipts(payment_reference_id BIGINT PRIMARY KEY,processing_status VARCHAR(40))`,
`CREATE TABLE financial_records(financial_record_id BIGINT AUTO_INCREMENT PRIMARY KEY,payment_reference_id BIGINT,record_type VARCHAR(30),record_status VARCHAR(30),amount DECIMAL(14,2),approved_by BIGINT NULL,reversal_of_record_id BIGINT NULL)`,
`CREATE TABLE share_capital_accounts(share_capital_account_id BIGINT PRIMARY KEY,member_id BIGINT UNIQUE,initial_capital DECIMAL(14,2),total_additional_contributions DECIMAL(14,2),total_dividends_added DECIMAL(14,2),total_deductions DECIMAL(14,2),current_balance DECIMAL(14,2),updated_at DATETIME)`,
`CREATE TABLE share_capital_payments(share_payment_id BIGINT PRIMARY KEY,member_id BIGINT,payment_reference_id BIGINT NULL,amount DECIMAL(14,2),payment_date DATE,payment_status VARCHAR(40))`,
`CREATE TABLE share_capital_transactions(share_capital_transaction_id BIGINT PRIMARY KEY,share_capital_account_id BIGINT,member_id BIGINT,transaction_date DATE,transaction_type VARCHAR(80),direction VARCHAR(20),amount DECIMAL(14,2),balance_before DECIMAL(14,2),balance_after DECIMAL(14,2),reference_number VARCHAR(100),source_type VARCHAR(80),source_id BIGINT,transaction_status VARCHAR(30),created_at DATETIME)`
];
test('finance SQL integration: real DECIMAL, joins, dates, reversals, capital and exports',{skip:!enabled},async t=>{
 // This test deliberately cannot use DATABASE_URL or application DB credentials.
 const connection=await mysql.createConnection({host:'127.0.0.1',port:33317,user:'root'});
 const [identity]=await connection.query<mysql.RowDataPacket[]>('SELECT @@datadir AS directory');
 assert.match(String(identity[0].directory).replace(/\\/g,'/'),/TrackCOOP_ChairmanFinance_Worktree\/\.finance-test-(maria|data)/i);
 await connection.query('CREATE DATABASE IF NOT EXISTS trackcoop_finance_fixture');await connection.end();
 const pool=mysql.createPool({host:'127.0.0.1',port:33317,user:'root',database:'trackcoop_finance_fixture',timezone:'Z',dateStrings:true});
 try{
  for(const statement of ddl){const name=/CREATE TABLE (\w+)/.exec(statement)![1];await pool.query(`DROP TABLE IF EXISTS ${name}`);await pool.query(statement);}
  await seed(pool);
  await t.test('manual review excludes gateway checkouts, clarification is separate and empty results are zero',async()=>{
   const f=parse();const r=await readPaymentMonitor(pool,f,testScope(f,now),now);
   assert.equal(r.summary.pendingManual,1);assert.equal(r.summary.pendingGateway,1);assert.equal(r.summary.needsClarification,1);
   const empty=parse({search:'No matching member'});const e=await readPaymentMonitor(pool,empty,testScope(empty,now),now);assert.equal(e.total,0);assert.equal(e.summary.validatedVolume,'0.00');
  });
  await t.test('operational excludes Test; repeated history never multiplies 0.10 + 0.20 validations',async()=>{
   const f=parse({purpose:'POS/Product',period:'today'});const r=await readPaymentMonitor(pool,f,testScope(f,now),now);
   assert.equal(r.summary.validatedCount,2);assert.equal(r.summary.validatedVolume,'0.30');assert.equal(r.purposes[0].amount,'0.30');
   const all=parse({purpose:'POS/Product',period:'today',environment:'All'});const a=await readPaymentMonitor(pool,all,testScope(all,now),now);assert.equal(a.summary.validatedVolume,'999.30');
  });
  await t.test('Manila midnight, old submission with later validation, history fallback, and reversal dates',async()=>{
   const f=parse({period:'today'});const r=await readPaymentMonitor(pool,f,testScope(f,now),now);
   assert.equal(r.summary.validatedCount,4); // 0.10 + 0.20 + reversed 40 + history fallback 30
   assert.equal(r.summary.validatedVolume,'70.30');assert.equal(r.summary.reversedCount,1);assert.equal(r.summary.reversedVolume,'40.00');
   const before=parse({period:'yesterday'});const b=await readPaymentMonitor(pool,before,testScope(before,now),now);assert.equal(b.summary.validatedCount,1);assert.equal(b.summary.validatedVolume,'5.00');
  });
  await t.test('status narrows only the table, validation events use validation dates, amount and purpose filters reconcile',async()=>{
   const f=parse({period:'today',status:'Rejected'});const r=await readPaymentMonitor(pool,f,testScope(f,now),now);assert.equal(r.summary.validatedVolume,'70.30');assert.equal(r.items.length,1);
   const v=parse({period:'today',view:'validations',purpose:'POS/Product',minAmount:'0.15',pageSize:1});const a=await readPaymentMonitor(pool,v,testScope(v,now),now);assert.equal(a.summary.validatedVolume,'0.20');assert.equal(a.total,1);assert.equal(a.items[0].referenceNumber,'PAY-2');
  });
  await t.test('expected-purpose posting and receipt issues are reviewable, not assumed for unrelated purposes',async()=>{
   const f=parse({view:'exceptions'});const r=await readPaymentMonitor(pool,f,testScope(f,now),now);assert.ok(r.total>0);assert.ok(r.items.some(p=>p.referenceNumber==='PAY-8'));
   const clean=parse({purpose:'Other',reference:'PAY-7'});const c=await readPaymentMonitor(pool,clean,testScope(clean,now),now);assert.equal(c.items[0].exception,0);
  });
  await t.test('posting amount mismatches and an active income record after reversal are flagged without changing payment volume',async()=>{
   await pool.query('UPDATE financial_records SET amount=25 WHERE payment_reference_id=1');
   try{const diagnostics=await readPaymentDiagnostics(pool,'1');assert.ok(diagnostics?.warnings.some(w=>w.includes('amount does not match')));const f=parse({period:'today',purpose:'POS/Product'}),r=await readPaymentMonitor(pool,f,testScope(f,now),now);assert.equal(r.summary.validatedVolume,'0.30');assert.ok(r.items.some(row=>row.id==='2'));}finally{await pool.query('UPDATE financial_records SET amount=0.10 WHERE payment_reference_id=1');}
   await pool.query("UPDATE payment_references SET validation_status='Reversed' WHERE payment_reference_id=1");
   try{const diagnostics=await readPaymentDiagnostics(pool,'1');assert.ok(diagnostics?.warnings.some(w=>w.includes('active approved income')));}finally{await pool.query("UPDATE payment_references SET validation_status='Validated' WHERE payment_reference_id=1");}
  });
  await t.test('capital liability includes inactive holders; contributions exclude interest, patronage, pending and reversals',async()=>{
   const f=parse();const r=await readCapitalMonitor(pool,f,testScope(f,now),now);
   assert.equal(r.summary.balance,'7750.00');assert.equal(r.summary.holders,4);assert.equal(r.summary.periodContributions,'4500.00');assert.equal(r.summary.pending,'700.00');assert.equal(r.summary.reversedContributions,'500.00');
   assert.equal(r.summary.eligible,3);assert.equal(r.summary.completed,1);assert.equal(r.summary.completionPercent,null);assert.equal(r.summary.unassessedEligible,1);assert.ok(r.summary.review>=1);
   const composition=r.composition;assert.equal(composition.find(x=>x.label==='Patronage capitalized')?.amount,'1000.00');assert.equal(composition.find(x=>x.label==='Interest capitalized')?.amount,'200.00');
  });
  await t.test('reconciliation compares signed movements and counters and reports missing credits',async()=>{
   const f=parse({reconciliation:'review'});const r=await readCapitalMonitor(pool,f,testScope(f,now),now);assert.ok(r.accounts.some(a=>a.memberId==='4'&&a.difference==='50.00'));assert.ok(r.accounts.some(a=>a.memberId==='5'&&a.missingCredits===1));
  });
  await t.test('recorded deadlines, distinct capital bands, no-account and as-of balances are explicit',async()=>{
   const f=parse({deadline:'overdue'});const r=await readCapitalMonitor(pool,f,testScope(f,now),now);assert.equal(r.total,1);assert.equal(r.accounts[0].memberId,'3');
   const stage=parse({stage:'atMax'});assert.equal((await readCapitalMonitor(pool,stage,testScope(stage,now),now)).total,0);
   const no=parse({reconciliation:'noAccount'});assert.equal((await readCapitalMonitor(pool,no,testScope(no,now),now)).total,1);
   const past=parse({asOf:'2026-10-01'});const h=await readCapitalMonitor(pool,past,testScope(past,now),now);assert.equal(h.summary.completionPercent,null);assert.equal(h.scope.historical,true);
  });
  await t.test('full payment pagination and transactions retain exact totals and source links',async()=>{
   const f=parse({page:2,pageSize:2});const p=await capitalList(pool,f,testScope(f,now),'payments');assert.equal(p.page,2);assert.equal(p.total,6);assert.equal(p.items.length,2);
   const tx=parse({memberId:'1',transactionGroup:'contributions'});const list=await capitalList(pool,tx,testScope(tx,now),'transactions');assert.equal(list.total,2);assert.ok(list.items.every(row=>row.sourceType==='share_capital_payment'));assert.ok(list.items.some(row=>row.paymentReferenceId==='12'));
  });

  await t.test('invalid or duplicate source credits are excluded or deduplicated and the affected account is reviewable',async()=>{
   const f=parse();
   await pool.query("UPDATE share_capital_payments SET amount=1400 WHERE share_payment_id=2");
   try{const report=await readCapitalMonitor(pool,f,testScope(f,now),now);assert.equal(report.summary.periodContributions,'3000.00');assert.ok(report.accounts.find(a=>a.memberId==='1')!.sourceIssues>0);assert.equal(report.summary.balance,'7750.00');}finally{await pool.query('UPDATE share_capital_payments SET amount=1500 WHERE share_payment_id=2');}
   await pool.query("INSERT INTO share_capital_transactions VALUES (13,1,1,'2026-11-02','Additional Capital Contribution','Credit',1500,4200,5700,'DUP-2','share_capital_payment',2,'Posted','2026-11-02 00:00:00')");
   try{const report=await readCapitalMonitor(pool,f,testScope(f,now),now);assert.equal(report.summary.periodContributions,'4500.00');assert.ok(report.accounts.find(a=>a.memberId==='1')!.sourceIssues>0);}finally{await pool.query('DELETE FROM share_capital_transactions WHERE share_capital_transaction_id=13');}
  });
  await t.test('test-funded capital remains a recorded liability but is not counted as live collection or certified completion',async()=>{
   await pool.query("UPDATE payment_references SET payment_channel='PayMongo',gateway_environment='Test' WHERE payment_reference_id=12");
   try{const f=parse(),r=await readCapitalMonitor(pool,f,testScope(f,now),now);assert.equal(r.summary.balance,'7750.00');assert.equal(r.summary.periodContributions,'3000.00');assert.equal(r.accounts.find(a=>a.memberId==='1')!.unverifiedSources,1);assert.equal(r.summary.completionPercent,null);}finally{await pool.query("UPDATE payment_references SET payment_channel='Cash',gateway_environment='Manual' WHERE payment_reference_id=12");}
  });
  await t.test('missing patronage source tables are disclosed without inventing approval assurance',async()=>{
   await pool.query('DROP TABLE patronage_capital_transfers');
   try{const f=parse(),scope={...testScope(f,now),patronageAvailable:false},r=await readCapitalMonitor(pool,f,scope,now);assert.equal(r.summary.balance,'7750.00');assert.equal(r.accounts.find(a=>a.memberId==='1')!.unverifiedSources,1);}finally{await pool.query(ddl.find(sql=>sql.startsWith('CREATE TABLE patronage_capital_transfers'))!);await pool.query("INSERT INTO patronage_capital_transfers VALUES (1,1,1000,'Approved',4)");}
  });
  await t.test('due-soon uses the recorded deadline and a known zero account, while unknown historical reversals stay unavailable',async()=>{
   await pool.query("INSERT INTO member_profiles VALUES (6,'M6','Faye','True Member','Approved','Active','2026-11-05','Aga','Corn')");
   try{const f=parse({deadline:'dueSoon'}),r=await readCapitalMonitor(pool,f,testScope(f,now),now);assert.equal(r.total,1);assert.equal(r.accounts[0].memberId,'6');}finally{await pool.query('DELETE FROM member_profiles WHERE member_id=6');}
   await pool.query("UPDATE share_capital_transactions SET transaction_status='Reversed' WHERE share_capital_transaction_id=1");
   try{const f=parse({asOf:'2026-10-01'}),r=await readCapitalMonitor(pool,f,testScope(f,now),now);assert.equal(r.accounts.find(a=>a.memberId==='1')!.balance,null);assert.equal(r.summary.unknownBalances,1);}finally{await pool.query("UPDATE share_capital_transactions SET transaction_status='Posted' WHERE share_capital_transaction_id=1");}
  });
  await t.test('an overall completion percentage is available only once every eligible balance can be assessed',async()=>{
   await pool.query('UPDATE share_capital_accounts SET current_balance=1000 WHERE member_id=4');
   try{const f=parse(),r=await readCapitalMonitor(pool,f,testScope(f,now),now);assert.equal(r.summary.unassessedEligible,0);assert.ok(Math.abs(r.summary.completionPercent!-100/3)<0.0001);}finally{await pool.query('UPDATE share_capital_accounts SET current_balance=1050 WHERE member_id=4');}
  });
  await t.test('undated legacy validations are disclosed and never assigned a fabricated reporting date',async()=>{
   await pool.query("INSERT INTO payment_references(payment_reference_id,member_id,payer_name,reference_number,amount,validation_status,payment_channel,gateway_environment,submitted_at,payment_purpose) VALUES (13,1,'Ana','UNDATED',10,'Validated','Cash','Manual','2026-11-02 18:00:00','Other')");
   try{const f=parse({period:'today'}),r=await readPaymentMonitor(pool,f,testScope(f,now),now);assert.equal(r.summary.missingValidationDate,1);assert.equal(r.summary.validatedVolume,'70.30');assert.equal(r.summary.validatedCount,4);}finally{await pool.query('DELETE FROM payment_references WHERE payment_reference_id=13');}
  });
  await t.test('Excel exports the complete filtered data and reconciled summary, with formula-safe text',async()=>{
   const f=parse({purpose:'POS/Product',period:'today',view:'validations',pageSize:1});const bytes=await financeWorkbook(pool,'payments',f,testScope(f,now),now);const zip=await JSZip.loadAsync(bytes);const content=await Promise.all(Object.keys(zip.files).filter(x=>x.startsWith('xl/worksheets/')&&x.endsWith('.xml')).map(x=>zip.file(x)!.async('string')));const all=content.join('');assert.match(all,/PAY-1/);assert.match(all,/PAY-2/);assert.match(all,/0.30/);assert.doesNotMatch(all,/PAY-3/);
   const capital=await financeWorkbook(pool,'capital',parse(),testScope(parse(),now),now);assert.ok(capital.byteLength>1000);
   await pool.execute("UPDATE payment_references SET payer_name='=HYPERLINK(1)' WHERE payment_reference_id=2");
   const safe=await JSZip.loadAsync(await financeWorkbook(pool,'payments',f,testScope(f,now),now));
   const sheets=await Promise.all(Object.keys(safe.files).filter(x=>x.startsWith('xl/worksheets/')&&x.endsWith('.xml')).map(x=>safe.file(x)!.async('string')));assert.match(sheets.join(''),/HYPERLINK/);assert.doesNotMatch(sheets.join(''),/<f[ >]/);
  });
 }finally{await pool.end();}
});
async function seed(pool:Pool){
 await pool.query(`INSERT INTO member_profiles VALUES (1,'M1','Ana','True Member','Approved','Active','2026-10-01','Wawa','Rice'),(2,'M2','Ben','Associate','Approved','Inactive',NULL,'Aga','Corn'),(3,'M3','Cara','True Member','Approved','Active','2026-10-01','Wawa','Rice'),(4,'M4','Dora','True Member','Approved','Active',NULL,'Aga','Corn'),(5,'M5','Eli','Associate','Approved','Active',NULL,'Wawa','Rice')`);
 const payments=[
 [1,'0.10','Validated','PayMongo','Live','2026-10-01 00:00:00','2026-11-02 16:00:00','POS/Product'],
 [2,'0.20','Validated','Cash','Manual','2026-11-02 17:00:00','2026-11-02 17:00:00','POS/Product'],
 [3,'999.00','Validated','PayMongo','Test','2026-11-02 17:00:00','2026-11-02 17:00:00','POS/Product'],
 [4,'40.00','Reversed','Cash','Manual','2026-10-01 00:00:00','2026-11-02 18:00:00','Other'],
 [5,'5.00','Validated','Cash','Manual','2026-11-02 15:00:00','2026-11-02 15:59:59','Other'],
 [6,'30.00','Validated','Cash','Manual','2026-10-01 00:00:00',null,'Other'],
 [7,'20.00','Validated','Cash','Manual','2026-10-01 00:00:00','2026-10-01 00:00:00','Other'],
 [8,'100.00','Pending','Cash','Manual','2026-11-02 18:00:00',null,'Share Capital'],
 [9,'200.00','Pending','PayMongo','Live','2026-11-02 18:00:00',null,'Rental'],
 [10,'300.00','Needs Clarification','Cash','Manual','2026-11-02 18:00:00',null,'Share Capital'],
 [11,'100.00','Rejected','Cash','Manual','2026-11-02 18:00:00',null,'Other'],
 [12,'1500.00','Validated','Cash','Manual','2026-10-02 00:00:00','2026-10-02 00:00:00','Share Capital']
 ];
 for(const [id,amount,status,channel,environment,submitted,validated,purpose] of payments){await pool.execute(`INSERT INTO payment_references(payment_reference_id,member_id,payer_name,reference_number,amount,validation_status,payment_channel,gateway_environment,submitted_at,validated_at,payment_purpose) VALUES (?,1,'Ana',?,?,?,?,?,?,?,?)`,[id,`PAY-${id}`,amount,status,channel,environment,submitted,validated,purpose]);await pool.execute(`INSERT INTO payment_receipts VALUES (?,'Generated')`,[id]);}
 await pool.query(`INSERT INTO payment_validation_history(payment_reference_id,new_status,changed_at) VALUES (1,'Validated','2026-11-02 16:00:00'),(1,'Validated','2026-11-02 16:00:01'),(4,'Reversed','2026-11-02 20:00:00'),(6,'Validated','2026-11-02 20:00:00')`);
 await pool.query(`INSERT INTO payment_gateway_events(payment_reference_id,processing_status) VALUES (8,'Failed')`);
 await pool.query(`INSERT INTO financial_records(payment_reference_id,record_type,record_status,amount,approved_by) VALUES (1,'Income','Active',0.10,1),(2,'Income','Active',0.20,1),(3,'Income','Active',999.00,1)`);
 await pool.query(`INSERT INTO share_capital_accounts VALUES (1,1,1500,2500,200,0,4200,'2026-11-01'),(2,2,1500,0,0,0,1500,'2026-11-01'),(3,3,1500,0,0,500,1000,'2026-11-01'),(4,4,1000,0,0,0,1050,'2026-11-01')`);
 await pool.query(`INSERT INTO share_capital_payments VALUES (1,1,NULL,1500,'2026-10-01','Validated'),(2,1,12,1500,'2026-11-01','Validated'),(3,3,NULL,500,'2026-10-01','Reversed'),(4,3,NULL,700,'2026-11-01','Pending'),(5,5,NULL,1500,'2026-11-01','Validated'),(6,2,NULL,1500,'2026-10-01','Validated')`);
 const tx=[
 [1,1,'2026-10-01','Initial Share Capital','Credit','1500','share_capital_payment',1],
 [2,1,'2026-11-01','Additional Capital Contribution','Credit','1500','share_capital_payment',2],
 [3,1,'2026-11-01','Dividend Added to Share Capital','Credit','200','member_dividend',1],
 [4,1,'2026-11-01','Additional Capital Contribution','Credit','1000','patronage_capital_transfer',1],
 [5,2,'2026-10-01','Initial Share Capital','Credit','1500','share_capital_payment',6],
 [6,3,'2026-10-01','Initial Share Capital','Credit','500','share_capital_payment',3],
 [7,3,'2026-10-01','Capital Adjustment Credit','Credit','1000','migration',3],
 [8,3,'2026-11-01','Reversal','Debit','500','share_capital_payment_reversal',3],
 [9,4,'2026-10-01','Initial Share Capital','Credit','1000','migration',4]
 ];
 const balances=new Map<string,number>();
 for(const [id,member,date,type,direction,amount,source,sourceId] of tx){const before=balances.get(String(member))??0;const after=before+(direction==='Credit'?1:-1)*Number(amount);balances.set(String(member),after);await pool.execute(`INSERT INTO share_capital_transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'Posted',?)`,[id,member,member,date,type,direction,amount,before,after,`TX-${id}`,source,sourceId,`${date} 00:00:00`]);}
 await pool.query(`INSERT INTO member_dividends VALUES (1,1,200,'Added to Share Capital',3)`);
 await pool.query(`INSERT INTO patronage_capital_transfers VALUES (1,1,1000,'Approved',4)`);
}
