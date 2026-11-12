// Read-only metadata inventory. Credentials are read locally and never printed.
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const env = dotenv.parse(fs.readFileSync('server/.env'));
if (env.DB_NAME !== 'trackcoopdb_main' || !env.DB_HOST?.endsWith('.rds.amazonaws.com')) {
  throw new Error('Unexpected configured database; refusing connection');
}
(async () => {
  const db = await mysql.createConnection({host:env.DB_HOST, port:Number(env.DB_PORT || 3306),
    user:env.DB_USER, password:env.DB_PASSWORD, database:env.DB_NAME,
    ssl:env.DB_SSL === 'true' ? {} : undefined, connectTimeout:15000});
  try {
    const [[identity]] = await db.query('SELECT DATABASE() AS db, @@version AS version');
    if (identity.db !== 'trackcoopdb_main') throw new Error('Unexpected database selected');
    const [tables] = await db.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
    const names = tables.map(row => row.name);
    const required = ['users','roles','member_profiles','membership_applications','share_capital_accounts',
      'share_capital_transactions','share_capital_payments','financial_records','cooperative_activities',
      'member_activity_participation','payment_references'];
    const [columns] = await db.query("SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('users','roles','member_profiles','cooperative_activities') ORDER BY TABLE_NAME,ORDINAL_POSITION");
    const [roles] = await db.query('SELECT r.role_slug AS role, COUNT(*) AS n FROM users u JOIN roles r ON u.role_id=r.role_id GROUP BY r.role_slug');
    console.log(JSON.stringify({identity,tableCount:names.length,required:Object.fromEntries(required.map(n=>[n,names.includes(n)])),columns,usersByRole:roles},null,2));
  } finally { await db.end(); }
})().catch(error => { console.error('Inventory failed:', error.code || error.name); process.exitCode = 1; });
