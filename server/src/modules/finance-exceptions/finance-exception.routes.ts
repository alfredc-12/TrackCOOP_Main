import { Router } from "express";
import { z,ZodError } from "zod";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService,type AuthService } from "../auth/auth.service";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/app-error";
import { sendSuccess } from "../../utils/response";
import { taxonomy,reasonCodes } from "./finance-exception.model";
import { createFinanceExceptionRepository,type FinanceExceptionRepository } from "./finance-exception.repository";
const id=z.string().regex(/^[1-9]\d{0,19}$/),key=z.string().regex(/^[a-f0-9]{64}$/);
const create=z.object({sourceType:z.enum(["payment_reference","financial_record","controlled_operation"]),sourceId:id,code:z.enum(Object.keys(taxonomy) as [keyof typeof taxonomy,...Array<keyof typeof taxonomy>]),requestKey:key}).strict();
const action=z.object({action:z.enum(["review","await_evidence","escalate","resolve","close","reopen"]),reason:z.enum(reasonCodes),expectedVersion:z.number().int().positive().max(4294967294),requestKey:key}).strict();
function parse<T>(fn:()=>T):T{try{return fn();}catch(e){if(e instanceof ZodError)throw new AppError("Invalid exception request",422,"INVALID_EXCEPTION");throw e;}}
export function createFinanceExceptionRouter(auth:AuthService=createAuthService(),repo:FinanceExceptionRepository=createFinanceExceptionRepository()){
 const router=Router(),staff=[createAuthenticate(auth),requireRoles("chairman","bookkeeper")];
 router.use("/finance/exceptions",(_req,res,next)=>{res.setHeader("Cache-Control","private, no-store");next();});
 router.post("/finance/exceptions",...staff,asyncHandler(async(req,res)=>sendSuccess(res,await repo.create(parse(()=>create.parse(req.body)),req.auth!),{statusCode:201})));
 router.get("/finance/exceptions",...staff,asyncHandler(async(req,res)=>{const q=parse(()=>z.object({page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25)}).strict().parse(req.query));return sendSuccess(res,await repo.list(q.page,q.pageSize,req.auth!));}));
 router.get("/finance/exceptions/:id",...staff,asyncHandler(async(req,res)=>sendSuccess(res,await repo.get(parse(()=>id.parse(req.params.id)),req.auth!))));
 router.post("/finance/exceptions/:id/assign",...staff,asyncHandler(async(req,res)=>{const body=parse(()=>z.object({assignedTo:id,expectedVersion:z.number().int().positive().max(4294967294),requestKey:key}).strict().parse(req.body));return sendSuccess(res,await repo.assign(parse(()=>id.parse(req.params.id)),body,req.auth!));}));
 router.post("/finance/exceptions/:id/actions",...staff,asyncHandler(async(req,res)=>sendSuccess(res,await repo.act(parse(()=>id.parse(req.params.id)),parse(()=>action.parse(req.body)),req.auth!))));
 return router;
}
