// Creates only new JMeter-namespaced identities in the owner-confirmed dummy DB.
// Credentials are stored under ignored scratch/, never in evidence or output.
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = dotenv.parse(fs.readFileSync('server/.env'));
if (env.DB_NAME !== 'trackcoopdb_main' || !env.DB_HOST?.endsWith('.rds.amazonaws.com')) throw Error('Unexpected database');
const root = path.resolve('scratch/jmeter-private');
fs.mkdirSync(root, {recursive:true});
const output = path.join(root,'users.csv');
if (fs.existsSync(output)) throw Error('Credential file already exists; refusing duplicate fixture creation');
const marker = 'jmeter-' + crypto.randomBytes(5).toString('hex');
const identities = Array.from({length:20},(_,i) => ({
  index:i+1, role:['chairman','bookkeeper','member','member','member'][i%5],
  identifier:`${marker}-${String(i+1).padStart(2,'0')}@example.test`,
  password:crypto.randomBytes(18).toString('base64url')
}));
// Write first: if interrupted after database commit, credentials remain recoverable.
fs.writeFileSync(output, 'identifier,password,role,slot\n' + identities.map(x=>`${x.identifier},${x.password},${x.role},${x.index}`).join('\n')+'\n',{flag:'wx'});
(async()=>{
  const db = await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT||3306),user:env.DB_USER,
    password:env.DB_PASSWORD,database:env.DB_NAME,ssl:env.DB_SSL==='true'?{}:undefined,connectTimeout:15000});
  try {
    const [[info]]=await db.query('SELECT DATABASE() AS db');
    if(info.db!=='trackcoopdb_main') throw Error('Unexpected selected database');
    const [roles]=await db.query("SELECT role_id, role_slug FROM roles WHERE role_slug IN ('chairman','bookkeeper','member') AND is_active=1");
    const roleId=Object.fromEntries(roles.map(r=>[r.role_slug,r.role_id]));
    if(Object.keys(roleId).length!==3) throw Error('Required active roles missing');
    await db.beginTransaction();
    for(const u of identities){
      const hash=await bcrypt.hash(u.password,10);
      const [result]=await db.execute("INSERT INTO users(role_id,username,email,password_hash,display_name,account_status,email_verified_at) VALUES(?,?,?,?,?,'Active',NOW())",[roleId[u.role],`${marker}-${u.index}`,u.identifier,hash,`JMeter Synthetic ${u.index}`]);
      if(u.role==='member') await db.execute("INSERT INTO member_profiles(user_id,member_code,full_name,email,membership_type,approval_status,official_member_status,application_date,approved_at,true_member_since) VALUES(?,?,?,?, 'True Member','Approved','Active',CURDATE(),NOW(),CURDATE())",[result.insertId,`${marker}-${u.index}`,`JMeter Synthetic ${u.index}`,u.identifier]);
    }
    await db.commit();
    console.log(JSON.stringify({fixtureMarker:marker,identities:20,chairmen:4,bookkeepers:4,members:12,credentials:'scratch/jmeter-private/users.csv'}));
  } catch(e){ await db.rollback(); throw e; } finally {await db.end()}
})().catch(e=>{console.error('Fixture creation failed:',e.code||e.name);process.exitCode=1});
