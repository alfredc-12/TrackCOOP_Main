import { Router } from "express";
import multer from "multer";
import { z,ZodError } from "zod";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { authorizedUserFromAuth } from "../records/records-auth";
import { getDocumentFile } from "../records/document-service";
import type { AuthService } from "../auth/auth.service";
import type { createManualEvidenceWorkflow } from "./manual-evidence-workflow.service";
import type { createManualEvidenceRepository } from "./manual-evidence.repository";

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1}});
const id=z.string().regex(/^[1-9]\d{0,19}$/),key=z.string().regex(/^[a-f0-9]{64}$/);
function parse<T>(fn:()=>T):T {try{return fn();}catch(e){if(e instanceof ZodError)throw new AppError("Invalid evidence request",422,"INVALID_EVIDENCE_REQUEST");throw e;}}

/** Fixture-enabled router. Never mounted by the production app until rollout gates pass. */
export function createManualEvidenceRouter(auth:AuthService,workflow:ReturnType<typeof createManualEvidenceWorkflow>,repo:ReturnType<typeof createManualEvidenceRepository>) {
 const router=Router(),staff=[createAuthenticate(auth),requireRoles("bookkeeper","chairman")],maker=[createAuthenticate(auth),requireRoles("bookkeeper")];
 router.use("/finance/manual-expenses",(_req,res,next)=>{res.setHeader("Cache-Control","private, no-store");next();});
 router.post("/finance/manual-expenses/:id/evidence",...maker,upload.single("file"),asyncHandler(async(req,res)=>{
  if(!req.file)throw new AppError("Evidence file required",422,"INVALID_EVIDENCE_FILE");
  const body=parse(()=>z.object({requestKey:key,replaceLinkId:id.optional(),expectedVersion:z.coerce.number().int().positive().optional(),reason:z.string().trim().min(1).max(2000).optional()}).strict().parse(req.body));
  const replacement=body.replaceLinkId && body.expectedVersion && body.reason ? {linkId:body.replaceLinkId,version:body.expectedVersion,reason:body.reason}:undefined;
  if(Boolean(body.replaceLinkId || body.expectedVersion || body.reason)!==Boolean(replacement))throw new AppError("Invalid replacement",422,"INVALID_EVIDENCE_REQUEST");
  const f=req.file;return sendSuccess(res,await workflow.upload(parse(()=>id.parse(req.params.id)),body.requestKey,{name:f.originalname,size:f.size,type:f.mimetype,arrayBuffer:async()=>Uint8Array.from(f.buffer).buffer},req.auth!,replacement),{statusCode:201});
 }));
 router.get("/finance/manual-expenses/:id/evidence",...staff,asyncHandler(async(req,res)=>sendSuccess(res,await repo.list(parse(()=>id.parse(req.params.id)),req.auth!))));
 router.get("/finance/manual-expenses/:id/evidence/history",...staff,asyncHandler(async(req,res)=>sendSuccess(res,await repo.history(parse(()=>id.parse(req.params.id)),req.auth!))));
 router.post("/finance/manual-expenses/:id/evidence/:linkId/revoke",...maker,asyncHandler(async(req,res)=>{
  const body=parse(()=>z.object({version:z.number().int().positive(),reason:z.string().trim().min(1).max(2000),requestKey:key}).strict().parse(req.body));
  return sendSuccess(res,await repo.revoke(parse(()=>id.parse(req.params.id)),parse(()=>id.parse(req.params.linkId)),body.version,body.reason,body.requestKey,req.auth!));
 }));
 router.get("/finance/manual-expenses/:id/evidence/:documentId/file",...staff,asyncHandler(async(req,res)=>{
  const recordId=parse(()=>id.parse(req.params.id)),documentId=parse(()=>id.parse(req.params.documentId));
  const links=await repo.list(recordId,req.auth!);if(!links.some(link=>link.documentId===documentId && link.status==="ACTIVE"))throw new AppError("Evidence not found",404,"EVIDENCE_NOT_FOUND");
  const file=await getDocumentFile(documentId,authorizedUserFromAuth(req.auth!),"Download",undefined,req.auth!);
  res.setHeader("Content-Type",file.mimeType);res.setHeader("Content-Disposition",`attachment; filename="${file.fileName.replace(/[\r\n"]/g,"")}"`);return res.send(file.contents);
 }));
 router.get("/finance/manual-expenses/:id/evidence/:documentId/verify",...staff,asyncHandler(async(req,res)=>{
  const recordId=parse(()=>id.parse(req.params.id)),documentId=parse(()=>id.parse(req.params.documentId));
  const links=await repo.list(recordId,req.auth!);if(!links.some(link=>link.documentId===documentId && link.status==="ACTIVE"))throw new AppError("Evidence not found",404,"EVIDENCE_NOT_FOUND");
  await getDocumentFile(documentId,authorizedUserFromAuth(req.auth!),"Preview",undefined,req.auth!);
  return sendSuccess(res,{status:"VERSION_BYTES_MATCH",financialPostingVerified:false});
 }));
 return router;
}
