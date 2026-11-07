import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import type { Pool,RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { env } from "../../config/env";
import { normalizeObjectKey } from "../../storage/storage-paths";
import { manilaToday } from "../../utils/manila-calendar";
import { cents } from "../budgets/controlled-budget.model";
import { verifyReceiptBasis,type ReceiptEvidenceBasis,type EvidenceResult } from "./receipt-evidence.model";

type ReceiptRow=RowDataPacket & ReceiptEvidenceBasis & { storagePath:string|null; purpose:string; channel:string; entityType:string|null; entityId:string|null; sourcePaymentId:string|null; sourceStatus:string|null; sourcePaymentStatus:string|null; sourceAmount:string|null; sourceMemberId:string|null };
const unavailable:EvidenceResult={status:"unavailable",fingerprint:null};
/** Do not use LocalStorageProvider.get: its legacy fallback can read from a public directory. */
export async function readPrivateLocalObject(storagePath:string, root:string):Promise<Buffer> {
  if(!storagePath || /^(?:[a-z]+:|\/\/)/i.test(storagePath) || storagePath.includes("\\"))throw new Error("Unsafe path");
  const raw=storagePath.replace(/^(?:public\/uploads\/|storage\/uploads\/|uploads\/)/,"");
  if(!raw || raw.split("/").some((p)=>!p || p==="." || p===".."))throw new Error("Unsafe path");
  const key=normalizeObjectKey(raw),base=path.resolve(root,"protected"),full=path.resolve(base,...key.split("/"));
  if(!full.startsWith(base+path.sep))throw new Error("Unsafe path");
  const publicRoot=path.resolve(process.cwd(),"public");
  if(base===publicRoot || base.startsWith(publicRoot+path.sep))throw new Error("Public storage location");
  const resolvedBase=await realpath(base),resolvedFile=await realpath(full);
  if(resolvedBase!==base || !resolvedFile.startsWith(resolvedBase+path.sep))throw new Error("Untrusted storage location");
  // If the OS cannot prohibit following the final symlink during open, the
  // diagnostic cannot establish even this limited local-file identity.
  if (typeof constants.O_NOFOLLOW !== "number") throw new Error("No-follow reads unavailable");
  const handle=await open(full,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const before=await handle.stat({bigint:true});
    if(!before.isFile() || before.size<=BigInt(0) || before.size>BigInt(10*1024*1024))throw new Error("Untrusted file");
    const data=await handle.readFile();
    const after=await handle.stat({bigint:true});
    const current=await lstat(full,{bigint:true});
    if(!current.isFile() || current.isSymbolicLink() || before.dev!==after.dev || before.ino!==after.ino || before.size!==after.size || before.mtimeNs!==after.mtimeNs || before.ctimeNs!==after.ctimeNs || current.dev!==before.dev || current.ino!==before.ino || current.size!==before.size || BigInt(data.length)!==before.size)throw new Error("Object changed during read");
    return data;
  } finally { await handle.close(); }
}
/** Read-only diagnostic for an already-generated POS/Rental receipt. It cannot attach evidence or settle payment. */
export async function verifyExistingReceipt(paymentId:string,db?:Pick<Pool,"execute">,read=readPrivateLocalObject):Promise<EvidenceResult> {
  if(!/^[1-9]\d{0,19}$/.test(paymentId))return {status:"invalid",fingerprint:null};
  try {
    const [rows]=await (db ?? getPool()).execute<ReceiptRow[]>(`SELECT CAST(p.payment_reference_id AS CHAR) AS paymentId,CAST(r.payment_reference_id AS CHAR) AS receiptPaymentId,p.validation_status AS paymentStatus,CAST(p.amount AS CHAR) AS paymentAmount,CAST(p.member_id AS CHAR) AS paymentMemberId,
      CAST(r.payment_receipt_id AS CHAR) AS receiptId,r.processing_status AS receiptStatus,CAST(r.amount AS CHAR) AS receiptAmount,CAST(r.member_id AS CHAR) AS receiptMemberId,(r.reversed_at IS NOT NULL) AS receiptReversed,
      CAST(d.document_id AS CHAR) AS documentId,CAST(d.member_id AS CHAR) AS documentOwnerId,d.document_status AS documentStatus,d.access_level AS accessLevel,d.document_type AS documentType,d.related_module AS relatedModule,CAST(d.related_record_id AS CHAR) AS relatedRecordId,d.relationship_type AS relationshipType,d.current_version AS version,d.checksum_sha256 AS checksum,DATE_FORMAT(d.expiration_date,'%Y-%m-%d') AS expirationDate,d.file_path AS storagePath,
      p.payment_purpose AS purpose,p.payment_channel AS channel,p.related_entity_type AS entityType,CAST(p.related_entity_id AS CHAR) AS entityId,
      CAST(CASE WHEN p.payment_purpose='POS/Product' THEN ps.payment_reference_id WHEN p.payment_purpose='Rental' THEN rb.payment_reference_id ELSE NULL END AS CHAR) AS sourcePaymentId,
      CASE WHEN p.payment_purpose='POS/Product' THEN ps.sale_status WHEN p.payment_purpose='Rental' THEN rb.booking_status ELSE NULL END AS sourceStatus,
      CASE WHEN p.payment_purpose='POS/Product' THEN ps.payment_status WHEN p.payment_purpose='Rental' THEN rb.payment_status ELSE NULL END AS sourcePaymentStatus,
      CAST(CASE WHEN p.payment_purpose='POS/Product' THEN ps.total_amount ELSE NULL END AS CHAR) AS sourceAmount,
      CAST(CASE WHEN p.payment_purpose='POS/Product' THEN ps.member_id ELSE NULL END AS CHAR) AS sourceMemberId
      FROM payment_references p LEFT JOIN payment_receipts r ON r.payment_reference_id=p.payment_reference_id LEFT JOIN documents d ON d.document_id=r.document_id
      LEFT JOIN pos_sales ps ON p.payment_purpose='POS/Product' AND p.related_entity_type IN ('pos_sales','POS_SALE') AND ps.pos_sale_id=p.related_entity_id
      LEFT JOIN rental_bookings rb ON p.payment_purpose='Rental' AND p.related_entity_type='rental_bookings' AND rb.rental_booking_id=p.related_entity_id WHERE p.payment_reference_id=?`,[paymentId]);
    const row=rows[0];if(!row)return {status:"missing",fingerprint:null};
    if(!row.receiptId || !row.documentId || !row.storagePath)return {status:"missing",fingerprint:null};
    // Rental partial-payment attribution and noncash settlement contracts are
    // not yet established. Do not treat matching metadata as verification.
    if(row.purpose!=="POS/Product" || row.channel!=="Cash")return {status:"unsupported",fingerprint:null};
    if(row.sourcePaymentId!==paymentId || !row.entityId || !["Paid","Completed"].includes(row.sourceStatus??"") || row.sourcePaymentStatus!=="Paid" || row.sourceMemberId!==row.paymentMemberId || !row.sourceAmount || cents(row.sourceAmount)!==cents(row.paymentAmount))return {status:"invalid",fingerprint:null};
    if(env.STORAGE_DRIVER!=="local")return {status:"unavailable",fingerprint:null};
    let bytes:Buffer;try{bytes=await read(row.storagePath,path.resolve(process.cwd(),env.LOCAL_STORAGE_ROOT));}catch{return {status:"unavailable",fingerprint:null};}
    const checked=verifyReceiptBasis(row,bytes,manilaToday());
    if(checked.status!=="verified")return checked;
    // Bind the diagnostic fingerprint to the immutable source identity as well.
    return {status:"verified",fingerprint:createHash("sha256").update(JSON.stringify(["source-receipt-v1",row.purpose,row.channel,row.entityType,row.entityId,row.sourcePaymentId,row.sourceStatus,row.sourcePaymentStatus,checked.fingerprint])).digest("hex")};
  } catch { return unavailable; }
}
