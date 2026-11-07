import { createHash } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../../db/transaction";
import { createCentralDocument } from "../../records/central-document";
import { validateDocumentFile, type UploadedFileLike } from "../records/document-security";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { S3EvidenceObject } from "../../storage/evidence-s3-version";
import { createEvidenceUploadIntentRepository } from "./evidence-upload-intent.repository";

export type ManualEvidenceStore = {
  writeLockedEvidenceVersion(bytes:Buffer,contentType:string,reservedKey:string):Promise<S3EvidenceObject>;
  readLockedEvidenceVersion(identity:S3EvidenceObject):Promise<Buffer>;
};

const missing=()=>new AppError("Evidence not found",404,"EVIDENCE_NOT_FOUND");
const unavailable=()=>new AppError("Evidence storage unavailable",503,"EVIDENCE_STORAGE_UNAVAILABLE");
async function source(c:PoolConnection,id:string,actor:string) {
  const [rows]=await c.execute<RowDataPacket[]>(`SELECT CAST(recorded_by AS CHAR) AS maker,record_type AS type,source_module AS source,source_record_id AS sourceId,payment_reference_id AS paymentId,member_id AS memberId,approved_by AS approver,record_status AS status,CAST(amount AS CHAR) AS amount,CAST(financial_category_id AS CHAR) AS category,DATE_FORMAT(record_date,'%Y-%m-%d') AS date,CAST(season_id AS CHAR) AS seasonId,remarks FROM financial_records WHERE financial_record_id=? FOR UPDATE`,[id]);
  const r=rows[0];
  if(!r || r.maker!==actor || r.type!=="Expense" || r.source!=="Manual" || r.sourceId!==null || r.paymentId!==null || r.memberId!==null || r.approver!==null || r.status!=="Active") throw missing();
  return createHash("sha256").update(JSON.stringify([id,r.maker,r.type,r.source,r.amount,r.category,r.date,r.seasonId,r.remarks])).digest("hex");
}

/** Called inside an existing document transaction; verifies current link,
 * source and exact locked object before any bytes are returned. */
export async function readManualEvidence(c:PoolConnection,documentId:string,auth:{id:string;role:string}|null,store:ManualEvidenceStore,action:"Preview"|"Download"|"Print") {
  if(!auth || !["bookkeeper","chairman"].includes(auth.role))throw missing();
  const [rows]=await c.execute<RowDataPacket[]>(`SELECT CAST(l.financial_record_id AS CHAR) AS recordId,CAST(l.created_by AS CHAR) AS maker,l.link_status AS linkStatus,l.document_version AS linkVersion,l.document_checksum AS linkChecksum,i.intent_state AS intentState,i.source_snapshot_sha256 AS sourceBasis,i.object_key AS objectKey,i.object_version AS objectVersion,i.storage_bucket AS bucket,i.expected_sha256 AS checksum,i.expected_size AS size,i.expected_mime AS mime,i.document_version AS intentVersion,CAST(i.source_owner_id AS CHAR) AS intentOwner,CAST(i.uploaded_by AS CHAR) AS intentActor,CAST(i.intent_id AS CHAR) AS intentId,d.document_status AS documentStatus,d.access_level AS accessLevel,d.category AS category,d.current_version AS documentVersion,d.checksum_sha256 AS documentChecksum,d.document_type AS documentType,d.related_module AS relatedModule,CAST(d.related_record_id AS CHAR) AS relatedRecordId,d.relationship_type AS relationshipType,d.file_path AS filePath,CAST(d.uploaded_by AS CHAR) AS uploader,CAST(d.member_id AS CHAR) AS memberId,DATE_FORMAT(d.expiration_date,'%Y-%m-%d') AS expires FROM finance_manual_evidence_links l JOIN finance_evidence_upload_intents i ON i.document_id=l.document_id AND i.financial_record_id=l.financial_record_id JOIN documents d ON d.document_id=l.document_id WHERE l.document_id=? FOR UPDATE`,[documentId]);
  const r=rows[0];if(!r || (auth.role==="bookkeeper" && r.maker!==auth.id) || r.linkStatus!=="ACTIVE" || r.intentState!=="FINALIZED" || r.documentStatus!=="Active" || r.accessLevel!=="Bookkeeper-only" || r.category!=="FINANCIAL" || r.memberId!==null || r.uploader!==r.maker || r.intentOwner!==r.maker || r.intentActor!==r.maker || r.documentType!=="Receipt" || r.relatedModule!=="Manual Finance" || r.relatedRecordId!==r.recordId || r.relationshipType!=="Evidence" || r.filePath!==`financial-evidence:${r.intentId}` || Number(r.linkVersion)!==Number(r.documentVersion) || Number(r.intentVersion)!==Number(r.documentVersion) || r.linkChecksum!==r.checksum || r.documentChecksum!==r.checksum || !r.bucket || !r.objectVersion || !r.sourceBasis)throw missing();
  const {manilaToday}=await import("../../utils/manila-calendar");if(r.expires && r.expires<manilaToday())throw missing();
  if(await source(c,String(r.recordId),String(r.maker))!==r.sourceBasis)throw missing();
  let bytes:Buffer;try {bytes=await store.readLockedEvidenceVersion({bucket:String(r.bucket),key:String(r.objectKey),versionId:String(r.objectVersion),sha256:String(r.checksum),size:Number(r.size),contentType:String(r.mime)});}catch{throw missing();}
  if(bytes.length!==Number(r.size) || createHash("sha256").update(bytes).digest("hex")!==r.checksum)throw missing();
  await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,action_time) VALUES(?,?,'documents',?,'Version-bound financial evidence read',UTC_TIMESTAMP())",[auth.id,`financial_evidence.${action.toLowerCase()}`,documentId]);
  return bytes;
}

