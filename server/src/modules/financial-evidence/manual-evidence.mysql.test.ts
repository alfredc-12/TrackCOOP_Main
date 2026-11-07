import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import mysql from "mysql2/promise";
import type { AuthContext } from "../auth/auth.types";
import { createManualEvidenceRepository } from "./manual-evidence.repository";

const enabled=process.env.EVIDENCE_ISOLATED_MYSQL==="1";
const actor=(id:string,role:"bookkeeper"|"chairman"|"member")=>({user:{id,role,displayName:"Synthetic",email:"synthetic@example.test",username:null,mustChangePassword:false},sessionId:"1",tokenHash:"synthetic"}) as AuthContext;
const key=(s:string)=>s.repeat(64);
test("manual evidence lifecycle uses locked source, unique active links and audited transactions",{skip:!enabled},async()=>{
 const port=Number(process.env.EVIDENCE_TEST_PORT),expected=process.env.EVIDENCE_TEST_DATADIR;
 if(!Number.isInteger(port)||port<1024||!expected||!expected.toLowerCase().includes("trackcoop-budget-1b-synthetic"))throw new Error("Explicit isolated server required");
 const admin=await mysql.createConnection({host:"127.0.0.1",port,user:"root",multipleStatements:true});
 const [server]=await admin.query<mysql.RowDataPacket[]>("SELECT @@datadir AS dataDir,@@port AS port");
 const norm=(s:string)=>s.replace(/\\/g,"/").replace(/\/$/,"").toLowerCase();
 if(Number(server[0].port)!==port||norm(String(server[0].dataDir))!==norm(expected)){await admin.end();throw new Error("Refusing non-isolated target");}
 const db=`trackcoop_manual_evidence_test_${randomBytes(4).toString("hex")}`;await admin.query(`CREATE DATABASE \`${db}\``);await admin.end();
 const pool=mysql.createPool({host:"127.0.0.1",port,user:"root",database:db,multipleStatements:true,connectionLimit:5});
 try {
  await pool.query(`CREATE TABLE users(user_id BIGINT UNSIGNED PRIMARY KEY);
   CREATE TABLE financial_records(financial_record_id BIGINT UNSIGNED PRIMARY KEY,recorded_by BIGINT UNSIGNED,source_module VARCHAR(40),source_record_id BIGINT UNSIGNED NULL,payment_reference_id BIGINT UNSIGNED NULL,member_id BIGINT UNSIGNED NULL,approved_by BIGINT UNSIGNED NULL,record_status VARCHAR(20));
   CREATE TABLE documents(document_id BIGINT UNSIGNED PRIMARY KEY,uploaded_by BIGINT UNSIGNED,member_id BIGINT UNSIGNED NULL,access_level VARCHAR(40),document_status VARCHAR(20),document_type VARCHAR(40),current_version INT UNSIGNED,checksum_sha256 CHAR(64),expiration_date DATE NULL,related_module VARCHAR(80) NULL,related_record_id BIGINT UNSIGNED NULL,relationship_type VARCHAR(80) NULL);
   CREATE TABLE audit_logs(id BIGINT AUTO_INCREMENT PRIMARY KEY,user_id BIGINT UNSIGNED,action VARCHAR(100),entity_table VARCHAR(100),record_id BIGINT UNSIGNED,description TEXT,new_values JSON,action_time DATETIME);
   INSERT INTO users VALUES(1),(2),(3);
   INSERT INTO financial_records VALUES(10,1,'Manual',NULL,NULL,NULL,NULL,'Active'),(11,1,'POS',7,9,NULL,NULL,'Active');
   INSERT INTO documents VALUES(20,1,NULL,'Bookkeeper-only','Active','Receipt',1,REPEAT('a',64),NULL,NULL,NULL,NULL),(21,1,NULL,'Bookkeeper-only','Active','Receipt',1,REPEAT('b',64),NULL,NULL,NULL,NULL),(22,2,NULL,'Bookkeeper-only','Active','Receipt',1,REPEAT('c',64),NULL,NULL,NULL,NULL),(23,1,NULL,'Public','Active','Receipt',1,REPEAT('d',64),NULL,NULL,NULL,NULL),(24,1,NULL,'Bookkeeper-only','Active','Receipt',1,REPEAT('e',64),NULL,NULL,NULL,NULL),(25,1,NULL,'Bookkeeper-only','Active','Receipt',1,REPEAT('f',64),NULL,'POS',7,'Receipt');`);
  await pool.query(await readFile("server/database/migrations/20261107_manual_finance_evidence_links.sql","utf8"));
  const repo=createManualEvidenceRepository(pool),maker=actor("1","bookkeeper"),other=actor("2","bookkeeper"),chair=actor("3","chairman"),member=actor("2","member");
  for(const [record,document,user] of [["10","22",maker],["10","23",maker],["10","25",maker],["11","20",maker],["10","20",other],["10","20",member],["10","20",chair]] as const) await assert.rejects(repo.link(record,document,key("a"),user));
  const result=await Promise.allSettled([repo.link("10","20",key("a"),maker),repo.link("10","21",key("b"),maker)]);
  assert.equal(result.filter(r=>r.status==="fulfilled").length,1);assert.equal(result.filter(r=>r.status==="rejected").length,1);
  const rows=await repo.list("10",chair);assert.equal(rows.length,1);assert.equal(rows[0].verification,"UNAVAILABLE");
  await assert.rejects(repo.list("10",member));await assert.rejects(repo.list("10",other));
  const old=rows[0],replacement=old.documentId==="20"?"21":"20";
  assert.deepEqual(await repo.verify("10",old.id,maker),{status:"UNAVAILABLE",fingerprint:null});
  await assert.rejects(repo.verify("10",old.id,other));await assert.rejects(repo.history("10",member));
  await pool.execute("UPDATE financial_records SET source_module='POS' WHERE financial_record_id=10");
  await assert.rejects(repo.list("10",maker));
  await pool.execute("UPDATE financial_records SET source_module='Manual' WHERE financial_record_id=10");
  const updated=await repo.replace("10",old.id,1,replacement,"Replace illegible file",key("c"),maker);
  assert.deepEqual(await repo.verify("10",old.id,chair),{status:"STALE",fingerprint:null});
  await pool.execute("UPDATE documents SET access_level='Public' WHERE document_id=?",[replacement]);
  assert.deepEqual(await repo.verify("10",updated.id,maker),{status:"INVALID",fingerprint:null});
  await pool.execute("UPDATE documents SET access_level='Bookkeeper-only' WHERE document_id=?",[replacement]);
  assert.equal((await repo.replace("10",old.id,1,replacement,"Replace illegible file",key("c"),maker)).replayed,true);
  await assert.rejects(repo.revoke("10",updated.id,2,"Reason",key("d"),maker));
  await assert.rejects(repo.revoke("10",updated.id,1," ",key("d"),maker));
  await repo.revoke("10",updated.id,1,"Wrong file",key("d"),maker);
  assert.deepEqual(await repo.verify("10",updated.id,maker),{status:"STALE",fingerprint:null});
  const history=await repo.history("10",chair);assert.deepEqual(history.map(e=>e.eventType),["LINKED","REPLACED","REVOKED"]);assert.equal(history[2].reason,"Wrong file");
  assert.deepEqual((await repo.list("10",maker)).map(r=>r.status),["REPLACED","REVOKED"]);
  await assert.rejects(repo.link("10",old.documentId!,key("f"),maker));
  await pool.execute("UPDATE documents SET current_version=2 WHERE document_id=?",[replacement]);
  assert.equal((await repo.list("10",maker))[1].documentId,null);
  await pool.execute("UPDATE documents SET current_version=1 WHERE document_id=?",[replacement]);
  await pool.execute("UPDATE documents SET access_level='Public' WHERE document_id=?",[updated.id===old.id?old.documentId:replacement]);
  assert.equal((await repo.list("10",maker))[1].documentId,null);
  const [events]=await pool.query<mysql.RowDataPacket[]>("SELECT event_type,reason FROM finance_manual_evidence_events ORDER BY event_id");
  assert.deepEqual(events.map(e=>e.event_type),["LINKED","REPLACED","REVOKED"]);assert.equal(events[2].reason,"Wrong file");
  await pool.query("RENAME TABLE audit_logs TO unavailable_audit_logs");
  await assert.rejects(repo.link("10","24",key("e"),maker));
  const [count]=await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS count FROM finance_manual_evidence_links WHERE link_status='ACTIVE'");assert.equal(count[0].count,0);
 } finally {await pool.end();}
});

