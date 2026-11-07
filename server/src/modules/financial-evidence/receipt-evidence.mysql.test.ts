import assert from "node:assert/strict";
import { createHash,randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import mysql from "mysql2/promise";
import { verifyExistingReceipt } from "./receipt-evidence.service";
import { createPaymentReceiptService, queuePaymentReceipt } from "../paymongo/paymongo.settlement.receipt";
import { storageProvider } from "../../storage";
import type { PutObjectInput } from "../../storage/storage-provider";
import { protectedObjectKey } from "../../storage/protected-storage";
const enabled=process.env.EVIDENCE_ISOLATED_MYSQL==="1";
test("isolated MySQL reads only the source-linked receipt and rejects missing source metadata",{skip:!enabled},async()=>{
 const port=Number(process.env.EVIDENCE_TEST_PORT),expected=process.env.EVIDENCE_TEST_DATADIR;
 if(!Number.isInteger(port)||port<1024||!expected||!expected.toLowerCase().includes("trackcoop-budget-1b-synthetic"))throw new Error("Explicit isolated server required");
 const admin=await mysql.createConnection({host:"127.0.0.1",port,user:"root",multipleStatements:true});
 const [identity]=await admin.query<mysql.RowDataPacket[]>("SELECT @@datadir AS dataDir,@@port AS port");const norm=(s:string)=>s.replace(/\\/g,"/").replace(/\/$/,"").toLowerCase();
 if(Number(identity[0].port)!==port||norm(String(identity[0].dataDir))!==norm(expected)){await admin.end();throw new Error("Refusing non-isolated target");}
 const name=`trackcoop_evidence_test_${randomBytes(4).toString("hex")}`;await admin.query(`CREATE DATABASE \`${name}\``);await admin.end();
 const pool=mysql.createPool({host:"127.0.0.1",port,user:"root",database:name,multipleStatements:true});
 try{
  await pool.query(`CREATE TABLE payment_references(payment_reference_id BIGINT UNSIGNED PRIMARY KEY,validation_status VARCHAR(30),amount DECIMAL(12,2),member_id BIGINT UNSIGNED,payment_purpose VARCHAR(30),payment_channel VARCHAR(30),related_entity_type VARCHAR(30),related_entity_id BIGINT UNSIGNED);
  CREATE TABLE payment_receipts(payment_receipt_id BIGINT UNSIGNED PRIMARY KEY,payment_reference_id BIGINT UNSIGNED,processing_status VARCHAR(20),amount DECIMAL(12,2),member_id BIGINT UNSIGNED,reversed_at DATETIME NULL,document_id BIGINT UNSIGNED);
  CREATE TABLE documents(document_id BIGINT UNSIGNED PRIMARY KEY,member_id BIGINT UNSIGNED,document_status VARCHAR(20),access_level VARCHAR(30),document_type VARCHAR(30),related_module VARCHAR(30) NULL,related_record_id BIGINT UNSIGNED NULL,relationship_type VARCHAR(40) NULL,current_version INT,checksum_sha256 CHAR(64),expiration_date DATE NULL,file_path VARCHAR(500));
  CREATE TABLE pos_sales(pos_sale_id BIGINT UNSIGNED PRIMARY KEY,payment_reference_id BIGINT UNSIGNED,sale_status VARCHAR(30),payment_status VARCHAR(30),total_amount DECIMAL(12,2),member_id BIGINT UNSIGNED);
  CREATE TABLE rental_bookings(rental_booking_id BIGINT UNSIGNED PRIMARY KEY,payment_reference_id BIGINT UNSIGNED,booking_status VARCHAR(30),payment_status VARCHAR(30));
  INSERT INTO payment_references VALUES(1,'Validated',10,2,'POS/Product','Cash','pos_sales',7);
  INSERT INTO payment_receipts VALUES(3,1,'Generated',10,2,NULL,4);
  INSERT INTO pos_sales VALUES(7,1,'Paid','Paid',10,2);`);
  const bytes=Buffer.from('%PDF-synthetic'),sha=createHash('sha256').update(bytes).digest('hex');
  await pool.execute("INSERT INTO documents VALUES(4,2,'Active','Member-only','Receipt',NULL,NULL,NULL,1,?,NULL,'public/uploads/receipts/synthetic.pdf')",[sha]);
  assert.equal((await verifyExistingReceipt('1',pool,async()=>bytes)).status,'invalid');
  await pool.execute("UPDATE documents SET related_module='Payment',related_record_id=1,relationship_type='Payment Receipt' WHERE document_id=4");
  assert.equal((await verifyExistingReceipt('1',pool,async()=>bytes)).status,'observed_match');
  await pool.execute("UPDATE pos_sales SET payment_reference_id=9 WHERE pos_sale_id=7");
  assert.equal((await verifyExistingReceipt('1',pool,async()=>bytes)).status,'invalid');
 }finally{await pool.end();}
});

test("disposable MySQL: receipt producer persists source metadata and retry reuses its document",{skip:!enabled},async(t)=>{
 const port=Number(process.env.EVIDENCE_TEST_PORT), expected=process.env.EVIDENCE_TEST_DATADIR;
 if(!Number.isInteger(port)||port<1024||!expected||!expected.toLowerCase().includes("trackcoop-budget-1b-synthetic"))throw new Error("Explicit isolated server required");
 const admin=await mysql.createConnection({host:"127.0.0.1",port,user:"root",multipleStatements:true});
 const [identity]=await admin.query<mysql.RowDataPacket[]>("SELECT @@datadir AS dataDir,@@port AS port");
 const norm=(s:string)=>s.replace(/\\/g,"/").replace(/\/$/,"").toLowerCase();
 if(Number(identity[0].port)!==port||norm(String(identity[0].dataDir))!==norm(expected)){await admin.end();throw new Error("Refusing non-isolated target");}
 const name=`trackcoop_evidence_producer_test_${randomBytes(4).toString("hex")}`;
 await admin.query(`CREATE DATABASE \`${name}\``);await admin.end();
 const pool=mysql.createPool({host:"127.0.0.1",port,user:"root",database:name,multipleStatements:true,timezone:"Z"});
 try {
  await pool.query(`CREATE TABLE payment_references(payment_reference_id BIGINT UNSIGNED PRIMARY KEY,validation_status VARCHAR(30),amount DECIMAL(12,2),member_id BIGINT UNSIGNED,payment_purpose VARCHAR(50),payment_channel VARCHAR(30),related_entity_type VARCHAR(80),related_entity_id BIGINT UNSIGNED,payer_name VARCHAR(190),payer_email VARCHAR(190),reference_number VARCHAR(190));
   CREATE TABLE payment_receipts(payment_receipt_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,payment_reference_id BIGINT UNSIGNED UNIQUE,receipt_number VARCHAR(80),processing_status VARCHAR(20),amount DECIMAL(12,2),member_id BIGINT UNSIGNED,reversed_at DATETIME NULL,reversal_note VARCHAR(1000),document_id BIGINT UNSIGNED,attempt_count INT DEFAULT 0,last_attempt_at DATETIME,last_error_code VARCHAR(120),last_error_message VARCHAR(1000),issued_by BIGINT UNSIGNED,payment_channel VARCHAR(40),provider VARCHAR(100),validation_source VARCHAR(40),subject_reference VARCHAR(120),payment_date DATE,validated_at DATETIME,issued_at DATETIME,generated_at DATETIME);
   CREATE TABLE documents(document_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,uploaded_by BIGINT UNSIGNED,member_id BIGINT UNSIGNED,title VARCHAR(255),document_type VARCHAR(50),access_level VARCHAR(50),document_status VARCHAR(30),file_path VARCHAR(500),original_file_name VARCHAR(255),mime_type VARCHAR(120),file_size_bytes BIGINT,checksum_sha256 CHAR(64),description TEXT,related_module VARCHAR(80),related_record_id BIGINT UNSIGNED,related_record_reference VARCHAR(120),relationship_type VARCHAR(80),current_version INT DEFAULT 1,expiration_date DATE);
   CREATE TABLE audit_logs(audit_log_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,user_id BIGINT UNSIGNED,action VARCHAR(100),entity_table VARCHAR(100),record_id BIGINT UNSIGNED,description TEXT,new_values JSON);
   CREATE TABLE pos_sales(pos_sale_id BIGINT UNSIGNED PRIMARY KEY,payment_reference_id BIGINT UNSIGNED,sale_status VARCHAR(30),payment_status VARCHAR(30),total_amount DECIMAL(12,2),member_id BIGINT UNSIGNED);
   CREATE TABLE rental_bookings(rental_booking_id BIGINT UNSIGNED PRIMARY KEY,payment_reference_id BIGINT UNSIGNED,booking_status VARCHAR(30),payment_status VARCHAR(30));
   INSERT INTO payment_references VALUES(1,'Validated',10.00,2,'Rental','Cash','rental_bookings',7,'Synthetic',NULL,'SYNTHETIC-1');
   INSERT INTO rental_bookings VALUES(7,1,'Approved','Paid');`);
  await pool.query(await readFile("server/database/migrations/20261107_receipt_attempt_recovery.sql","utf8"));
  const connection=await pool.getConnection();
  try { await connection.beginTransaction();await queuePaymentReceipt(connection,{paymentReferenceId:"1",memberId:"2",actorUserId:"3",amount:10,paymentChannel:"Cash",provider:"Manual",validationSource:"Manual Bookkeeper",subjectReference:"SYNTHETIC",paymentDate:new Date("2026-11-06T00:00:00Z"),validatedAt:new Date("2026-11-06T00:00:00Z")});await connection.commit(); } finally {connection.release();}
  const service=createPaymentReceiptService(pool);
  await Promise.all(Array.from({length:8},()=>service.process("1")));
  const first=await service.getStatus("1");
  assert.equal(first?.processingStatus,"Generated");assert.ok(first?.documentId);
  const [docs]=await pool.query<mysql.RowDataPacket[]>("SELECT related_module,related_record_id,related_record_reference,relationship_type,member_id,file_path,checksum_sha256 FROM documents");
  assert.equal(docs.length,1);assert.equal(docs[0].related_module,"Payment");assert.equal(String(docs[0].related_record_id),"1");assert.equal(docs[0].related_record_reference,"SYNTHETIC-1");assert.equal(docs[0].relationship_type,"Payment Receipt");assert.equal(String(docs[0].member_id),"2");
  const read=async()=>storageProvider().get({key:protectedObjectKey(String(docs[0].file_path)),visibility:"protected"});
  assert.equal(createHash("sha256").update(await read()).digest("hex"),docs[0].checksum_sha256,"concurrent workers must not overwrite linked receipt bytes");
  assert.equal((await verifyExistingReceipt("1",pool,read)).status,"unsupported");
  assert.equal((await service.process("1"))?.documentId,first?.documentId);
  const [counts]=await pool.query<mysql.RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM documents) AS docs,(SELECT COUNT(*) FROM audit_logs WHERE action='document.module_linked') AS audits");
  assert.equal(counts[0].docs,1);assert.equal(counts[0].audits,1);
  const [attempts1]=await pool.query<mysql.RowDataPacket[]>("SELECT attempt_state AS state,COUNT(*) AS count FROM payment_receipt_attempts GROUP BY attempt_state");
  assert.equal(Number(attempts1.find(a=>a.state==="FINALIZED")?.count),1);
  assert.ok(attempts1.reduce((total,a)=>total+Number(a.count),0)>=1);
  await pool.execute("UPDATE documents SET related_record_id=NULL WHERE document_id=?",[first?.documentId]);
  assert.equal((await verifyExistingReceipt("1",pool,read)).status,"unsupported");
  await pool.query("INSERT INTO payment_references VALUES(3,'Validated',6.00,2,'Rental','Cash','rental_bookings',9,'Synthetic',NULL,'SYNTHETIC-3'); INSERT INTO rental_bookings VALUES(9,3,'Approved','Paid')");
  const third=await pool.getConnection();
  try {await third.beginTransaction();await queuePaymentReceipt(third,{paymentReferenceId:"3",memberId:"2",actorUserId:"3",amount:6,paymentChannel:"Cash",provider:"Manual",validationSource:"Manual Bookkeeper",subjectReference:"SYNTHETIC",paymentDate:null,validatedAt:null});await third.commit();} finally {third.release();}
  const provider=storageProvider(),originalPut=provider.put.bind(provider);let started!:()=>void,release!:()=>void;
  const firstStarted=new Promise<void>(resolve=>{started=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});let attempts=0;
  const put=t.mock.method(provider,"put",async (input:PutObjectInput)=>{if(++attempts===1){started();await gate;throw new Error("synthetic late storage failure");}return originalPut(input);});
  const slow=service.process("3");await firstStarted;try {await service.process("3");} finally {release();}await slow;put.mock.restore();
  assert.equal((await service.getStatus("3"))?.processingStatus,"Generated","late failure must not regress a generated receipt");
  await pool.query("INSERT INTO payment_references VALUES(4,'Validated',7.00,2,'Rental','Cash','rental_bookings',10,'Synthetic',NULL,'SYNTHETIC-4'); INSERT INTO rental_bookings VALUES(10,4,'Approved','Paid')");
  const fourth=await pool.getConnection();
  try {await fourth.beginTransaction();await queuePaymentReceipt(fourth,{paymentReferenceId:"4",memberId:"2",actorUserId:"3",amount:7,paymentChannel:"Cash",provider:"Manual",validationSource:"Manual Bookkeeper",subjectReference:"SYNTHETIC",paymentDate:null,validatedAt:null});await fourth.commit();} finally {fourth.release();}
  let startA!:()=>void,startB!:()=>void,finishA!:()=>void,finishB!:()=>void;
  const aStarted=new Promise<void>(resolve=>{startA=resolve;}),bStarted=new Promise<void>(resolve=>{startB=resolve;});
  const gateA=new Promise<void>(resolve=>{finishA=resolve;}),gateB=new Promise<void>(resolve=>{finishB=resolve;});let worker=0;
  const overlapping=t.mock.method(provider,"put",async (input:PutObjectInput)=>{if(++worker===1){startA();await gateA;throw new Error("synthetic stale failure");}startB();await gateB;return originalPut(input);});
  const workerA=service.process("4");await aStarted;const workerB=service.process("4");await bStarted;
  finishA();await workerA;
  try {const during=await service.getStatus("4");assert.equal(during?.processingStatus,"Processing");assert.equal(during?.attemptCount,2);} finally {finishB();}
  await workerB;overlapping.mock.restore();assert.equal((await service.getStatus("4"))?.processingStatus,"Generated");
  const [states4]=await pool.query<mysql.RowDataPacket[]>("SELECT a.attempt_number AS n,a.attempt_state AS state FROM payment_receipt_attempts a JOIN payment_receipts r ON r.payment_receipt_id=a.payment_receipt_id WHERE r.payment_reference_id=4 ORDER BY a.attempt_number");
  assert.deepEqual(states4.map(a=>a.state),["FAILED","FINALIZED"]);
  const [events4]=await pool.query<mysql.RowDataPacket[]>("SELECT a.attempt_number AS n,e.event_type AS event FROM payment_receipt_attempt_events e JOIN payment_receipt_attempts a ON a.attempt_id=e.attempt_id JOIN payment_receipts r ON r.payment_receipt_id=a.payment_receipt_id WHERE r.payment_reference_id=4 ORDER BY a.attempt_number,e.event_id");
  assert.deepEqual(events4.map(e=>`${e.n}:${e.event}`),["1:PREPARED","1:FAILED","2:PREPARED","2:STORED","2:FINALIZED"]);
  await pool.query("INSERT INTO payment_references VALUES(5,'Validated',8.00,2,'Rental','Cash','rental_bookings',11,'Synthetic',NULL,'SYNTHETIC-5'); INSERT INTO rental_bookings VALUES(11,5,'Approved','Paid')");
  const fifth=await pool.getConnection();
  try {await fifth.beginTransaction();await queuePaymentReceipt(fifth,{paymentReferenceId:"5",memberId:"2",actorUserId:"3",amount:8,paymentChannel:"Cash",provider:"Manual",validationSource:"Manual Bookkeeper",subjectReference:"SYNTHETIC",paymentDate:null,validatedAt:null});await fifth.commit();} finally {fifth.release();}
  let stalled!:()=>void,resume!:()=>void,call=0;const stalledStarted=new Promise<void>(r=>{stalled=r;}),stalledGate=new Promise<void>(r=>{resume=r;});
  const stalledPut=t.mock.method(provider,"put",async (input:PutObjectInput)=>{if(++call===1){stalled();await stalledGate;}return originalPut(input);});
  const abandoned=service.process("5");await stalledStarted;
  try {
   await service.process("5");
   const [pending]=await pool.query<mysql.RowDataPacket[]>("SELECT a.attempt_state AS state FROM payment_receipt_attempts a JOIN payment_receipts r ON r.payment_receipt_id=a.payment_receipt_id WHERE r.payment_reference_id=5 ORDER BY a.attempt_number");
   assert.deepEqual(pending.map(p=>p.state),["PREPARED","FINALIZED"],"interrupted attempt remains journaled without deleting its object");
  } finally {resume();}
  await abandoned;stalledPut.mock.restore();
  const [recovered]=await pool.query<mysql.RowDataPacket[]>("SELECT a.attempt_state AS state FROM payment_receipt_attempts a JOIN payment_receipts r ON r.payment_receipt_id=a.payment_receipt_id WHERE r.payment_reference_id=5 ORDER BY a.attempt_number");
  assert.deepEqual(recovered.map(p=>p.state),["SUPERSEDED","FINALIZED"]);
  await pool.query("INSERT INTO payment_references VALUES(2,'Validated',5.00,2,'Rental','Cash','rental_bookings',8,'Synthetic',NULL,'SYNTHETIC-2'); INSERT INTO rental_bookings VALUES(8,2,'Approved','Paid')");
  const second=await pool.getConnection();
  try {await second.beginTransaction();await queuePaymentReceipt(second,{paymentReferenceId:"2",memberId:"2",actorUserId:"3",amount:5,paymentChannel:"Cash",provider:"Manual",validationSource:"Manual Bookkeeper",subjectReference:"SYNTHETIC",paymentDate:null,validatedAt:null});await second.commit();} finally {second.release();}
  // Simulate an unavailable audit sink. The document insert and receipt link must roll back together.
  await pool.query("RENAME TABLE audit_logs TO unavailable_audit_logs");
  assert.equal((await service.process("2"))?.processingStatus,"Failed");
  const [afterFailure]=await pool.query<mysql.RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM documents) AS docs,(SELECT document_id FROM payment_receipts WHERE payment_reference_id=2) AS linkedDocument");
  assert.equal(afterFailure[0].docs,4);assert.equal(afterFailure[0].linkedDocument,null);
 } finally {await pool.end();}
});
