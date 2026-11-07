import { createHash } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../../db/transaction";
import { manilaToday } from "../../utils/manila-calendar";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";

// Internal foundation only: no routes, file access, verified state, or posting adapter.
// A linked document is a claim requiring independent object/source verification.
type Link = RowDataPacket & { id: string; recordId: string; documentId: string; version: number; status: string };
const idPattern = /^[1-9]\d{0,19}$/;
const keyPattern = /^[a-f0-9]{64}$/;
const selectLink = "SELECT CAST(link_id AS CHAR) AS id, CAST(financial_record_id AS CHAR) AS recordId, CAST(document_id AS CHAR) AS documentId, version, link_status AS status FROM finance_manual_evidence_links";

function badRequest(): never { throw new AppError("Invalid evidence request", 422, "INVALID_EVIDENCE_REQUEST"); }
function deny(): never { throw new AppError("Evidence not found", 404, "EVIDENCE_NOT_FOUND"); }
function digest(values: unknown[]) { return createHash("sha256").update(JSON.stringify(values)).digest("hex"); }

export function createManualEvidenceRepository(pool: Pool) {
  async function lockRecord(c: PoolConnection, recordId: string, auth: AuthContext, write: boolean) {
    if (!idPattern.test(recordId)) badRequest();
    if (write ? auth.user.role !== "bookkeeper" : !["bookkeeper", "chairman"].includes(auth.user.role)) deny();
    const [rows] = await c.execute<RowDataPacket[]>(`SELECT CAST(recorded_by AS CHAR) AS maker, source_module AS source, CAST(source_record_id AS CHAR) AS sourceId, CAST(payment_reference_id AS CHAR) AS paymentId, CAST(member_id AS CHAR) AS memberId, CAST(approved_by AS CHAR) AS approver, record_status AS status FROM financial_records WHERE financial_record_id=? FOR UPDATE`, [recordId]);
    const r = rows[0];
    if (!r || (auth.user.role === "bookkeeper" && r.maker !== auth.user.id) || r.source !== "Manual" || r.sourceId || r.paymentId || r.memberId || r.approver || r.status !== "Active") deny();
  }
  async function lockDocument(c: PoolConnection, documentId: string, auth: AuthContext) {
    if (!idPattern.test(documentId)) badRequest();
    const [rows] = await c.execute<RowDataPacket[]>(`SELECT CAST(uploaded_by AS CHAR) AS uploader,CAST(member_id AS CHAR) AS owner,access_level AS accessLevel,document_status AS status,document_type AS type,current_version AS version,checksum_sha256 AS checksum,DATE_FORMAT(expiration_date,'%Y-%m-%d') AS expires,related_module AS relatedModule,CAST(related_record_id AS CHAR) AS relatedRecordId,relationship_type AS relationshipType FROM documents WHERE document_id=? FOR UPDATE`, [documentId]);
    const d = rows[0];
    if (!d || d.uploader !== auth.user.id || d.owner || d.relatedModule || d.relatedRecordId || d.relationshipType || d.accessLevel !== "Bookkeeper-only" || d.status !== "Active" || !["Receipt", "Financial Document"].includes(d.type) || !Number.isSafeInteger(Number(d.version)) || Number(d.version) < 1 || !/^[a-f0-9]{64}$/i.test(d.checksum ?? "") || (d.expires && d.expires < manilaToday())) deny();
    return { version: Number(d.version), checksum: String(d.checksum).toLowerCase() };
  }
  async function replay(c: PoolConnection, key: string, hash: string) {
    const [rows] = await c.execute<RowDataPacket[]>("SELECT request_hash AS hash,CAST(link_id AS CHAR) AS id,CAST(replacement_link_id AS CHAR) AS replacementId,link_version AS version,event_type AS event FROM finance_manual_evidence_events WHERE request_key=? FOR UPDATE", [key]);
    if (!rows.length) return null;
    if (rows[0].hash !== hash) throw new AppError("Request key conflict", 409, "IDEMPOTENCY_CONFLICT");
    return { id: String(rows[0].replacementId ?? rows[0].id), version: rows[0].replacementId ? 1 : Number(rows[0].version), replayed: true };
  }
  async function event(c: PoolConnection, id: string, version: number, actor: string, action: string, key: string, hash: string, reason: string | null, replacementId: string | null) {
    await c.execute("INSERT INTO finance_manual_evidence_events(link_id,link_version,actor_id,event_type,replacement_link_id,reason,request_key,request_hash) VALUES(?,?,?,?,?,?,?,?)", [id,version,actor,action,replacementId,reason,key,hash]);
    await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,new_values,action_time) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP())", [actor,`manual_evidence.${action.toLowerCase()}`,"finance_manual_evidence_links",id,"Manual draft evidence relationship changed",JSON.stringify({version,replacementId,reason})]);
  }
  async function mutate(input: { recordId: string; documentId?: string; linkId?: string; version?: number; key: string; reason?: string }, auth: AuthContext, action: "LINKED" | "REPLACED" | "REVOKED") {
    if (!keyPattern.test(input.key) || (action !== "LINKED" && (!input.linkId || !idPattern.test(input.linkId) || !Number.isSafeInteger(input.version) || !input.reason?.trim() || input.reason.trim().length > 2000))) badRequest();
    const hash=digest([action,auth.user.id,input.recordId,input.documentId ?? null,input.linkId ?? null,input.version ?? null,input.reason?.trim() ?? null]);
    try {
      return await withTransaction(async c => {
        await lockRecord(c,input.recordId,auth,true);
        const previous=await replay(c,input.key,hash); if(previous) return previous;
        let old: Link | undefined;
        if(action!=="LINKED") {
          const [rows]=await c.execute<Link[]>(`${selectLink} WHERE link_id=? AND financial_record_id=? FOR UPDATE`,[input.linkId!,input.recordId]);
          old=rows[0];
          if(!old || old.status!=="ACTIVE" || Number(old.version)!==input.version) throw new AppError("Evidence changed",409,"EVIDENCE_CONFLICT");
        }
        let doc: {version:number;checksum:string} | undefined;
        if(action!=="REVOKED") {
          if (!input.documentId || input.documentId===old?.documentId) badRequest();
          doc=await lockDocument(c,input.documentId,auth);
        }
        if(old) {
          const [changed]=await c.execute<ResultSetHeader>("UPDATE finance_manual_evidence_links SET link_status=?,version=version+1 WHERE link_id=? AND link_status='ACTIVE' AND version=?",[action==="REPLACED"?"REPLACED":"REVOKED",old.id,input.version!]);
          if(changed.affectedRows!==1) throw new AppError("Evidence changed",409,"EVIDENCE_CONFLICT");
        }
        let created: string | null=null;
        if(doc && input.documentId) {
          const [insert]=await c.execute<ResultSetHeader>("INSERT INTO finance_manual_evidence_links(financial_record_id,document_id,document_version,document_checksum,created_by,supersedes_link_id) VALUES(?,?,?,?,?,?)",[input.recordId,input.documentId,doc.version,doc.checksum,auth.user.id,old?.id ?? null]);
          created=String(insert.insertId);
        }
        const id=old?.id ?? created!; const version=old ? Number(old.version)+1 : 1;
        await event(c,id,version,auth.user.id,action,input.key,hash,input.reason?.trim() ?? null,old ? created : null);
        return {id:created ?? id,version:created ? 1 : version,replayed:false};
      },pool);
    } catch(error) {
      if(["ER_DUP_ENTRY","ER_LOCK_DEADLOCK","ER_LOCK_WAIT_TIMEOUT"].includes((error as {code?:string}).code ?? "")) throw new AppError("Evidence request conflicts",409,"EVIDENCE_CONFLICT");
      throw error;
    }
  }
  async function list(recordId: string, auth: AuthContext) {
    return withTransaction(async c => {
      await lockRecord(c,recordId,auth,false);
      const [rows]=await c.execute<(Link & { visibleDocumentId: string | null })[]>(`SELECT CAST(l.link_id AS CHAR) AS id,CAST(l.financial_record_id AS CHAR) AS recordId,CASE WHEN d.uploaded_by=l.created_by AND d.member_id IS NULL AND d.related_module IS NULL AND d.related_record_id IS NULL AND d.relationship_type IS NULL AND d.access_level='Bookkeeper-only' AND d.document_status='Active' AND d.current_version=l.document_version AND LOWER(d.checksum_sha256)=l.document_checksum AND (d.expiration_date IS NULL OR d.expiration_date>=?) THEN CAST(l.document_id AS CHAR) ELSE NULL END AS visibleDocumentId,l.version,l.link_status AS status FROM finance_manual_evidence_links l JOIN documents d ON d.document_id=l.document_id WHERE l.financial_record_id=? ORDER BY l.link_id`,[manilaToday(),recordId]);
      await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,action_time) VALUES(?,'manual_evidence.list','financial_records',?,'Manual draft evidence history read',UTC_TIMESTAMP())",[auth.user.id,recordId]);
      return rows.map(row=>({id:String(row.id),recordId:String(row.recordId),documentId:row.visibleDocumentId,version:Number(row.version),status:row.status,verification:"UNAVAILABLE" as const}));
    },pool);
  }
  async function history(recordId: string, auth: AuthContext) {
    return withTransaction(async c => {
      await lockRecord(c,recordId,auth,false);
      const [events]=await c.execute<RowDataPacket[]>(`SELECT CAST(e.link_id AS CHAR) AS linkId,e.link_version AS version,CAST(e.actor_id AS CHAR) AS actorId,e.event_type AS eventType,CAST(e.replacement_link_id AS CHAR) AS replacementId,e.reason,e.created_at AS createdAt FROM finance_manual_evidence_events e JOIN finance_manual_evidence_links l ON l.link_id=e.link_id WHERE l.financial_record_id=? ORDER BY e.event_id`,[recordId]);
      await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,action_time) VALUES(?,'manual_evidence.history','financial_records',?,'Manual draft evidence events read',UTC_TIMESTAMP())",[auth.user.id,recordId]);
      return events.map(e=>({linkId:String(e.linkId),version:Number(e.version),actorId:String(e.actorId),eventType:e.eventType,replacementId:e.replacementId===null?null:String(e.replacementId),reason:e.reason,createdAt:e.createdAt}));
    },pool);
  }
  async function verify(recordId: string, linkId: string, auth: AuthContext) {
    if(!idPattern.test(linkId)) badRequest();
    return withTransaction(async c => {
      await lockRecord(c,recordId,auth,false);
      const [links]=await c.execute<(Link & {documentVersion:number;checksum:string;creator:string})[]>("SELECT CAST(link_id AS CHAR) AS id,CAST(financial_record_id AS CHAR) AS recordId,CAST(document_id AS CHAR) AS documentId,version,link_status AS status,document_version AS documentVersion,document_checksum AS checksum,CAST(created_by AS CHAR) AS creator FROM finance_manual_evidence_links WHERE link_id=? AND financial_record_id=? FOR UPDATE",[linkId,recordId]);
      const link=links[0]; if(!link) deny();
      const [documents]=await c.execute<RowDataPacket[]>(`SELECT CAST(uploaded_by AS CHAR) AS uploader,CAST(member_id AS CHAR) AS owner,access_level AS accessLevel,document_status AS status,document_type AS type,current_version AS version,checksum_sha256 AS checksum,DATE_FORMAT(expiration_date,'%Y-%m-%d') AS expires,related_module AS relatedModule,CAST(related_record_id AS CHAR) AS relatedRecordId,relationship_type AS relationshipType FROM documents WHERE document_id=? FOR UPDATE`,[link.documentId]);
      const d=documents[0];
      let status:"STALE"|"INVALID"|"UNAVAILABLE"="UNAVAILABLE";
      if(link.status!=="ACTIVE" || !d || d.status!=="Active" || (d.expires && d.expires<manilaToday()) || Number(d.version)!==Number(link.documentVersion) || String(d.checksum ?? "").toLowerCase()!==link.checksum) status="STALE";
      else if(d.uploader!==link.creator || d.owner || d.relatedModule || d.relatedRecordId || d.relationshipType || d.accessLevel!=="Bookkeeper-only" || !["Receipt","Financial Document"].includes(d.type)) status="INVALID";
      // The object store has not provided a trusted immutable version. Matching
      // metadata alone must never produce a verified result or fingerprint.
      await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,new_values,action_time) VALUES(?,'manual_evidence.verify','finance_manual_evidence_links',?,'Manual draft evidence status read',?,UTC_TIMESTAMP())",[auth.user.id,linkId,JSON.stringify({status})]);
      return {status,fingerprint:null};
    },pool);
  }
  return {
    link: (recordId:string,documentId:string,key:string,auth:AuthContext)=>mutate({recordId,documentId,key},auth,"LINKED"),
    replace: (recordId:string,linkId:string,version:number,documentId:string,reason:string,key:string,auth:AuthContext)=>mutate({recordId,linkId,version,documentId,reason,key},auth,"REPLACED"),
    revoke: (recordId:string,linkId:string,version:number,reason:string,key:string,auth:AuthContext)=>mutate({recordId,linkId,version,reason,key},auth,"REVOKED"),
    list,
    history,
    verify,
  };
}
