import { createHash, randomUUID } from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";

type PrepareInput = { recordId:string; requestKey:string; sha256:string; size:number; mime:string; replacement?:{linkId:string;version:number;reason:string} };
const allowedMime=new Set(["application/pdf","image/jpeg","image/png"]);

/** Prepares identity before any provider write. No evidence is verified here. */
export function createEvidenceUploadIntentRepository(pool:Pool) {
  async function prepare(input:PrepareInput,auth:AuthContext) {
    if(auth.user.role!=="bookkeeper") throw new AppError("Evidence source not found",404,"EVIDENCE_NOT_FOUND");
    if(!/^[1-9]\d{0,19}$/.test(input.recordId) || !/^[a-f0-9]{64}$/.test(input.requestKey) || !/^[a-f0-9]{64}$/.test(input.sha256) || !Number.isSafeInteger(input.size) || input.size<1 || input.size>10*1024*1024 || !allowedMime.has(input.mime)) throw new AppError("Invalid upload intent",422,"INVALID_EVIDENCE_INTENT");
    if(input.replacement && (!/^[1-9]\d{0,19}$/.test(input.replacement.linkId) || !Number.isSafeInteger(input.replacement.version) || input.replacement.version<1 || !input.replacement.reason.trim() || input.replacement.reason.length>2000)) throw new AppError("Invalid upload intent",422,"INVALID_EVIDENCE_INTENT");
    const hash=createHash("sha256").update(JSON.stringify([auth.user.id,input.recordId,input.sha256,input.size,input.mime,input.replacement ?? null])).digest("hex");
    try {
      return await withTransaction(async c=>{
        const [records]=await c.execute<RowDataPacket[]>("SELECT CAST(recorded_by AS CHAR) AS maker,record_type AS type,source_module AS source,source_record_id AS sourceId,payment_reference_id AS paymentId,member_id AS memberId,approved_by AS approver,record_status AS status FROM financial_records WHERE financial_record_id=? FOR UPDATE",[input.recordId]);
        const r=records[0];
        if(!r || r.maker!==auth.user.id || r.type!=="Expense" || r.source!=="Manual" || r.sourceId!==null || r.paymentId!==null || r.memberId!==null || r.approver!==null || r.status!=="Active") throw new AppError("Evidence source not found",404,"EVIDENCE_NOT_FOUND");
        const [prior]=await c.execute<RowDataPacket[]>("SELECT CAST(intent_id AS CHAR) AS id,request_hash AS hash,intent_state AS state FROM finance_evidence_upload_intents WHERE request_key=? FOR UPDATE",[input.requestKey]);
        if(prior[0]) {
          if(prior[0].hash!==hash) throw new AppError("Upload request conflicts",409,"IDEMPOTENCY_CONFLICT");
          return {id:String(prior[0].id),state:String(prior[0].state),replayed:true};
        }
        const objectKey=`protected/evidence/${randomUUID()}/${randomUUID()}`;
        const [insert]=await c.execute<ResultSetHeader>("INSERT INTO finance_evidence_upload_intents(financial_record_id,source_owner_id,uploaded_by,request_key,request_hash,object_key,storage_provider,expected_sha256,expected_size,expected_mime) VALUES(?,?,?,?,?,?,'S3',?,?,?)",[input.recordId,auth.user.id,auth.user.id,input.requestKey,hash,objectKey,input.sha256,input.size,input.mime]);
        await c.execute("INSERT INTO finance_evidence_upload_events(intent_id,generation,actor_id,event_type) VALUES(?,1,?,'PREPARED')",[insert.insertId,auth.user.id]);
        await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,action_time) VALUES(?,'financial_evidence.intent_prepared','finance_evidence_upload_intents',?,'Evidence upload intent prepared',UTC_TIMESTAMP())",[auth.user.id,insert.insertId]);
        return {id:String(insert.insertId),state:"PREPARED",replayed:false};
      },pool);
    } catch(error) {
      if(["ER_DUP_ENTRY","ER_LOCK_DEADLOCK","ER_LOCK_WAIT_TIMEOUT"].includes((error as {code?:string}).code ?? "")) throw new AppError("Upload request conflicts",409,"EVIDENCE_CONFLICT");
      throw error;
    }
  }
  async function requireRecovery(intentId:string,expectedGeneration:number,auth:AuthContext) {
    if(auth.user.role!=="bookkeeper" || !/^[1-9]\d{0,19}$/.test(intentId) || !Number.isSafeInteger(expectedGeneration) || expectedGeneration<1) throw new AppError("Upload intent not found",404,"EVIDENCE_NOT_FOUND");
    return withTransaction(async c=>{
      // The source hint is not authorization. Lock and validate the source
      // first; recheck the relationship when locking the intent below.
      const [hints]=await c.execute<RowDataPacket[]>("SELECT CAST(financial_record_id AS CHAR) AS recordId FROM finance_evidence_upload_intents WHERE intent_id=?",[intentId]);
      if(!hints[0])throw new AppError("Upload intent not found",404,"EVIDENCE_NOT_FOUND");
      const [sources]=await c.execute<RowDataPacket[]>("SELECT CAST(recorded_by AS CHAR) AS maker,record_type AS type,source_module AS source,source_record_id AS sourceId,payment_reference_id AS paymentId,member_id AS memberId,approved_by AS approver,record_status AS status FROM financial_records WHERE financial_record_id=? FOR UPDATE",[hints[0].recordId]);
      const source=sources[0];if(!source || source.maker!==auth.user.id || source.type!=="Expense" || source.source!=="Manual" || source.sourceId!==null || source.paymentId!==null || source.memberId!==null || source.approver!==null || source.status!=="Active")throw new AppError("Upload intent not found",404,"EVIDENCE_NOT_FOUND");
      const [rows]=await c.execute<RowDataPacket[]>("SELECT CAST(uploaded_by AS CHAR) AS actor,CAST(financial_record_id AS CHAR) AS recordId,intent_state AS state,generation FROM finance_evidence_upload_intents WHERE intent_id=? FOR UPDATE",[intentId]);
      const row=rows[0];
      if(!row || row.actor!==auth.user.id || row.recordId!==hints[0].recordId) throw new AppError("Upload intent not found",404,"EVIDENCE_NOT_FOUND");
      if(Number(row.generation)!==expectedGeneration || !["PREPARED","UPLOADING"].includes(row.state)) throw new AppError("Upload intent changed",409,"EVIDENCE_CONFLICT");
      const generation=expectedGeneration+1;
      const [changed]=await c.execute<ResultSetHeader>("UPDATE finance_evidence_upload_intents SET intent_state='RECOVERY_REQUIRED',generation=? WHERE intent_id=? AND generation=? AND intent_state IN ('PREPARED','UPLOADING')",[generation,intentId,expectedGeneration]);
      if(changed.affectedRows!==1) throw new AppError("Upload intent changed",409,"EVIDENCE_CONFLICT");
      await c.execute("INSERT INTO finance_evidence_upload_events(intent_id,generation,actor_id,event_type) VALUES(?,?,?,'RECOVERY_REQUIRED')",[intentId,generation,auth.user.id]);
      await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,action_time) VALUES(?,'financial_evidence.recovery_required','finance_evidence_upload_intents',?,'Evidence upload requires recovery',UTC_TIMESTAMP())",[auth.user.id,intentId]);
      return {id:intentId,state:"RECOVERY_REQUIRED" as const,generation};
    },pool);
  }
  return {prepare,requireRecovery};
}
