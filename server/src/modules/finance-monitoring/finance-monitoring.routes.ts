import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { AppError } from "../../utils/app-error";
import { createAuthService,type AuthService } from "../auth/auth.service";
import { createFinanceMonitoringService,type FinanceMonitoringService } from "./finance-monitoring.service";
import { financeFilterSchema,dateScope,validateFinanceKind } from "./finance-monitoring.schema";
export function createFinanceMonitoringRouter(auth:AuthService=createAuthService(),service:FinanceMonitoringService=createFinanceMonitoringService()){
 const router=Router(),staff=[createAuthenticate(auth),requireRoles('chairman','bookkeeper')];
 const parse=(input:unknown,kind?:"payments"|"capital")=>{const result=financeFilterSchema.safeParse(input);if(!result.success)throw new AppError('Finance filters are invalid.',422,'FINANCE_FILTERS',result.error.issues.map(i=>({code:'VALIDATION_ERROR',field:i.path.join('.'),message:i.message})));dateScope(result.data);return kind?validateFinanceKind(result.data,kind):result.data;};
 router.get('/finance-monitoring/payment/:id',...staff,asyncHandler(async(req,res)=>{const id=String(req.params.id);if(!/^\d{1,20}$/.test(id))throw new AppError('Invalid payment ID.',422,'FINANCE_FILTERS');const diagnostics=await service.paymentDiagnostics(id);if(!diagnostics)throw new AppError('Payment reference was not found.',404,'PAYMENT_REFERENCE_NOT_FOUND');return sendSuccess(res,diagnostics);}));
 router.get('/finance-monitoring/options',...staff,asyncHandler(async(_req,res)=>sendSuccess(res,await service.options())));
 router.get('/finance-monitoring/schema',...staff,asyncHandler(async(_req,res)=>sendSuccess(res,await service.schema())));
 for(const kind of ['payments','capital'] as const){
  router.get(`/finance-monitoring/${kind}/export`,...staff,asyncHandler(async(req,res)=>{const bytes=await service.export(kind,parse(req.query,kind));res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="trackcoop-${kind}-monitoring.xlsx"`);res.send(bytes);}));
  router.get(`/finance-monitoring/${kind}`,...staff,asyncHandler(async(req,res)=>sendSuccess(res,await service[kind](parse(req.query,kind)))));
 }
 router.get('/finance-monitoring/capital/accounts',...staff,asyncHandler(async(req,res)=>sendSuccess(res,await service.accounts(parse(req.query,'capital')))));
 router.get('/finance-monitoring/capital/transactions',...staff,asyncHandler(async(req,res)=>sendSuccess(res,await service.transactions(parse(req.query,'capital')))));
 return router;
}
