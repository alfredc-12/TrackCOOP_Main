// One-time additive migration for the owner-confirmed dummy development DB.
// MySQL DDL is not transactional; a partial failure must be inspected manually.
const mysql=require('mysql2/promise'),dotenv=require('dotenv'),fs=require('fs'),crypto=require('crypto');
const e=dotenv.parse(fs.readFileSync('server/.env'));
if(e.DB_NAME!=='trackcoopdb_main'||!e.DB_HOST?.endsWith('.rds.amazonaws.com'))throw Error('Unexpected database');
(async()=>{const db=await mysql.createConnection({host:e.DB_HOST,port:Number(e.DB_PORT||3306),user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME,ssl:e.DB_SSL==='true'?{}:undefined,connectTimeout:15000});try{
const [[id]]=await db.query('SELECT DATABASE() AS db,@@version AS version');if(id.db!=='trackcoopdb_main')throw Error('Unexpected identity');
const [c]=await db.query("SELECT TABLE_NAME AS t,COLUMN_NAME AS n,COLUMN_TYPE AS typ FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='cooperative_activities' AND COLUMN_NAME IN ('activity_id','activity_time','activity_location','activity_status')) OR (TABLE_NAME='member_profiles' AND COLUMN_NAME='member_id') OR (TABLE_NAME='member_activity_participation' AND COLUMN_NAME='participation_id'))");
const [t]=await db.query("SELECT TABLE_NAME AS n,ENGINE AS e FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('cooperative_activities','member_profiles','member_activity_participation','managed_activity_attendance')");
const wanted=['cooperative_activities.activity_id','member_profiles.member_id','member_activity_participation.participation_id'];
if(c.length!==3 || wanted.some(key=>!c.some(x=>`${x.t}.${x.n}`===key && x.typ==='bigint unsigned')) || t.length!==3 || t.some(x=>x.e!=='InnoDB'||x.n==='managed_activity_attendance'))throw Error('Migration prerequisites differ; no changes performed');
const [[before]]=await db.query('SELECT (SELECT COUNT(*) FROM cooperative_activities) AS activities,(SELECT COUNT(*) FROM member_activity_participation) AS participations');
const sql=fs.readFileSync('server/database/migrations/20261108_activity_management.sql','utf8');const statements=sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
if(statements.length!==2 || !statements[0].startsWith('ALTER TABLE cooperative_activities') || !statements[1].startsWith('CREATE TABLE managed_activity_attendance'))throw Error('Unexpected migration text');
for(const statement of statements) await db.query(statement);
const [[after]]=await db.query('SELECT (SELECT COUNT(*) FROM cooperative_activities) AS activities,(SELECT COUNT(*) FROM member_activity_participation) AS participations');
console.log(JSON.stringify({database:id.db,version:id.version,migration:'20261108_activity_management.sql',sha256:crypto.createHash('sha256').update(sql).digest('hex'),before,after}));
if(before.activities!==after.activities||before.participations!==after.participations)throw Error('Row counts changed; investigate');
}finally{await db.end()}})().catch(e=>{console.error('Migration failed or partially applied:',e.code||e.name);process.exitCode=1});
