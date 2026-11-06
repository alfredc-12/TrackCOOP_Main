import { createHash } from "node:crypto";
﻿import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { assessConfiguration, type PolicyRevision } from "../financial-policy/financial-policy.model";
import { evaluateBudgetWithinTransaction, withControlledBudget } from "../budgets/controlled-budget.guard";
import { isCapitalMovement, postedOperatingSql } from "./financial-posting-rules";
import { controlledDraftSchema, controlledDraftEditSchema, type ControlledDraftInput, type ControlledDraftEdit } from "./controlled-posting.schema";
import { assertControlledPostingInactive, decideApproval, evaluateControlledRecord, type ControlledRecord, type ControlledEvaluation, type ControlledState } from "./controlled-posting.model";

type RecordRow = RowDataPacket & ControlledRecord & { date: string; seasonId: string | null; recordNumber: string; memberId: string | null; remarks: string | null };
type OperationRow = RowDataPacket & { id: string; recordId: string; makerId: string; key: string; creationHash: string | null; state: ControlledState; version: number; thresholdVersion: number | null; restrictionVersion: number | null; budgetBasis: string | null; recordFingerprint: string | null; evidenceFingerprint: string | null };
type EvidenceVerifier = (connection: PoolConnection, record: ControlledRecord) => Promise<{ verified: boolean; fingerprint: string | null }>;
// PR 1E must supply independently verified source-bound evidence. No caller input is trusted.
const noEvidence: EvidenceVerifier = async () => ({ verified: false, fingerprint: null });
const opSelect = `SELECT CAST(operation_id AS CHAR) AS id, CAST(financial_record_id AS CHAR) AS recordId, CAST(maker_id AS CHAR) AS makerId, idempotency_key AS \`key\`, creation_hash AS creationHash, workflow_state AS state, version, threshold_version AS thresholdVersion, restriction_version AS restrictionVersion, budget_basis AS budgetBasis, record_fingerprint AS recordFingerprint, evidence_fingerprint AS evidenceFingerprint FROM finance_controlled_operations`;
function role(auth: AuthContext, allowed: "chairman" | "bookkeeper") {
  if (auth.user.role !== allowed) throw new AppError("Not authorized", 403, "FORBIDDEN");
}
async function lockControl(c: PoolConnection) {
  try {
    const [rows] = await c.execute<RowDataPacket[]>("SELECT mutex_id FROM budget_control_mutex WHERE mutex_id=1 FOR UPDATE");
    if (!rows.length) throw new Error("Missing controlled guard");
  } catch { throw new AppError("Controlled guard unavailable",503,"BUDGET_UNAVAILABLE"); }
}
async function recordForUpdate(c: PoolConnection, id: string): Promise<RecordRow> {
  const [rows] = await c.execute<RecordRow[]>(`SELECT CAST(r.financial_record_id AS CHAR) AS id, r.record_number AS recordNumber, CAST(r.member_id AS CHAR) AS memberId, r.remarks, CAST(r.recorded_by AS CHAR) AS makerId, r.record_type AS recordType, r.source_module AS sourceModule, CAST(r.source_record_id AS CHAR) AS sourceRecordId, CAST(r.payment_reference_id AS CHAR) AS paymentReferenceId, CAST(r.financial_category_id AS CHAR) AS categoryId, fc.is_active AS categoryActive, fc.category_type AS categoryType, fc.category_code AS categoryCode, fc.category_name AS categoryName, CAST(r.amount AS CHAR) AS amount, r.record_status AS recordStatus, CAST(r.approved_by AS CHAR) AS approvedBy, DATE_FORMAT(r.record_date,'%Y-%m-%d') AS date, CAST(r.season_id AS CHAR) AS seasonId FROM financial_records r LEFT JOIN financial_categories fc ON fc.financial_category_id=r.financial_category_id WHERE r.financial_record_id=? FOR UPDATE`, [id]);
  if (!rows[0]) throw new AppError("Financial record not found", 404, "FINANCIAL_RECORD_NOT_FOUND");
  return { ...rows[0], categoryActive: Boolean(rows[0].categoryActive) };
}
async function operationForUpdate(c: PoolConnection, id: string): Promise<OperationRow> {
  const [rows] = await c.execute<OperationRow[]>(`${opSelect} WHERE operation_id=? FOR UPDATE`, [id]);
  if (!rows[0]) throw new AppError("Operation not found", 404, "CONTROLLED_OPERATION_NOT_FOUND");
  return { ...rows[0], version: Number(rows[0].version) };
}
async function currentPolicies(c: PoolConnection): Promise<{ threshold: PolicyRevision | null; restrictions: PolicyRevision | null }> {
  try {
  const [heads] = await c.execute<RowDataPacket[]>("SELECT policy_kind AS kind,current_version AS version FROM finance_policy_heads ORDER BY policy_kind FOR UPDATE");
  const get = async (kind: "threshold" | "restrictions"): Promise<PolicyRevision | null> => {
    const v = Number(heads.find((row) => row.kind === kind)?.version ?? 0);
    if (!v) return null;
    const [rows] = await c.execute<RowDataPacket[]>(`SELECT policy_kind AS kind,version,state,configuration AS config,CAST(created_by AS CHAR) AS createdBy,CONCAT(DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%f'),'Z') AS createdAt,CAST(approved_by AS CHAR) AS approvedBy,IF(approved_at IS NULL,NULL,CONCAT(DATE_FORMAT(approved_at,'%Y-%m-%dT%H:%i:%s.%f'),'Z')) AS approvedAt,IF(effective_at IS NULL,NULL,CONCAT(DATE_FORMAT(effective_at,'%Y-%m-%dT%H:%i:%s.%f'),'Z')) AS effectiveAt FROM finance_policy_revisions WHERE policy_kind=? AND version=?`, [kind,v]);
    if (!rows[0]) throw new AppError("Policy configuration is unavailable", 503, "POLICY_CONFIGURATION_REQUIRED");
    const row = rows[0];
    return { ...row, version: Number(row.version), config: typeof row.config === "string" ? JSON.parse(row.config) : row.config } as PolicyRevision;
  };
  return { threshold: await get("threshold"), restrictions: await get("restrictions") };
  } catch { throw new AppError("Policy configuration is unavailable",503,"POLICY_CONFIGURATION_REQUIRED"); }
}
async function writeEvent(c: PoolConnection, op: OperationRow, actor: string, event: string, state: ControlledState, reason: string | null, evaluation?: ControlledEvaluation, fingerprints?: { record: string | null; evidence: string | null }) {
  const version = op.version + 1;
  const [update] = await c.execute<ResultSetHeader>(`UPDATE finance_controlled_operations SET workflow_state=?,version=?,threshold_version=?,restriction_version=?,budget_basis=?,record_fingerprint=?,evidence_fingerprint=? WHERE operation_id=? AND version=?`, [state,version,evaluation ? evaluation.thresholdVersion : op.thresholdVersion,evaluation ? evaluation.restrictionVersion : op.restrictionVersion,evaluation ? evaluation.budgetBasis : op.budgetBasis,fingerprints ? fingerprints.record : op.recordFingerprint,fingerprints ? fingerprints.evidence : op.evidenceFingerprint,op.id,op.version]);
  if (update.affectedRows !== 1) throw new AppError("Operation changed", 409, "CONTROLLED_OPERATION_CONFLICT");
  await c.execute("INSERT INTO finance_controlled_operation_events(operation_id,operation_version,actor_id,event_type,previous_state,next_state,reason,created_at) VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP(3))", [op.id,version,actor,event,op.state,state,reason]);
  await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,new_values,action_time) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP())", [actor,`controlled_finance.${event}`,"finance_controlled_operations",op.id,"Controlled finance workflow changed",JSON.stringify({ version, from: op.state, to: state, reason }),]);
  return { id: op.id, version, state };
}
// The application router always uses the inactive default. The injected gate exists
// solely for isolated synthetic integration tests; no runtime setting enables it.
export function createControlledPostingRepository(pool?: Pool, verifyEvidence: EvidenceVerifier = noEvidence, fixtureGate: () => boolean = () => false) {
  const db = () => pool ?? getPool();
  const fixtureEnabled = () => process.env.NODE_ENV === "test" && fixtureGate();
  async function evaluate(c: PoolConnection, op: OperationRow, expected?: { threshold: number; restrictions: number }) {
    const policies = await currentPolicies(c);
    const record = await recordForUpdate(c, op.recordId);
    if (record.makerId !== op.makerId) throw new AppError("Record ownership changed", 409, "CONTROLLED_REEVALUATION_REQUIRED");
    const evidence = await verifyEvidence(c, record);
    const evidenceVerified = evidence.verified && typeof evidence.fingerprint === "string" && /^[a-f0-9]{64}$/.test(evidence.fingerprint);
    const fingerprint = createHash("sha256").update(JSON.stringify([record.id,record.makerId,record.recordNumber,record.memberId,record.remarks,record.recordType,record.sourceModule,record.sourceRecordId,record.paymentReferenceId,record.categoryId,record.categoryActive,record.categoryType,record.categoryCode,record.categoryName,record.seasonId,record.date,record.amount,record.recordStatus,record.approvedBy])).digest("hex");
    let budget: { state: string; blocked: boolean; basis: string | null } | null = null;
    if (record.recordType === "Expense" && evidenceVerified && assessConfiguration(policies.threshold, policies.restrictions, new Date(), expected).configurationComplete) {
      const checked = await evaluateBudgetWithinTransaction(c, { date: record.date, categoryId: record.categoryId, seasonId: record.seasonId, amount: record.amount });
      budget = { state: checked.evaluation.state, blocked: checked.evaluation.blocked, basis: checked.basis };
    }
    return { decision: evaluateControlledRecord({ record, evidenceVerified, ...policies, expectedPolicy: expected, budget, now: new Date() }), fingerprints: { record: fingerprint, evidence: evidenceVerified ? evidence.fingerprint : null } };
  }
  async function create(recordId: string, key: string, auth: AuthContext) {
    role(auth, "bookkeeper");
    if (!/^[1-9]\d{0,19}$/.test(recordId) || !/^[a-f0-9]{64}$/.test(key)) throw new AppError("Invalid controlled request",422,"INVALID_CONTROLLED_REQUEST");
    try { return await withTransaction(async (c) => {
      await lockControl(c);
      const record = await recordForUpdate(c, recordId);
      if (record.makerId !== auth.user.id || record.approvedBy || record.recordStatus !== "Active" || record.sourceModule !== "Manual" || record.sourceRecordId || record.paymentReferenceId || record.memberId) throw new AppError("Record is not an eligible owned manual draft", 409, "CONTROLLED_SOURCE_INVALID");
      const [previous] = await c.execute<OperationRow[]>(`${opSelect} WHERE idempotency_key=? FOR UPDATE`, [key]);
      if (previous.length) {
        if (previous[0].recordId !== recordId || previous[0].makerId !== auth.user.id) throw new AppError("Idempotency conflict", 409, "IDEMPOTENCY_CONFLICT");
        return { id: previous[0].id, version: Number(previous[0].version), state: previous[0].state };
      }
      const [result] = await c.execute<ResultSetHeader>("INSERT INTO finance_controlled_operations(financial_record_id,maker_id,idempotency_key,workflow_state,version,created_at,updated_at) VALUES(?,?,?,'DRAFT',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))", [recordId,auth.user.id,key]);
      const id = String(result.insertId);
      await c.execute("INSERT INTO finance_controlled_operation_events(operation_id,operation_version,actor_id,event_type,previous_state,next_state,created_at) VALUES(?,1,?,'created',NULL,'DRAFT',UTC_TIMESTAMP(3))", [id,auth.user.id]);
      await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,action_time) VALUES(?,'controlled_finance.created','finance_controlled_operations',?,'Controlled finance draft created',UTC_TIMESTAMP())", [auth.user.id,id]);
      return { id, version: 1, state: "DRAFT" as const };
    }, db()); } catch (error) {
      if (["ER_DUP_ENTRY", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes((error as { code?: string }).code ?? "")) throw new AppError("Operation conflicts with an existing request", 409, "CONTROLLED_OPERATION_CONFLICT");
      throw error;
    }
  }
  async function createDraft(input: ControlledDraftInput, auth: AuthContext) {
    role(auth,"bookkeeper");
    if (!fixtureEnabled()) return assertControlledPostingInactive();
    const parsed = controlledDraftSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid controlled draft",422,"INVALID_CONTROLLED_REQUEST");
    const data = parsed.data;
    const hash = createHash("sha256").update(JSON.stringify([auth.user.id,data.recordNumber,data.categoryId,data.recordType,data.amount,data.date,data.seasonId,data.remarks])).digest("hex");
    try { return await withTransaction(async (c) => {
      await lockControl(c);
      const [previous] = await c.execute<OperationRow[]>(`${opSelect} WHERE idempotency_key=? FOR UPDATE`,[data.idempotencyKey]);
      if (previous.length) {
        if (previous[0].makerId !== auth.user.id || previous[0].creationHash !== hash) throw new AppError("Idempotency conflict",409,"IDEMPOTENCY_CONFLICT");
        return { id: previous[0].id, recordId: previous[0].recordId, version: Number(previous[0].version), state: previous[0].state };
      }
      const [categories] = await c.execute<RowDataPacket[]>("SELECT category_type AS type,is_active AS active FROM financial_categories WHERE financial_category_id=? FOR UPDATE",[data.categoryId]);
      if (!categories[0] || !categories[0].active || ![data.recordType,"Both"].includes(categories[0].type)) throw new AppError("Category is unavailable or incompatible",422,"INVALID_FINANCIAL_CATEGORY");
      const [record] = await c.execute<ResultSetHeader>(`INSERT INTO financial_records(record_number,payment_reference_id,member_id,financial_category_id,recorded_by,approved_by,record_type,source_module,source_record_id,season_id,amount,record_date,record_status,remarks) VALUES(?,NULL,NULL,?,?,NULL,?,'Manual',NULL,?,?,?,'Active',?)`,[data.recordNumber,data.categoryId,auth.user.id,data.recordType,data.seasonId,data.amount,data.date,data.remarks]);
      const recordId=String(record.insertId);
      const [operation] = await c.execute<ResultSetHeader>("INSERT INTO finance_controlled_operations(financial_record_id,maker_id,idempotency_key,creation_hash,workflow_state,version,created_at,updated_at) VALUES(?,?,?,?,'DRAFT',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[recordId,auth.user.id,data.idempotencyKey,hash]);
      const id=String(operation.insertId);
      await c.execute("INSERT INTO finance_controlled_operation_events(operation_id,operation_version,actor_id,event_type,previous_state,next_state,created_at) VALUES(?,1,?,'created',NULL,'DRAFT',UTC_TIMESTAMP(3))",[id,auth.user.id]);
      await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,new_values,action_time) VALUES(?,'controlled_finance.draft_created','finance_controlled_operations',?,'Controlled finance draft created',?,UTC_TIMESTAMP())",[auth.user.id,id,JSON.stringify({recordId})]);
      return { id, recordId, version:1, state:"DRAFT" as const };
    },db()); } catch(error) {
      if (["ER_DUP_ENTRY","ER_LOCK_DEADLOCK","ER_LOCK_WAIT_TIMEOUT"].includes((error as {code?:string}).code ?? "")) throw new AppError("Draft conflicts with an existing request",409,"CONTROLLED_OPERATION_CONFLICT");
      throw error;
    }
  }
  async function editDraft(id: string, expectedVersion: number, input: ControlledDraftEdit, auth: AuthContext) {
    role(auth,"bookkeeper");
    if (!fixtureEnabled()) return assertControlledPostingInactive();
    const parsed=controlledDraftEditSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid controlled draft",422,"INVALID_CONTROLLED_REQUEST");
    const data=parsed.data;
    try { return await withTransaction(async (c) => {
      await lockControl(c);
      const op=await operationForUpdate(c,id);
      if (op.makerId!==auth.user.id) throw new AppError("Not authorized",403,"FORBIDDEN");
      if (op.version!==expectedVersion || ["POSTED","CORRECTION_REQUESTED"].includes(op.state)) throw new AppError("Operation changed or is locked",409,"CONTROLLED_OPERATION_CONFLICT");
      const previous=await recordForUpdate(c,op.recordId);
      if (previous.makerId!==op.makerId || previous.approvedBy || previous.recordStatus!=="Active" || previous.sourceModule!=="Manual" || previous.sourceRecordId || previous.paymentReferenceId || previous.memberId) throw new AppError("Record changed or is not a manual draft",409,"CONTROLLED_SOURCE_INVALID");
      const [categories]=await c.execute<RowDataPacket[]>("SELECT category_type AS type,is_active AS active FROM financial_categories WHERE financial_category_id=? FOR UPDATE",[data.categoryId]);
      if (!categories[0] || !categories[0].active || ![data.recordType,"Both"].includes(categories[0].type)) throw new AppError("Category is unavailable or incompatible",422,"INVALID_FINANCIAL_CATEGORY");
      const [changed]=await c.execute<ResultSetHeader>("UPDATE financial_records SET record_number=?,financial_category_id=?,record_type=?,season_id=?,amount=?,record_date=?,remarks=? WHERE financial_record_id=? AND approved_by IS NULL AND record_status='Active' AND source_module='Manual' AND source_record_id IS NULL AND payment_reference_id IS NULL AND member_id IS NULL",[data.recordNumber,data.categoryId,data.recordType,data.seasonId,data.amount,data.date,data.remarks,op.recordId]);
      if (changed.affectedRows!==1) throw new AppError("Record changed",409,"CONTROLLED_OPERATION_CONFLICT");
      const cleared:ControlledEvaluation={state:"DRAFT",code:"DRAFT_EDITED",configurationCode:null,thresholdVersion:null,restrictionVersion:null,budgetBasis:null};
      const result=await writeEvent(c,op,auth.user.id,"edited","DRAFT",null,cleared,{record:null,evidence:null});
      await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,old_values,new_values,action_time) VALUES(?,'controlled_finance.draft_edited','financial_records',?,'Controlled finance draft edited',?,?,UTC_TIMESTAMP())",[auth.user.id,op.recordId,JSON.stringify({categoryId:previous.categoryId,recordType:previous.recordType,amount:previous.amount,date:previous.date,seasonId:previous.seasonId}),JSON.stringify({categoryId:data.categoryId,recordType:data.recordType,amount:data.amount,date:data.date,seasonId:data.seasonId})]);
      return result;
    },db()); } catch(error) {
      if (["ER_DUP_ENTRY","ER_LOCK_DEADLOCK","ER_LOCK_WAIT_TIMEOUT"].includes((error as {code?:string}).code ?? "")) throw new AppError("Draft conflicts with an existing request",409,"CONTROLLED_OPERATION_CONFLICT");
      throw error;
    }
  }
  async function refresh(id: string, expectedVersion: number, auth: AuthContext) {
    role(auth, "bookkeeper");
    return withTransaction(async (c) => {
      await lockControl(c);
      const op = await operationForUpdate(c,id);
      if (op.makerId !== auth.user.id) throw new AppError("Not authorized", 403, "FORBIDDEN");
      if (op.version !== expectedVersion || ["POSTED", "CORRECTION_REQUESTED"].includes(op.state)) throw new AppError("Operation changed or is locked", 409, "CONTROLLED_OPERATION_CONFLICT");
      const result = await evaluate(c,op);
      const updated=await writeEvent(c,op,auth.user.id,"evaluated",result.decision.state,null,result.decision,result.fingerprints);
      return { ...updated, code: result.decision.code, configurationCode: result.decision.configurationCode };
    }, db());
  }
  async function decide(id: string, expectedVersion: number, decision: "approve" | "reject", reason: string, auth: AuthContext) {
    role(auth, "chairman");
    return withTransaction(async (c) => {
      await lockControl(c);
      const op = await operationForUpdate(c,id);
      const expected = op.thresholdVersion !== null && op.restrictionVersion !== null ? { threshold: op.thresholdVersion, restrictions: op.restrictionVersion } : undefined;
      const current = await evaluate(c,op,expected);
      if (op.recordFingerprint !== current.fingerprints.record || op.evidenceFingerprint !== current.fingerprints.evidence) throw new AppError("Record or evidence changed; reevaluate", 409, "CONTROLLED_REEVALUATION_REQUIRED");
      const next = decideApproval(op,expectedVersion,{ id:auth.user.id,role:auth.user.role },decision,reason,current.decision);
      return writeEvent(c,op,auth.user.id,decision,next,reason.trim(),current.decision,current.fingerprints);
    }, db());
  }
  async function requestLegacyCorrection(recordId: string, key: string, reason: string, auth: AuthContext) {
    role(auth,"bookkeeper");
    if (!/^[1-9]\d{0,19}$/.test(recordId) || !/^[a-f0-9]{64}$/.test(key)) throw new AppError("Invalid controlled request",422,"INVALID_CONTROLLED_REQUEST");
    if (!reason.trim() || reason.trim().length > 2000) throw new AppError("A reason is required",422,"DECISION_REASON_REQUIRED");
    const hash=createHash("sha256").update(JSON.stringify(["correction",auth.user.id,recordId,reason.trim()])).digest("hex");
    try { return await withTransaction(async (c) => {
      await lockControl(c);
      const record=await recordForUpdate(c,recordId);
      if (!record.approvedBy || record.recordStatus!=="Active" || record.sourceModule!=="Manual" || record.sourceRecordId || record.paymentReferenceId || record.memberId || isCapitalMovement(record)) throw new AppError("Source-specific correction is required",409,"CONTROLLED_SOURCE_INVALID");
      const [previous]=await c.execute<OperationRow[]>(`${opSelect} WHERE idempotency_key=? FOR UPDATE`,[key]);
      if (previous.length) {
        if (previous[0].makerId!==auth.user.id || previous[0].recordId!==recordId || previous[0].creationHash!==hash) throw new AppError("Idempotency conflict",409,"IDEMPOTENCY_CONFLICT");
        return {id:previous[0].id,version:Number(previous[0].version),state:previous[0].state};
      }
      const [created]=await c.execute<ResultSetHeader>("INSERT INTO finance_controlled_operations(financial_record_id,maker_id,idempotency_key,creation_hash,workflow_state,version,created_at,updated_at) VALUES(?,?,?,?,'CORRECTION_REQUESTED',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[recordId,auth.user.id,key,hash]);
      const id=String(created.insertId);
      await c.execute("INSERT INTO finance_controlled_operation_events(operation_id,operation_version,actor_id,event_type,previous_state,next_state,reason,created_at) VALUES(?,1,?,'correction_requested',NULL,'CORRECTION_REQUESTED',?,UTC_TIMESTAMP(3))",[id,auth.user.id,reason.trim()]);
      await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,new_values,action_time) VALUES(?,'controlled_finance.correction_requested','finance_controlled_operations',?,'Manual correction requested',?,UTC_TIMESTAMP())",[auth.user.id,id,JSON.stringify({recordId,reason:reason.trim()})]);
      return {id,version:1,state:"CORRECTION_REQUESTED" as const};
    },db()); } catch(error) {
      if (["ER_DUP_ENTRY","ER_LOCK_DEADLOCK","ER_LOCK_WAIT_TIMEOUT"].includes((error as {code?:string}).code ?? "")) throw new AppError("Correction conflicts with an existing operation",409,"CONTROLLED_OPERATION_CONFLICT");
      throw error;
    }
  }
  async function requestCorrection(id: string, expectedVersion: number, reason: string, auth: AuthContext) {
    role(auth, "bookkeeper");
    if (!reason.trim() || reason.trim().length > 2000) throw new AppError("A reason is required",422,"DECISION_REASON_REQUIRED");
    return withTransaction(async (c) => {
      await lockControl(c);
      const op = await operationForUpdate(c,id);
      if (op.makerId !== auth.user.id) throw new AppError("Not authorized",403,"FORBIDDEN");
      if (op.version !== expectedVersion || op.state !== "POSTED") throw new AppError("Operation changed or is not posted",409,"CONTROLLED_OPERATION_CONFLICT");
      const record = await recordForUpdate(c,op.recordId);
      if (!record.approvedBy || record.recordStatus !== "Active" || record.sourceModule !== "Manual" || record.sourceRecordId || record.paymentReferenceId || record.memberId || isCapitalMovement(record)) throw new AppError("Source-specific correction is required",409,"CONTROLLED_SOURCE_INVALID");
      return writeEvent(c,op,auth.user.id,"correction_requested","CORRECTION_REQUESTED",reason.trim());
    },db());
  }
  async function get(id: string, auth: AuthContext) {
    if (!["chairman", "bookkeeper"].includes(auth.user.role)) throw new AppError("Not authorized", 403, "FORBIDDEN");
    const [rows] = await db().execute<OperationRow[]>(`${opSelect} WHERE operation_id=?`, [id]);
    if (!rows[0]) throw new AppError("Operation not found", 404, "CONTROLLED_OPERATION_NOT_FOUND");
    const [events] = await db().execute<RowDataPacket[]>("SELECT operation_version AS version,CAST(actor_id AS CHAR) AS actorId,event_type AS eventType,previous_state AS previousState,next_state AS nextState,reason,created_at AS createdAt FROM finance_controlled_operation_events WHERE operation_id=? ORDER BY operation_version", [id]);
    const op = rows[0];
    return { id: op.id, recordId: op.recordId, makerId: op.makerId, state: op.state, version: Number(op.version), lifecycle: "Inactive" as const, postingEnabled: false, events };
  }
  async function post(id: string, expectedVersion: number, operationKey: string, auth: AuthContext) {
    role(auth, "bookkeeper");
    if (!fixtureEnabled()) return assertControlledPostingInactive();
    const [ops] = await db().execute<OperationRow[]>(`${opSelect} WHERE operation_id=?`, [id]);
    if (!ops[0]) throw new AppError("Operation not found", 404, "CONTROLLED_OPERATION_NOT_FOUND");
    const initial = ops[0];
    if (!["ROUTINE_POST_ELIGIBLE", "APPROVED_FOR_POSTING", "POSTED"].includes(initial.state)) throw new AppError("Operation is not postable", 409, "CONTROLLED_OPERATION_CONFLICT");
    const [rows] = await db().execute<RowDataPacket[]>(`SELECT DATE_FORMAT(record_date,'%Y-%m-%d') AS date,CAST(financial_category_id AS CHAR) AS categoryId,CAST(season_id AS CHAR) AS seasonId,CAST(amount AS CHAR) AS amount,record_type AS recordType FROM financial_records WHERE financial_record_id=?`, [initial.recordId]);
    const record = rows[0];
    if (!record || !["Expense", "Income"].includes(record.recordType)) throw new AppError("Only guarded manual income or expenses are supported",409,"CONTROLLED_SOURCE_INVALID");
    if (!/^[a-f0-9]{64}$/.test(operationKey)) throw new AppError("Invalid idempotency key",422,"INVALID_CONTROLLED_REQUEST");
    const commit = async (c: PoolConnection) => {
      const op = await operationForUpdate(c,id);
      if (op.version !== expectedVersion || !["ROUTINE_POST_ELIGIBLE", "APPROVED_FOR_POSTING"].includes(op.state)) throw new AppError("Operation changed",409,"CONTROLLED_OPERATION_CONFLICT");
      if (op.thresholdVersion === null || op.restrictionVersion === null) throw new AppError("Approved policy versions are required",409,"POLICY_CONFIGURATION_REQUIRED");
      const expected = { threshold: op.thresholdVersion, restrictions: op.restrictionVersion };
      const current = await evaluate(c,op,expected);
      const required = op.state === "APPROVED_FOR_POSTING" ? "PENDING_APPROVAL" : "ROUTINE_POST_ELIGIBLE";
      if (current.decision.state !== required || current.decision.budgetBasis !== op.budgetBasis || current.fingerprints.record !== op.recordFingerprint || current.fingerprints.evidence !== op.evidenceFingerprint) throw new AppError("Record, policy, budget or evidence changed",409,"CONTROLLED_REEVALUATION_REQUIRED");
      let approver = auth.user.id;
      if (op.state === "APPROVED_FOR_POSTING") {
        const [events] = await c.execute<RowDataPacket[]>("SELECT CAST(actor_id AS CHAR) AS actor FROM finance_controlled_operation_events WHERE operation_id=? AND operation_version=? AND event_type='approve' AND next_state='APPROVED_FOR_POSTING'", [op.id,op.version]);
        if (!events[0] || events[0].actor === op.makerId) throw new AppError("Independent approval is required",409,"CONTROLLED_APPROVAL_REQUIRED");
        approver = String(events[0].actor);
      }
      const [changed] = await c.execute<ResultSetHeader>("UPDATE financial_records SET approved_by=? WHERE financial_record_id=? AND approved_by IS NULL AND record_status='Active' AND record_type=? AND source_module='Manual' AND source_record_id IS NULL AND payment_reference_id IS NULL AND member_id IS NULL", [approver,op.recordId,record.recordType]);
      if (changed.affectedRows !== 1) throw new AppError("Financial record changed",409,"CONTROLLED_OPERATION_CONFLICT");
      const [eligibility] = await c.execute<RowDataPacket[]>(`SELECT (${postedOperatingSql("fr", "fc")}) AS eligible FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id=fr.financial_category_id WHERE fr.financial_record_id=?`, [op.recordId]);
      if (!eligibility[0]?.eligible) throw new AppError("Financial record is not eligible for operating posting",409,"CONTROLLED_SOURCE_INVALID");
      await writeEvent(c,op,auth.user.id,"posted","POSTED",null,current.decision,current.fingerprints);
      await c.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,action_time) VALUES(?,'controlled_finance.posted','financial_records',?,'Controlled financial record posted',UTC_TIMESTAMP())", [auth.user.id,op.recordId]);
      return op.recordId;
    };
    if (record.recordType === "Expense") {
      if (!initial.budgetBasis) throw new AppError("An approved budget line and a fresh evaluation are required",409,"UNBUDGETED");
      return withControlledBudget(db(), { date: record.date, categoryId: record.categoryId, seasonId: record.seasonId, amount: record.amount, expectedBasis: initial.budgetBasis, operationKey, actorId: auth.user.id, subjectId: id }, commit);
    }
    const requestHash = createHash("sha256").update(JSON.stringify([id,expectedVersion,auth.user.id,record.date,record.categoryId,record.amount,"Income"])).digest("hex");
    return withTransaction(async (c) => {
      const [mutex] = await c.execute<RowDataPacket[]>("SELECT mutex_id FROM budget_control_mutex WHERE mutex_id=1 FOR UPDATE");
      if (!mutex.length) throw new AppError("Controlled guard unavailable",503,"BUDGET_UNAVAILABLE");
      const [prior] = await c.execute<RowDataPacket[]>("SELECT request_hash AS requestHash,operation_reference AS operationReference FROM budget_guard_operations WHERE operation_key=?", [operationKey]);
      if (prior.length) {
        if (prior[0].requestHash !== requestHash) throw new AppError("Idempotency conflict",409,"IDEMPOTENCY_CONFLICT");
        return { state: "REPLAY" as const, operationReference: String(prior[0].operationReference) };
      }
      const operationReference = await commit(c);
      await c.execute("INSERT INTO budget_guard_operations(operation_key,request_hash,operation_reference) VALUES(?,?,?)", [operationKey,requestHash,operationReference]);
      return { state: "POSTED" as const, operationReference };
    }, db());
  }
  return { create, createDraft, editDraft, refresh, decide, requestLegacyCorrection, requestCorrection, get, post };
}
export type ControlledPostingRepository = ReturnType<typeof createControlledPostingRepository>;
