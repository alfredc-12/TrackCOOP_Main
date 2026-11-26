import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService,type AuthService } from "../auth/auth.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { AppError } from "../../utils/app-error";
import { verifyExistingReceipt } from "./receipt-evidence.service";
export function createReceiptEvidenceRouter(auth:AuthService=createAuthService(),verify=verifyExistingReceipt){
 const router=Router();
 router.get("/finance/evidence/payment-references/:id/receipt",createAuthenticate(auth),requireRoles("chairman","bookkeeper"),asyncHandler(async(req,res)=>{
   res.setHeader("Cache-Control","private, no-store");const id=req.params.id;
   if(typeof id!=="string" || !/^[1-9]\d{0,19}$/.test(id))throw new AppError("Invalid payment reference",422,"INVALID_EVIDENCE_SOURCE");
   return sendSuccess(res,await verify(id));
 }));
 return router;
}