test("attested parent DDL accepts evidence migration in disposable MySQL",{skip:!enabled || !process.env.EVIDENCE_SCHEMA_EXPORT},async()=>{
 const bytes=await readFile(process.env.EVIDENCE_SCHEMA_EXPORT!);
 assert.equal(createHash("sha256").update(bytes).digest("hex"),"51f436489cb2551795790b81999d8e5f77b34c9c9ce11ac3cd7cc3c869bf37d7","structure export must match the G0 attestation");
 const source=bytes.toString("utf8");
 const port=Number(process.env.EVIDENCE_TEST_PORT),expected=process.env.EVIDENCE_TEST_DATADIR;
 if(!Number.isInteger(port)||port<1024||!expected||!expected.toLowerCase().includes("trackcoop-budget-1b-synthetic"))throw new Error("Explicit isolated server required");
 const admin=await mysql.createConnection({host:"127.0.0.1",port,user:"root",multipleStatements:true});
 const [server]=await admin.query<mysql.RowDataPacket[]>("SELECT @@datadir AS dataDir,@@port AS port");
 const norm=(s:string)=>s.replace(/\\/g,"/").replace(/\/$/,"").toLowerCase();
 if(Number(server[0].port)!==port||norm(String(server[0].dataDir))!==norm(expected)){await admin.end();throw new Error("Refusing non-isolated target");}
 const db=`trackcoop_evidence_schema_test_${randomBytes(4).toString("hex")}`;await admin.query(`CREATE DATABASE \`${db}\``);await admin.end();
 const pool=mysql.createPool({host:"127.0.0.1",port,user:"root",database:db,multipleStatements:true});
 try {
  for(const [table,pk] of [["users","user_id"],["documents","document_id"],["financial_records","financial_record_id"],["payment_receipts","payment_receipt_id"]]) {
   const begin=source.indexOf(`CREATE TABLE \`${table}\``),end=source.indexOf(";",begin);
   if(begin<0||end<0)throw new Error(`Missing attested DDL for ${table}`);
   await pool.query(source.slice(begin,end+1));
   await pool.query(`ALTER TABLE \`${table}\` ADD PRIMARY KEY (\`${pk}\`)`);
  }
  await pool.query(await readFile("server/database/migrations/20261107_manual_finance_evidence_links.sql","utf8"));
  await pool.query(await readFile("server/database/migrations/20261107_receipt_attempt_recovery.sql","utf8"));
  const [refs]=await pool.query<mysql.RowDataPacket[]>("SELECT CONSTRAINT_NAME AS name,REFERENCED_TABLE_NAME AS parent FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_manual_evidence_links' AND REFERENCED_TABLE_NAME IS NOT NULL");
  assert.deepEqual(new Set(refs.map(r=>r.parent)),new Set(["users","documents","financial_records","finance_manual_evidence_links"]));
  const [slot]=await pool.query<mysql.RowDataPacket[]>("SELECT EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_manual_evidence_links' AND COLUMN_NAME='active_slot'");
  assert.match(String(slot[0].extra),/GENERATED/i);
  const [attemptRefs]=await pool.query<mysql.RowDataPacket[]>("SELECT REFERENCED_TABLE_NAME AS parent FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_receipt_attempts' AND REFERENCED_TABLE_NAME IS NOT NULL");
  assert.deepEqual(new Set(attemptRefs.map(r=>r.parent)),new Set(["payment_receipts","documents"]));
 } finally {await pool.end();}
});
