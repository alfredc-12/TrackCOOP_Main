// Read-only aggregate snapshot of protected development tables. No row data.
const mysql=require('mysql2/promise'),dotenv=require('dotenv'),fs=require('fs'),path=require('path');
const e=dotenv.parse(fs.readFileSync('server/.env'));
if(e.DB_NAME!=='trackcoopdb_main'||!e.DB_HOST?.endsWith('.rds.amazonaws.com'))throw Error('Unexpected database');
const label=process.argv[2];if(!/^(baseline|CAL\d\d|JMR\d\d)-(before|after)$/.test(label||''))throw Error('Invalid snapshot label');
const dir=path.resolve('evidence/jmeter/integrity');fs.mkdirSync(dir,{recursive:true});const outfile=path.join(dir,`${label}.json`);if(fs.existsSync(outfile))throw Error('Snapshot already exists');
const tables=['member_profiles','share_capital_payments','share_capital_accounts','share_capital_transactions','financial_records','payment_references','products','inventory_movements','pos_sales','pos_sale_items','rental_bookings','rental_pos_records'];
(async()=>{let db=await mysql.createConnection({host:e.DB_HOST,port:Number(e.DB_PORT||3306),user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME,ssl:e.DB_SSL==='true'?{}:undefined,connectTimeout:15000});try{
const [[identity]]=await db.query('SELECT DATABASE() AS db,@@version AS version');if(identity.db!=='trackcoopdb_main')throw Error('Unexpected database');
let output={label,time:new Date().toISOString(),database:identity.db,version:identity.version,tables:{},invariants:{}};
for(const table of tables){const [[count]]=await db.query(`SELECT COUNT(*) AS n FROM \`${table}\``);const [checksum]=await db.query(`CHECKSUM TABLE \`${table}\``);output.tables[table]={count:count.n,checksum:checksum[0].Checksum};}
const checks={
validated_reference_duplicates:"SELECT COUNT(*) AS n FROM (SELECT reference_number FROM payment_references WHERE validation_status='Validated' AND reference_number IS NOT NULL AND reference_number<>'' GROUP BY reference_number HAVING COUNT(*)>1) d",
duplicate_payment_ledger_sources:"SELECT COUNT(*) AS n FROM (SELECT source_type,source_id FROM share_capital_transactions WHERE source_type='share_capital_payment' AND source_id IS NOT NULL AND transaction_status='Posted' GROUP BY source_type,source_id HAVING COUNT(*)>1) d",
ledger_balance_mismatches:"SELECT COUNT(*) AS n FROM share_capital_accounts a LEFT JOIN (SELECT share_capital_account_id,SUM(CASE WHEN direction='Credit' THEN amount ELSE -amount END) AS total FROM share_capital_transactions WHERE transaction_status='Posted' GROUP BY share_capital_account_id) t ON t.share_capital_account_id=a.share_capital_account_id WHERE ABS(a.current_balance-COALESCE(t.total,0))>0.01",
duplicate_rental_pos_financial_sources:"SELECT COUNT(*) AS n FROM (SELECT source_module,source_record_id,record_type,financial_category_id FROM financial_records WHERE source_module IN ('Rental','POS') AND source_record_id IS NOT NULL AND record_status='Posted' GROUP BY source_module,source_record_id,record_type,financial_category_id HAVING COUNT(*)>1) d",
negative_inventory_products:"SELECT COUNT(*) AS n FROM (SELECT product_id,SUM(quantity_change) quantity FROM inventory_movements GROUP BY product_id HAVING quantity<0) d",
share_capital_income_records:"SELECT COUNT(*) AS n FROM financial_records f JOIN financial_categories c ON c.financial_category_id=f.financial_category_id WHERE c.category_code='SHARE_CAPITAL' AND f.record_type='Income' AND f.record_status='Posted'",
account_balance_total:"SELECT COALESCE(SUM(current_balance),0) AS n FROM share_capital_accounts",
financial_record_total:"SELECT COALESCE(SUM(amount),0) AS n FROM financial_records"};
for(const [name,query] of Object.entries(checks)){const [[row]]=await db.query(query);output.invariants[name]=row.n;}
fs.writeFileSync(outfile,JSON.stringify(output,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({label,output:outfile,tableCount:tables.length,invariants:output.invariants}));
}finally{await db.end()}})().catch(error=>{console.error('Snapshot failed:',error.code||error.name);process.exitCode=1});