/** S3-only manual-draft upload; storage failures never delete uploaded bytes. */
export function createManualEvidenceWorkflow(pool:Pool,store:ManualEvidenceStore) {
  const intents=createEvidenceUploadIntentRepository(pool);
  async function upload(recordId:string,key:string,file:UploadedFileLike,auth:AuthContext,replacement?:{linkId:string;version:number;reason:string}) {
    if(auth.user.role!=="bookkeeper") throw missing();
    let validated:Awaited<ReturnType<typeof validateDocumentFile>>;
    try {validated=await validateDocumentFile(file);} catch {throw new AppError("Invalid evidence file",422,"INVALID_EVIDENCE_FILE");}
    if(!["application/pdf","image/jpeg","image/png"].includes(validated.mimeType)) throw new AppError("Invalid evidence file",422,"INVALID_EVIDENCE_FILE");
    const prepared=await intents.prepare({recordId,requestKey:key,sha256:validated.checksum,size:validated.size,mime:validated.mimeType,replacement},auth);
    const reservation=await withTransaction(async c=>{
      const basis=await source(c,recordId,auth.user.id);
      const [rows]=await c.execute<RowDataPacket[]>("SELECT object_key AS objectKey,intent_state AS state,source_snapshot_sha256 AS basis,CAST(document_id AS CHAR) AS documentId,generation FROM finance_evidence_upload_intents WHERE intent_id=? AND financial_record_id=? AND uploaded_by=? FOR UPDATE",[prepared.id,recordId,auth.user.id]);
      const row=rows[0];if(!row)throw missing();
      if(row.state==="FINALIZED") {
        if(!row.documentId || row.basis!==basis)throw new AppError("Financial record changed",409,"EVIDENCE_SOURCE_CHANGED");
        return {documentId:String(row.documentId),basis,objectKey:null,generation:Number(row.generation)};
      }
      if(row.state!=="PREPARED" || (row.basis && row.basis!==basis)) throw new AppError("Evidence requires recovery",409,"EVIDENCE_RECOVERY_REQUIRED");
      const generation=Number(row.generation)+1;
      const [claimed]=await c.execute<ResultSetHeader>("UPDATE finance_evidence_upload_intents SET source_snapshot_sha256=?,intent_state='UPLOADING',generation=? WHERE intent_id=? AND intent_state='PREPARED' AND generation=?",[basis,generation,prepared.id,row.generation]);
      if(claimed.affectedRows!==1)throw new AppError("Evidence changed",409,"EVIDENCE_CONFLICT");
      await c.execute("INSERT INTO finance_evidence_upload_events(intent_id,generation,actor_id,event_type) VALUES(?,?,?,'UPLOADING')",[prepared.id,generation,auth.user.id]);
      return {documentId:null,basis,objectKey:String(row.objectKey),generation};
    },pool);
    if(reservation.documentId)return {documentId:reservation.documentId,replayed:true};
    let object:S3EvidenceObject;
    try {object=await store.writeLockedEvidenceVersion(validated.buffer,validated.mimeType,reservation.objectKey!);} catch {await intents.requireRecovery(prepared.id,reservation.generation,auth).catch(()=>undefined);throw unavailable();}
    if(object.key!==reservation.objectKey || object.sha256!==validated.checksum || object.size!==validated.size || object.contentType!==validated.mimeType || !object.versionId || object.versionId==="null") {await intents.requireRecovery(prepared.id,reservation.generation,auth).catch(()=>undefined);throw unavailable();}
    try {return await withTransaction(async c=>{
      if(await source(c,recordId,auth.user.id)!==reservation.basis)throw new AppError("Financial record changed",409,"EVIDENCE_SOURCE_CHANGED");
      const [rows]=await c.execute<RowDataPacket[]>("SELECT intent_state AS state,source_snapshot_sha256 AS basis,object_key AS objectKey,expected_sha256 AS checksum,expected_size AS size,expected_mime AS mime,CAST(document_id AS CHAR) AS documentId,generation FROM finance_evidence_upload_intents WHERE intent_id=? AND financial_record_id=? AND uploaded_by=? FOR UPDATE",[prepared.id,recordId,auth.user.id]);
      const row=rows[0];if(!row)throw missing();
      if(row.state==="FINALIZED")return {documentId:String(row.documentId),replayed:true};
      if(row.state!=="UPLOADING" || Number(row.generation)!==reservation.generation || row.basis!==reservation.basis || row.objectKey!==object.key || row.checksum!==object.sha256 || Number(row.size)!==object.size || row.mime!==object.contentType)throw new AppError("Evidence changed",409,"EVIDENCE_CONFLICT");
      let bytes:Buffer;try {bytes=await store.readLockedEvidenceVersion(object);}catch{throw unavailable();}
      if(bytes.length!==object.size || createHash("sha256").update(bytes).digest("hex")!==object.sha256)throw unavailable();
      if(replacement) {
        const [old]=await c.execute<RowDataPacket[]>("SELECT link_status AS status,version FROM finance_manual_evidence_links WHERE link_id=? AND financial_record_id=? FOR UPDATE",[replacement.linkId,recordId]);
        if(!old[0] || old[0].status!=="ACTIVE" || Number(old[0].version)!==replacement.version)throw new AppError("Evidence changed",409,"EVIDENCE_CONFLICT");
        const [updated]=await c.execute<ResultSetHeader>("UPDATE finance_manual_evidence_links SET link_status='REPLACED',version=version+1 WHERE link_id=? AND link_status='ACTIVE' AND version=?",[replacement.linkId,replacement.version]);
        if(updated.affectedRows!==1)throw new AppError("Evidence changed",409,"EVIDENCE_CONFLICT");
      }
      const document=await createCentralDocument(c,{uploadedBy:auth.user.id,title:`Manual expense evidence`,category:"FINANCIAL",documentType:"Receipt",accessLevel:"Bookkeeper-only",storagePath:`financial-evidence:${prepared.id}`,originalFileName:validated.originalFileName,mimeType:validated.mimeType,fileSizeBytes:validated.size,checksum:validated.checksum,relatedModule:"Manual Finance",relatedRecordId:recordId,relationshipType:"Evidence"});
      await c.execute("UPDATE documents SET category='FINANCIAL' WHERE document_id=?",[document.documentId]);
      const [link]=await c.execute<ResultSetHeader>("INSERT INTO finance_manual_evidence_links(financial_record_id,document_id,document_version,document_checksum,created_by,supersedes_link_id) VALUES(?,?,1,?,?,?)",[recordId,document.documentId,object.sha256,auth.user.id,replacement?.linkId ?? null]);
      await c.execute("INSERT INTO finance_manual_evidence_events(link_id,link_version,actor_id,event_type,replacement_link_id,reason,request_key,request_hash) VALUES(?,?,?,?,?,?,?,?)",[replacement?.linkId ?? link.insertId,replacement ? replacement.version+1 : 1,auth.user.id,replacement ? "REPLACED" : "LINKED",replacement ? link.insertId : null,replacement?.reason ?? null,key,createHash("sha256").update(JSON.stringify(["upload",auth.user.id,recordId,object.sha256,replacement ?? null])).digest("hex")]);
      const [changed]=await c.execute<ResultSetHeader>("UPDATE finance_evidence_upload_intents SET intent_state='FINALIZED',generation=generation+1,document_id=?,document_version=1,object_version=?,storage_bucket=? WHERE intent_id=? AND intent_state='UPLOADING' AND generation=?",[document.documentId,object.versionId,object.bucket,prepared.id,row.generation]);
      if(changed.affectedRows!==1)throw new AppError("Evidence changed",409,"EVIDENCE_CONFLICT");
      await c.execute("INSERT INTO finance_evidence_upload_events(intent_id,generation,actor_id,event_type) VALUES(?,?,?,'FINALIZED')",[prepared.id,Number(row.generation)+1,auth.user.id]);
      await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,action_time) VALUES(?,'financial_evidence.finalized','finance_evidence_upload_intents',?,'Manual expense evidence finalized',UTC_TIMESTAMP())",[auth.user.id,prepared.id]);
      return {documentId:String(document.documentId),replayed:false};
    },pool);} catch(error) {
      await intents.requireRecovery(prepared.id,reservation.generation,auth).catch(()=>undefined);
      if(["ER_DUP_ENTRY","ER_LOCK_DEADLOCK","ER_LOCK_WAIT_TIMEOUT"].includes((error as {code?:string}).code ?? "")) throw new AppError("Evidence request conflicts",409,"EVIDENCE_CONFLICT");
      throw error;
    }
  }
  return {upload};
}
