// Read-only check of the exact activity migration prerequisites.
const mysql=require('mysql2/promise'),dotenv=require('dotenv'),fs=require('fs');
const e=dotenv.parse(fs.readFileSync('server/.env'));
if(e.DB_NAME!=='trackcoopdb_main'||!e.DB_HOST?.endsWith('.rds.amazonaws.com'))throw Error('Unexpected database');
(async()=>{const db=await mysql.createConnection({host:e.DB_HOST,port:Number(e.DB_PORT||3306),user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME,ssl:e.DB_SSL==='true'?{}:undefined,connectTimeout:15000});try{
const [[id]]=await db.query('SELECT DATABASE() AS db,@@version AS version');if(id.db!=='trackcoopdb_main')throw Error('Unexpected identity');
const [columns]=await db.query("SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName,COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='cooperative_activities' AND COLUMN_NAME IN ('activity_id','activity_time','activity_location','activity_status')) OR (TABLE_NAME='member_profiles' AND COLUMN_NAME='member_id') OR (TABLE_NAME='member_activity_participation' AND COLUMN_NAME='participation_id')) ORDER BY TABLE_NAME,COLUMN_NAME");
const [tables]=await db.query("SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('cooperative_activities','member_profiles','member_activity_participation','managed_activity_attendance')");
const [[counts]]=await db.query('SELECT (SELECT COUNT(*) FROM cooperative_activities) AS activities,(SELECT COUNT(*) FROM member_activity_participation) AS participations');console.log(JSON.stringify({id,columns,tables,counts},null,2));
}finally{await db.end()}})().catch(e=>{console.error('Preflight failed:',e.code||e.name);process.exitCode=1});
