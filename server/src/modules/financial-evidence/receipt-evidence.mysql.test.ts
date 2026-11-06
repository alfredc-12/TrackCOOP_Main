import assert from "node:assert/strict";
import { createHash,randomBytes } from "node:crypto";
import test from "node:test";
import mysql from "mysql2/promise";
import { verifyExistingReceipt } from "./receipt-evidence.service";
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
  CREATE TABLE pos_sales(pos_sale_id BIGINT UNSIGNED PRIMARY KEY,payment_reference_id BIGINT UNSIGNED,sale_status VARCHAR(30),payment_status VARCHAR(30),total_amount DECIMAL(12,2));
  CREATE TABLE rental_bookings(rental_booking_id BIGINT UNSIGNED PRIMARY KEY,payment_reference_id BIGINT UNSIGNED,booking_status VARCHAR(30),payment_status VARCHAR(30));
  INSERT INTO payment_references VALUES(1,'Validated',10,2,'POS/Product','Cash','pos_sales',7);
  INSERT INTO payment_receipts VALUES(3,1,'Generated',10,2,NULL,4);
  INSERT INTO pos_sales VALUES(7,1,'Paid','Paid',10);`);
  const bytes=Buffer.from('%PDF-synthetic'),sha=createHash('sha256').update(bytes).digest('hex');
  await pool.execute("INSERT INTO documents VALUES(4,2,'Active','Member-only','Receipt',NULL,NULL,NULL,1,?,NULL,'public/uploads/receipts/synthetic.pdf')",[sha]);
  assert.equal((await verifyExistingReceipt('1',pool,async()=>bytes)).status,'invalid');
  await pool.execute("UPDATE documents SET related_module='Payment',related_record_id=1,relationship_type='Payment Receipt' WHERE document_id=4");
  assert.equal((await verifyExistingReceipt('1',pool,async()=>bytes)).status,'verified');
  await pool.execute("UPDATE pos_sales SET payment_reference_id=9 WHERE pos_sale_id=7");
  assert.equal((await verifyExistingReceipt('1',pool,async()=>bytes)).status,'invalid');
 }finally{await pool.end();}
});
