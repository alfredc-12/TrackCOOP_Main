import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { createHash } from "node:crypto";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { fingerprint, taxonomy, transition, type Action, type CaseState, type ExceptionCode, type ReasonCode, type Role, type SourceType } from "./finance-exception.model";

type Row = RowDataPacket & { id:string; fingerprint:string; sourceType:SourceType; sourceId:string; code:ExceptionCode; severity:typeof taxonomy[ExceptionCode]; state:CaseState; version:number; assignedTo:string|null };
const select = `SELECT CAST(case_id AS CHAR) AS id,fingerprint,source_type AS sourceType,CAST(source_id AS CHAR) AS sourceId,exception_code AS code,severity,case_state AS state,version,CAST(assigned_to AS CHAR) AS assignedTo FROM finance_exception_cases`;
function staff(auth:AuthContext):Role { if(auth.user.role!=="chairman" && auth.user.role!=="bookkeeper") throw new AppError("Not authorized",403,"FORBIDDEN"); return auth.user.role; }
function hash(parts:unknown[]) { return createHash("sha256").update(JSON.stringify(parts)).digest("hex"); }
async function sourceCondition(c:PoolConnection,type:SourceType,id:string,code:ExceptionCode):Promise<"present"|"cleared"|"unknown"> {
  if(type!=="payment_reference") {
    const table=type==="financial_record"?"financial_records":"finance_controlled_operations";
    const column=type==="financial_record"?"financial_record_id":"operation_id";
    const [rows]=await c.execute<RowDataPacket[]>(`SELECT ${column} FROM ${table} WHERE ${column}=? FOR UPDATE`,[id]);
    if(!rows.length) throw new AppError("Source not found",404,"EXCEPTION_SOURCE_NOT_FOUND");
    return "unknown";
  }
  const [rows]=await c.execute<RowDataPacket[]>(`SELECT validation_status AS status,payment_purpose AS purpose FROM payment_references WHERE payment_reference_id=? FOR UPDATE`,[id]);
  if(!rows.length) throw new AppError("Source not found",404,"EXCEPTION_SOURCE_NOT_FOUND");
  const payment=rows[0];
  if(["MISSING_POSTING","DUPLICATE_POSTING","POSSIBLE_DUPLICATE","AMOUNT_MISMATCH"].includes(code)) {
    if(payment.status!=="Validated" || !["POS/Product","Rental"].includes(payment.purpose)) return "unknown";
    const [counts]=await c.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total,COALESCE(SUM(fr.amount<>p.amount),0) AS mismatch FROM payment_references p JOIN financial_records fr ON fr.payment_reference_id=p.payment_reference_id WHERE p.payment_reference_id=? AND fr.record_type='Income' AND fr.record_status='Active' AND fr.approved_by IS NOT NULL AND fr.reversal_of_record_id IS NULL`,[id]);
    const total=Number(counts[0].total),mismatch=Number(counts[0].mismatch);
    const present=code==="MISSING_POSTING"?total===0:code==="AMOUNT_MISMATCH"?mismatch>0:total>1;
    return present?"present":"cleared";
  }
  if(code==="RECEIPT_FAILURE") {
    if(!["Validated","Reversed"].includes(payment.status)) return "unknown";
    const [receipts]=await c.execute<RowDataPacket[]>("SELECT processing_status AS status FROM payment_receipts WHERE payment_reference_id=?",[id]);
    return receipts.some((r)=>r.status==="Generated")?"cleared":"present";
  }
  if(code==="CLARIFICATION_PENDING") return payment.status==="Needs Clarification"?"present":"cleared";
  return "unknown";
}
async function event(c:PoolConnection,row:Row,role:Role,actor:string,key:string,requestHash:string,action:string,reason:ReasonCode,next:CaseState,assignedTo:string|null=row.assignedTo) {
  const version=Number(row.version)+1;
  const [changed]=await c.execute<ResultSetHeader>("UPDATE finance_exception_cases SET case_state=?,version=?,assigned_to=? WHERE case_id=? AND version=?",[next,version,assignedTo,row.id,row.version]);
  if(changed.affectedRows!==1) throw new AppError("Case changed",409,"EXCEPTION_VERSION_CONFLICT");
  await c.execute("INSERT INTO finance_exception_events(case_id,event_version,actor_id,actor_role,assigned_to,event_code,previous_state,next_state,reason_code,request_key,request_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3))",[row.id,version,actor,role,assignedTo,action,row.state,next,reason,key,requestHash]);
  return {id:row.id,version,state:next};
}
export function createFinanceExceptionRepository(pool?:Pool) {
  const db=()=>pool??getPool();
  async function create(input:{sourceType:SourceType;sourceId:string;code:ExceptionCode;requestKey:string},auth:AuthContext) {
    if (!/^[a-f0-9]{64}$/.test(input.requestKey)) throw new AppError("Invalid request key",422,"INVALID_EXCEPTION");
    const role=staff(auth), id=fingerprint(input.sourceType,input.sourceId,input.code), digest=hash(["create",auth.user.id,input.sourceType,input.sourceId,input.code]);
    try{return await withTransaction(async(c)=>{
      const [prior]=await c.execute<RowDataPacket[]>("SELECT request_hash AS digest,CAST(case_id AS CHAR) AS id FROM finance_exception_events WHERE request_key=? FOR UPDATE",[input.requestKey]);
      if(prior.length){if(prior[0].digest!==digest)throw new AppError("Request key conflict",409,"IDEMPOTENCY_CONFLICT");return {id:String(prior[0].id),replayed:true};}
      const condition=await sourceCondition(c,input.sourceType,input.sourceId,input.code);
      if(condition==="cleared")throw new AppError("Source condition is not present",409,"EXCEPTION_CONDITION_CLEARED");
      if(condition==="unknown" && ["MISSING_POSTING","DUPLICATE_POSTING","POSSIBLE_DUPLICATE","AMOUNT_MISMATCH","RECEIPT_FAILURE","CLARIFICATION_PENDING"].includes(input.code)) throw new AppError("Source condition is not eligible for detection",409,"EXCEPTION_CONDITION_UNVERIFIED");
      const [existing]=await c.execute<Row[]>(`${select} WHERE fingerprint=? FOR UPDATE`,[id]);
      if(existing.length) {
        const row=existing[0];
        if(row.state==="Closed" || row.state==="Resolved") {
          if(condition!=="present") throw new AppError("Condition requires renewed investigation",409,"EXCEPTION_CONDITION_UNVERIFIED");
          await event(c,row,role,auth.user.id,input.requestKey,digest,"redetected","CONDITION_RECURRED","Reopened");
        } else {
          await event(c,row,role,auth.user.id,input.requestKey,digest,"redetected","INVESTIGATION",row.state);
        }
        return {id:row.id,replayed:false};
      }
      const [insert]=await c.execute<ResultSetHeader>("INSERT INTO finance_exception_cases(fingerprint,source_type,source_id,exception_code,severity,case_state,created_by) VALUES(?,?,?,?,?,'Open',?)",[id,input.sourceType,input.sourceId,input.code,taxonomy[input.code],auth.user.id]);
      const caseId=String(insert.insertId);
      await c.execute("INSERT INTO finance_exception_events(case_id,event_version,actor_id,actor_role,event_code,previous_state,next_state,reason_code,request_key,request_hash,created_at) VALUES(?,1,?,?,'created',NULL,'Open','INVESTIGATION',?,?,UTC_TIMESTAMP(3))",[caseId,auth.user.id,role,input.requestKey,digest]);
      return {id:caseId,replayed:false};
    },db());}catch(error){if(["ER_DUP_ENTRY","ER_LOCK_DEADLOCK","ER_LOCK_WAIT_TIMEOUT"].includes((error as {code?:string}).code??""))throw new AppError("Case changed; retry request",409,"EXCEPTION_CONFLICT");throw error;}
  }
  async function act(id:string,input:{action:Action;reason:ReasonCode;expectedVersion:number;requestKey:string},auth:AuthContext){
    const role=staff(auth),digest=hash(["action",auth.user.id,id,input.action,input.reason,input.expectedVersion]);
    if (!/^[a-f0-9]{64}$/.test(input.requestKey)) throw new AppError("Invalid request key",422,"INVALID_EXCEPTION");
    return withTransaction(async(c)=>{
      const [rows]=await c.execute<Row[]>(`${select} WHERE case_id=? FOR UPDATE`,[id]);
      if(!rows.length)throw new AppError("Case not found",404,"EXCEPTION_NOT_FOUND");
      const [prior]=await c.execute<RowDataPacket[]>("SELECT request_hash AS digest,CAST(case_id AS CHAR) AS id,event_version AS version,next_state AS state FROM finance_exception_events WHERE request_key=? FOR UPDATE",[input.requestKey]);
      if(prior.length){if(prior[0].digest!==digest)throw new AppError("Request key conflict",409,"IDEMPOTENCY_CONFLICT");return {id:String(prior[0].id),version:Number(prior[0].version),state:prior[0].state,replayed:true};}
      const row=rows[0];if(Number(row.version)!==input.expectedVersion)throw new AppError("Case changed",409,"EXCEPTION_VERSION_CONFLICT");
      if(["Critical","High"].includes(row.severity) && ["resolve","close"].includes(input.action) && role!=="chairman")throw new AppError("Chairman review required",403,"FORBIDDEN");
      const condition=["resolve","close","reopen"].includes(input.action)?await sourceCondition(c,row.sourceType,row.sourceId,row.code):"unknown";
      const next=transition(row.state,input.action,role,input.reason,condition);
      return event(c,row,role,auth.user.id,input.requestKey,digest,input.action,input.reason,next);
    },db());
  }
  async function assign(id:string,input:{assignedTo:string;expectedVersion:number;requestKey:string},auth:AuthContext){
    const role=staff(auth);if(!/^[a-f0-9]{64}$/.test(input.requestKey) || !/^[1-9]\d{0,19}$/.test(input.assignedTo))throw new AppError("Invalid assignment",422,"INVALID_EXCEPTION");
    const digest=hash(["assign",auth.user.id,id,input.assignedTo,input.expectedVersion]);
    return withTransaction(async(c)=>{
      const [rows]=await c.execute<Row[]>(`${select} WHERE case_id=? FOR UPDATE`,[id]);
      if(!rows.length)throw new AppError("Case not found",404,"EXCEPTION_NOT_FOUND");
      const [prior]=await c.execute<RowDataPacket[]>("SELECT request_hash AS digest,CAST(case_id AS CHAR) AS id,event_version AS version,next_state AS state FROM finance_exception_events WHERE request_key=? FOR UPDATE",[input.requestKey]);
      if(prior.length){if(prior[0].digest!==digest)throw new AppError("Request key conflict",409,"IDEMPOTENCY_CONFLICT");return {id:String(prior[0].id),version:Number(prior[0].version),state:prior[0].state,replayed:true};}
      const row=rows[0];if(Number(row.version)!==input.expectedVersion || ["Resolved","Closed"].includes(row.state))throw new AppError("Case changed or closed",409,"EXCEPTION_VERSION_CONFLICT");
      if(row.state==="Escalated" && role!=="chairman")throw new AppError("Chairman review required",403,"FORBIDDEN");
      const [users]=await c.execute<RowDataPacket[]>("SELECT u.user_id FROM users u JOIN roles r ON r.role_id=u.role_id WHERE u.user_id=? AND u.account_status='Active' AND r.role_slug IN ('chairman','bookkeeper') FOR UPDATE",[input.assignedTo]);
      if(!users.length)throw new AppError("Assignee must be active financial staff",422,"INVALID_EXCEPTION_ASSIGNEE");
      return event(c,row,role,auth.user.id,input.requestKey,digest,"assigned","ASSIGNMENT",row.state,input.assignedTo);
    },db());
  }
  async function get(id:string,auth:AuthContext){staff(auth);const [rows]=await db().execute<Row[]>(`${select} WHERE case_id=?`,[id]);if(!rows.length)throw new AppError("Case not found",404,"EXCEPTION_NOT_FOUND");const [events]=await db().execute<RowDataPacket[]>("SELECT event_version AS version,CAST(actor_id AS CHAR) AS actorId,actor_role AS actorRole,CAST(assigned_to AS CHAR) AS assignedTo,event_code AS eventCode,previous_state AS previousState,next_state AS nextState,reason_code AS reasonCode,created_at AS createdAt FROM finance_exception_events WHERE case_id=? ORDER BY event_version",[id]);return {...rows[0],events};}
  async function list(page:number,pageSize:number,auth:AuthContext){staff(auth);const [rows]=await db().execute<Row[]>(`${select} ORDER BY updated_at DESC,case_id DESC LIMIT ? OFFSET ?`,[pageSize,(page-1)*pageSize]);return rows;}
  return {create,act,assign,get,list};
}
export type FinanceExceptionRepository=ReturnType<typeof createFinanceExceptionRepository>;
