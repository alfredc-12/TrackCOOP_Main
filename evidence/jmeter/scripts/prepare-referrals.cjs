// Populate only missing referral codes on this run's own synthetic members.
const mysql=require('mysql2/promise'),dotenv=require('dotenv'),fs=require('fs');
const e=dotenv.parse(fs.readFileSync('server/.env'));
if(e.DB_NAME!=='trackcoopdb_main'||!e.DB_HOST?.endsWith('.rds.amazonaws.com'))throw Error('Unexpected database');
const first=fs.readFileSync('scratch/jmeter-private/users.csv','utf8').split(/\r?\n/)[1].split(',')[0];
const marker=/^(jmeter-[a-f0-9]{10})-01@example\.test$/.exec(first)?.[1];if(!marker)throw Error('Invalid fixture marker');
(async()=>{let db=await mysql.createConnection({host:e.DB_HOST,port:Number(e.DB_PORT||3306),user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME,ssl:e.DB_SSL==='true'?{}:undefined,connectTimeout:15000});try{
const [[id]]=await db.query('SELECT DATABASE() AS db');if(id.db!=='trackcoopdb_main')throw Error('Unexpected identity');await db.beginTransaction();
const [[counts]]=await db.execute('SELECT COUNT(*) AS n, SUM(referral_code IS NULL) AS missing FROM member_profiles WHERE member_code LIKE ? FOR UPDATE',[`${marker}-%`]);
if(counts.n!==12)throw Error('Unexpected synthetic member count');
const [result]=await db.execute("UPDATE member_profiles SET referral_code=UPPER(CONCAT('REF-',member_code)) WHERE member_code LIKE ? AND referral_code IS NULL",[`${marker}-%`]);
if(result.affectedRows!==Number(counts.missing))throw Error('Unexpected number changed');await db.commit();console.log(JSON.stringify({fixtureMarker:marker,syntheticMembers:counts.n,initialized:result.affectedRows}));
}catch(err){await db.rollback();throw err}finally{await db.end()}})().catch(e=>{console.error('Fixture preparation failed:',e.code||e.name);process.exitCode=1});
