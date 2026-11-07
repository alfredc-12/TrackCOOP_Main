import assert from "node:assert/strict";
import { createHash,randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import mysql from "mysql2/promise";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { getPool } from "../../db/pool";
import { storageProvider } from "../../storage";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext } from "../auth/auth.types";
import { createRecordsRouter } from "../records/records.routes";
import { createManualEvidenceRepository } from "./manual-evidence.repository";
import { createEvidenceUploadIntentRepository } from "./evidence-upload-intent.repository";
import { createManualEvidenceWorkflow,type ManualEvidenceStore } from "./manual-evidence-workflow.service";
import { createManualEvidenceRouter } from "./manual-evidence.routes";

const enabled=process.env.EVIDENCE_ISOLATED_MYSQL==="1";
test("manual evidence upload, version-bound direct download, replacement and revocation",{skip:!enabled},async()=>{
 const port=Number(process.env.EVIDENCE_TEST_PORT),expected=process.env.EVIDENCE_TEST_DATADIR;
 if(!Number.isInteger(port)||port<1024||!expected||!expected.toLowerCase().includes("trackcoop-budget-1b-synthetic"))throw new Error("Explicit isolated server required");
 const admin=await mysql.createConnection({host:"127.0.0.1",port,user:"root",multipleStatements:true});
 const [server]=await admin.query<mysql.RowDataPacket[]>("SELECT @@datadir AS dataDir,@@port AS port");const norm=(s:string)=>s.replace(/\\/g,"/").replace(/\/$/,"").toLowerCase();
 if(Number(server[0].port)!==port||norm(String(server[0].dataDir))!==norm(expected)){await admin.end();throw new Error("Refusing non-isolated target");}
 const db=`trackcoop_workflow_test_${randomBytes(4).toString("hex")}`;await admin.query(`CREATE DATABASE \`${db}\``);await admin.end();
 const pool=mysql.createPool({host:"127.0.0.1",port,user:"root",database:db,multipleStatements:true,connectionLimit:6});
 try {
  await pool.query(`CREATE TABLE users(user_id BIGINT UNSIGNED PRIMARY KEY,display_name VARCHAR(100));
   CREATE TABLE financial_records(financial_record_id BIGINT UNSIGNED PRIMARY KEY,recorded_by BIGINT UNSIGNED,record_type VARCHAR(20),source_module VARCHAR(40),source_record_id BIGINT UNSIGNED NULL,payment_reference_id BIGINT UNSIGNED NULL,member_id BIGINT UNSIGNED NULL,approved_by BIGINT UNSIGNED NULL,record_status VARCHAR(20),amount DECIMAL(12,2),financial_category_id BIGINT UNSIGNED,record_date DATE,season_id BIGINT UNSIGNED NULL,remarks TEXT);
   CREATE TABLE documents(document_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,document_reference VARCHAR(60) NULL,uploaded_by BIGINT UNSIGNED,member_id BIGINT UNSIGNED NULL,title VARCHAR(255),description TEXT,category VARCHAR(80) NULL,document_type VARCHAR(40),access_level VARCHAR(40),document_status VARCHAR(20),file_path VARCHAR(500),original_file_name VARCHAR(255),mime_type VARCHAR(120),file_size_bytes BIGINT UNSIGNED,checksum_sha256 CHAR(64),related_module VARCHAR(80),related_record_id BIGINT UNSIGNED,related_record_reference VARCHAR(120),relationship_type VARCHAR(80),current_version INT UNSIGNED DEFAULT 1,expiration_date DATE NULL,uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
   CREATE TABLE audit_logs(id BIGINT AUTO_INCREMENT PRIMARY KEY,user_id BIGINT UNSIGNED,action VARCHAR(100),entity_table VARCHAR(100),record_id BIGINT UNSIGNED,description TEXT,old_values JSON NULL,new_values JSON NULL,ip_address VARCHAR(45) NULL,user_agent VARCHAR(500) NULL,action_time DATETIME DEFAULT CURRENT_TIMESTAMP);
   CREATE TABLE document_access_logs(id BIGINT AUTO_INCREMENT PRIMARY KEY,document_id BIGINT UNSIGNED,user_id BIGINT UNSIGNED,access_action VARCHAR(30),ip_address VARCHAR(45),user_agent VARCHAR(500));
   CREATE TABLE member_profiles(member_id BIGINT UNSIGNED PRIMARY KEY,user_id BIGINT UNSIGNED);
   INSERT INTO users VALUES(1,'Maker'),(2,'Other'),(3,'Chair'),(4,'Member'),(5,'Associate');
   INSERT INTO financial_records VALUES(10,1,'Expense','Manual',NULL,NULL,NULL,NULL,'Active',10.00,1,'2026-11-01',NULL,'Synthetic'),(11,1,'Expense','Manual',NULL,NULL,NULL,NULL,'Active',5.00,1,'2026-11-01',NULL,'Synthetic'),(12,1,'Expense','Manual',NULL,NULL,NULL,NULL,'Active',6.00,1,'2026-11-01',NULL,'Synthetic'),(13,1,'Expense','Manual',NULL,NULL,NULL,NULL,'Active',7.00,1,'2026-11-01',NULL,'Synthetic'),(14,1,'Expense','Manual',NULL,NULL,NULL,NULL,'Active',8.00,1,'2026-11-01',NULL,'Synthetic'),(15,1,'Expense','Manual',NULL,NULL,NULL,NULL,'Active',9.00,1,'2026-11-01',NULL,'Synthetic'),(16,1,'Expense','Manual',NULL,NULL,NULL,NULL,'Active',9.00,1,'2026-11-01',NULL,'Synthetic'),(17,1,'Expense','Manual',NULL,NULL,NULL,NULL,'Active',9.00,1,'2026-11-01',NULL,'Synthetic'),(18,1,'Expense','Manual',NULL,NULL,NULL,NULL,'Active',9.00,1,'2026-11-01',NULL,'Synthetic');`);
  for(const migration of ["20261107_manual_finance_evidence_links.sql","20261107_financial_evidence_upload_intents.sql","20261107_financial_evidence_object_binding.sql"])await pool.query(await readFile(`server/database/migrations/${migration}`,"utf8"));
  const objects=new Map<string,{bytes:Buffer;version:string;mime:string}>();let verifiedPrepared=false,failAfterUpload=false,failBeforeUpload=false,failRead=false,mutateSource=false,pauseRead=false,pauseFinalCheck=false,pauseFence=false;
  let notifyRead!:()=>void,resumeRead!:()=>void;const reading=new Promise<void>(resolve=>{notifyRead=resolve;}),readGate=new Promise<void>(resolve=>{resumeRead=resolve;});
  let notifyFinal!:()=>void,resumeFinal!:()=>void;const finalReading=new Promise<void>(resolve=>{notifyFinal=resolve;}),finalGate=new Promise<void>(resolve=>{resumeFinal=resolve;});
  let notifyFence!:()=>void,resumeFence!:()=>void;const fenceReading=new Promise<void>(resolve=>{notifyFence=resolve;}),fenceGate=new Promise<void>(resolve=>{resumeFence=resolve;});
  const store:ManualEvidenceStore={
   async writeLockedEvidenceVersion(bytes,mime,reservedKey){
    const [intents]=await pool.execute<mysql.RowDataPacket[]>("SELECT i.intent_state,(SELECT COUNT(*) FROM finance_evidence_upload_events e WHERE e.intent_id=i.intent_id AND e.event_type='PREPARED') AS prepared FROM finance_evidence_upload_intents i WHERE i.object_key=?",[reservedKey]);verifiedPrepared=intents[0]?.intent_state==="UPLOADING" && Number(intents[0]?.prepared)===1;
    if(failBeforeUpload)throw new Error("synthetic upload failure");
    if(objects.has(reservedKey))throw new Error("already exists");const version="synthetic-v1";objects.set(reservedKey,{bytes:Buffer.from(bytes),version,mime});
    if(failAfterUpload)await pool.query("RENAME TABLE audit_logs TO unavailable_audit_logs");
    if(mutateSource)await pool.execute("UPDATE financial_records SET amount=10 WHERE financial_record_id=16");
    return {bucket:"synthetic",key:reservedKey,versionId:version,sha256:createHash("sha256").update(bytes).digest("hex"),size:bytes.length,contentType:mime};
   },
   async readLockedEvidenceVersion(object){if(failRead)throw new Error("synthetic verify failure");if(pauseFence){pauseFence=false;notifyFence();await fenceGate;}if(pauseFinalCheck){pauseFinalCheck=false;notifyFinal();await finalGate;}if(pauseRead){pauseRead=false;notifyRead();await readGate;}const item=objects.get(object.key);if(!item || item.version!==object.versionId || item.mime!==object.contentType || item.bytes.length!==object.size || createHash("sha256").update(item.bytes).digest("hex")!==object.sha256)throw new Error("unavailable");return Buffer.from(item.bytes);},
  };
  const database=getPool(),originalQuery=database.query,originalGetConnection=database.getConnection;
  Object.assign(database,{query:pool.query.bind(pool),getConnection:pool.getConnection.bind(pool)});
  const provider=storageProvider() as unknown as Record<string,unknown>,oldReader=provider.readLockedEvidenceVersion;
  provider.readLockedEvidenceVersion=store.readLockedEvidenceVersion;
  const auth={authenticate:async(token:string)=>{const actor=({maker:{id:"1",role:"bookkeeper"},other:{id:"2",role:"bookkeeper"},chair:{id:"3",role:"chairman"},member:{id:"4",role:"member"},associate:{id:"5",role:"member"}} as const)[token as "maker"|"other"|"chair"|"member"|"associate"];if(!actor)throw new Error("unauthenticated");return {user:{...actor,displayName:"Synthetic",username:null,email:"synthetic@example.test"},sessionId:"1",tokenHash:"fixture"} as AuthContext;}} as unknown as AuthService;
  const app=express().use(cookieParser()).use(express.json()).use("/api",createManualEvidenceRouter(auth,createManualEvidenceWorkflow(pool,store),createManualEvidenceRepository(pool))).use("/api",createRecordsRouter(auth)).use(errorHandler);
  const cookie=(name:string)=>`trackcoop_session=${name}`;const bytes=Buffer.from("%PDF-synthetic-first"),replacement=Buffer.from("%PDF-synthetic-second");
  try {
   assert.equal((await request(app).post("/api/finance/manual-expenses/10/evidence").set("Cookie",cookie("other")).field("requestKey","a".repeat(64)).attach("file",bytes,"receipt.pdf")).status,404);
   const first=await request(app).post("/api/finance/manual-expenses/10/evidence").set("Cookie",cookie("maker")).field("requestKey","a".repeat(64)).attach("file",bytes,"receipt.pdf");
   assert.equal(first.status,201,JSON.stringify(first.body));assert.equal(verifiedPrepared,true);const doc=String(first.body.data.documentId);
   const direct=await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("maker"));assert.equal(direct.status,200);assert.deepEqual(direct.body,bytes);
   assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`)).status,404);
   assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("member"))).status,404);
   assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("associate"))).status,404);
   assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("other"))).status,404);
   assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("chair"))).status,200);
   await pool.execute("UPDATE finance_evidence_upload_intents SET object_version='wrong' WHERE document_id=?",[doc]);
   assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("maker"))).status,404);
   await pool.execute("UPDATE finance_evidence_upload_intents SET object_version='synthetic-v1' WHERE document_id=?",[doc]);
   await pool.execute("UPDATE financial_records SET amount=11 WHERE financial_record_id=10");
   assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("maker"))).status,404);
   assert.equal((await request(app).post("/api/finance/manual-expenses/10/evidence").set("Cookie",cookie("maker")).field("requestKey","a".repeat(64)).attach("file",bytes,"receipt.pdf")).status,409);
   await pool.execute("UPDATE financial_records SET amount=10 WHERE financial_record_id=10");
   await pool.execute("UPDATE documents SET related_record_id=11 WHERE document_id=?",[doc]);
   assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("maker"))).status,404);
   await pool.execute("UPDATE documents SET related_record_id=10 WHERE document_id=?",[doc]);
   await pool.execute("UPDATE documents SET category='OTHER' WHERE document_id=?",[doc]);assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("maker"))).status,404);
   await pool.execute("UPDATE documents SET category='FINANCIAL' WHERE document_id=?",[doc]);
   const [identity]=await pool.execute<mysql.RowDataPacket[]>("SELECT object_key AS objectKey FROM finance_evidence_upload_intents WHERE document_id=?",[doc]);
   const saved=objects.get(String(identity[0].objectKey))!;objects.set(String(identity[0].objectKey),{...saved,bytes:Buffer.from("tampered")});
   assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("maker"))).status,404);
   objects.set(String(identity[0].objectKey),{...saved,version:"wrong"});assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("maker"))).status,404);
   objects.delete(String(identity[0].objectKey));assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("maker"))).status,404);
   objects.set(String(identity[0].objectKey),saved);
   const replay=await request(app).post("/api/finance/manual-expenses/10/evidence").set("Cookie",cookie("maker")).field("requestKey","a".repeat(64)).attach("file",bytes,"receipt.pdf");assert.equal(String(replay.body.data.documentId),doc);assert.equal(objects.size,1);
   const links=await request(app).get("/api/finance/manual-expenses/10/evidence").set("Cookie",cookie("maker"));const link=links.body.data[0];
   const verified=await request(app).get(`/api/finance/manual-expenses/10/evidence/${doc}/verify`).set("Cookie",cookie("maker"));
   assert.equal(verified.status,200);assert.equal(verified.body.data.status,"VERSION_BYTES_MATCH");assert.equal(verified.body.data.financialPostingVerified,false);
   assert.equal((await request(app).get(`/api/finance/manual-expenses/10/evidence/${doc}/verify`).set("Cookie",cookie("other"))).status,404);
   pauseRead=true;const inFlight=request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("maker")).then(value=>value);await reading;
   let replacementDone=false;const replacing=request(app).post("/api/finance/manual-expenses/10/evidence").set("Cookie",cookie("maker")).field("requestKey","b".repeat(64)).field("replaceLinkId",String(link.id)).field("expectedVersion","1").field("reason","New receipt").attach("file",replacement,"receipt.pdf").then(value=>{replacementDone=true;return value;});
   try {await new Promise(resolve=>setTimeout(resolve,3000));assert.equal(replacementDone,true,"replacement must complete while remote read is paused");} finally {resumeRead();}
   assert.equal((await inFlight).status,404,"stale bytes are not returned after replacement");const replaced=await replacing;assert.equal(replaced.status,201,JSON.stringify(replaced.body));
   assert.equal(objects.size,2);assert.equal((await request(app).get(`/api/documents/${doc}/file?action=download`).set("Cookie",cookie("maker"))).status,404);
   const newDoc=String(replaced.body.data.documentId);assert.deepEqual((await request(app).get(`/api/documents/${newDoc}/file?action=download`).set("Cookie",cookie("maker"))).body,replacement);
   const active=(await request(app).get("/api/finance/manual-expenses/10/evidence").set("Cookie",cookie("maker"))).body.data.find((x:{status:string})=>x.status==="ACTIVE");
   assert.equal((await request(app).post(`/api/finance/manual-expenses/10/evidence/${active.id}/revoke`).set("Cookie",cookie("maker")).send({version:1,reason:"Invalid",requestKey:"c".repeat(64)})).status,200);
   assert.equal((await request(app).get(`/api/documents/${newDoc}/file?action=download`).set("Cookie",cookie("maker"))).status,404);
   assert.equal((await request(app).get(`/api/finance/manual-expenses/10/evidence/${newDoc}/verify`).set("Cookie",cookie("maker"))).status,404);
   const history=await request(app).get("/api/finance/manual-expenses/10/evidence/history").set("Cookie",cookie("chair"));assert.equal(history.status,200);assert.deepEqual(history.body.data.map((event:{eventType:string})=>event.eventType),["LINKED","REPLACED","REVOKED"]);
   const [audits]=await pool.query<mysql.RowDataPacket[]>("SELECT action FROM audit_logs WHERE action IN ('financial_evidence.finalized','financial_evidence.download')");assert.ok(audits.length>=4);
   failAfterUpload=true;
   try {assert.notEqual((await request(app).post("/api/finance/manual-expenses/11/evidence").set("Cookie",cookie("maker")).field("requestKey","d".repeat(64)).attach("file",bytes,"receipt.pdf")).status,201);}
   finally {await pool.query("RENAME TABLE unavailable_audit_logs TO audit_logs");}
   const [pending]=await pool.execute<mysql.RowDataPacket[]>("SELECT intent_state,document_id,object_version FROM finance_evidence_upload_intents WHERE request_key=?",["d".repeat(64)]);
   assert.equal(pending[0].intent_state,"UPLOADING");assert.equal(pending[0].document_id,null);assert.equal(pending[0].object_version,null);assert.equal(objects.size,3);
   failAfterUpload=false;
   const competing=await Promise.all(["e","f"].map(k=>request(app).post("/api/finance/manual-expenses/12/evidence").set("Cookie",cookie("maker")).field("requestKey",k.repeat(64)).attach("file",bytes,"receipt.pdf").then(value=>value)));
   assert.equal(competing.filter(r=>r.status===201).length,1);assert.equal(competing.filter(r=>r.status===409).length,1);
   const [activeRows]=await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS n FROM finance_manual_evidence_links WHERE financial_record_id=12 AND link_status='ACTIVE'");assert.equal(activeRows[0].n,1);
   failBeforeUpload=true;
   assert.equal((await request(app).post("/api/finance/manual-expenses/13/evidence").set("Cookie",cookie("maker")).field("requestKey","1".repeat(64)).attach("file",bytes,"receipt.pdf")).status,503);
   const [failedUpload]=await pool.execute<mysql.RowDataPacket[]>("SELECT intent_state,document_id FROM finance_evidence_upload_intents WHERE request_key=?",["1".repeat(64)]);assert.equal(failedUpload[0].intent_state,"RECOVERY_REQUIRED");assert.equal(failedUpload[0].document_id,null);
   failBeforeUpload=false;const objectsBefore=objects.size;
   const duplicates=await Promise.all([1,2].map(()=>request(app).post("/api/finance/manual-expenses/14/evidence").set("Cookie",cookie("maker")).field("requestKey","2".repeat(64)).attach("file",bytes,"receipt.pdf").then(value=>value)));
   assert.ok(duplicates.some(r=>r.status===201));assert.ok(duplicates.every(r=>[201,409].includes(r.status)));assert.equal(objects.size,objectsBefore+1);
   const [duplicateLinks]=await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS n FROM finance_manual_evidence_links WHERE financial_record_id=14 AND link_status='ACTIVE'");assert.equal(duplicateLinks[0].n,1);
   failRead=true;assert.equal((await request(app).post("/api/finance/manual-expenses/15/evidence").set("Cookie",cookie("maker")).field("requestKey","3".repeat(64)).attach("file",bytes,"receipt.pdf")).status,503);failRead=false;
   const [verificationFailure]=await pool.execute<mysql.RowDataPacket[]>("SELECT intent_state,document_id FROM finance_evidence_upload_intents WHERE request_key=?",["3".repeat(64)]);assert.equal(verificationFailure[0].intent_state,"RECOVERY_REQUIRED");assert.equal(verificationFailure[0].document_id,null);
   mutateSource=true;assert.equal((await request(app).post("/api/finance/manual-expenses/16/evidence").set("Cookie",cookie("maker")).field("requestKey","4".repeat(64)).attach("file",bytes,"receipt.pdf")).status,409);mutateSource=false;
   const [sourceFailure]=await pool.execute<mysql.RowDataPacket[]>("SELECT intent_state,document_id FROM finance_evidence_upload_intents WHERE request_key=?",["4".repeat(64)]);assert.equal(sourceFailure[0].intent_state,"RECOVERY_REQUIRED");assert.equal(sourceFailure[0].document_id,null);
   pauseFinalCheck=true;const delayed=request(app).post("/api/finance/manual-expenses/17/evidence").set("Cookie",cookie("maker")).field("requestKey","5".repeat(64)).attach("file",bytes,"receipt.pdf").then(value=>value);await finalReading;
   try {
    const connection=await pool.getConnection();try {await connection.query("SET innodb_lock_wait_timeout=1");await connection.execute("UPDATE financial_records SET amount=11 WHERE financial_record_id=17");} finally {connection.release();}
   } finally {resumeFinal();}
   assert.equal((await delayed).status,409,"changed source is rejected after external read without holding source lock");
   pauseFence=true;const stale=request(app).post("/api/finance/manual-expenses/18/evidence").set("Cookie",cookie("maker")).field("requestKey","6".repeat(64)).attach("file",bytes,"receipt.pdf").then(value=>value);await fenceReading;
   const [fenceRows]=await pool.execute<mysql.RowDataPacket[]>("SELECT CAST(intent_id AS CHAR) AS id,generation FROM finance_evidence_upload_intents WHERE request_key=?",["6".repeat(64)]);
   try {await createEvidenceUploadIntentRepository(pool).requireRecovery(String(fenceRows[0].id),Number(fenceRows[0].generation),{user:{id:"1",role:"bookkeeper"}} as AuthContext);} finally {resumeFence();}
   assert.equal((await stale).status,409,"fenced upload cannot finalize after recovery transition");
   const [fenced]=await pool.execute<mysql.RowDataPacket[]>("SELECT intent_state,document_id FROM finance_evidence_upload_intents WHERE request_key=?",["6".repeat(64)]);assert.equal(fenced[0].intent_state,"RECOVERY_REQUIRED");assert.equal(fenced[0].document_id,null);
  } finally {Object.assign(database,{query:originalQuery,getConnection:originalGetConnection});if(oldReader===undefined)delete provider.readLockedEvidenceVersion;else provider.readLockedEvidenceVersion=oldReader;}
 } finally {await pool.end();}
});
