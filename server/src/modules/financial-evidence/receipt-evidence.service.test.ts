import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp,mkdir,writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppError } from "../../utils/app-error";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthContext } from "../auth/auth.types";
import type { AuthService } from "../auth/auth.service";
import { verifyExistingReceipt,readPrivateLocalObject } from "./receipt-evidence.service";
import { createReceiptEvidenceRouter } from "./receipt-evidence.routes";
const bytes=Buffer.from("%PDF-synthetic");
const row={paymentId:"1",receiptPaymentId:"1",paymentStatus:"Validated",paymentAmount:"10.00",paymentMemberId:"2",receiptId:"3",receiptStatus:"Generated",receiptAmount:"10.00",receiptMemberId:"2",receiptReversed:0,documentId:"4",documentOwnerId:"2",documentStatus:"Active",accessLevel:"Member-only",documentType:"Receipt",relatedModule:"Payment",relatedRecordId:"1",relationshipType:"Payment Receipt",version:1,checksum:createHash("sha256").update(bytes).digest("hex"),expirationDate:null,storagePath:"public/uploads/receipts/sample.pdf",purpose:"POS/Product",channel:"Cash",entityType:"pos_sales",entityId:"7",sourcePaymentId:"1",sourceStatus:"Paid",sourcePaymentStatus:"Paid",sourceAmount:"10.00"};
function db(data:unknown){return {execute:async()=>[[data],[]]} as unknown as Pick<Pool,"execute">;}
test("source-backed receipt verifier fails closed for substitution, gateway and storage errors",async()=>{
 const read=async()=>bytes;assert.equal((await verifyExistingReceipt("1",db(row),read)).status,"verified");
 for(const patch of [{sourcePaymentId:"9"},{sourceStatus:"Cancelled"},{sourceAmount:"11.00"},{relatedRecordId:"9"},{documentOwnerId:"3"},{accessLevel:"Public"}])assert.notEqual((await verifyExistingReceipt("1",db({...row,...patch}),read)).status,"verified");
 assert.equal((await verifyExistingReceipt("1",db({...row,channel:"PayMongo"}),read)).status,"unsupported");
 assert.equal((await verifyExistingReceipt("1",db(row),async()=>{throw new Error("offline")})).status,"unavailable");
 const failed={execute:async()=>{throw new Error("schema unavailable")}} as unknown as Pick<Pool,"execute">;assert.equal((await verifyExistingReceipt("1",failed,read)).status,"unavailable");
});
test("protected local reads reject paths, missing and legacy public-only files",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"trackcoop-1e-storage-"));await mkdir(path.join(root,"protected","receipts"),{recursive:true});await writeFile(path.join(root,"protected","receipts","sample.pdf"),bytes);
 assert.deepEqual(await readPrivateLocalObject("public/uploads/receipts/sample.pdf",root),bytes);
 for(const name of ["../escape","receipts/../other","https://example.test/file","receipts\\bad","/absolute"])await assert.rejects(readPrivateLocalObject(name,root));
 await assert.rejects(readPrivateLocalObject("public/uploads/receipts/missing.pdf",root));
});
test("diagnostic endpoint excludes members and anonymous users",async()=>{
 let role="member",calls=0;const auth={authenticate:async(token:string)=>{if(!token)throw new AppError("Login",401,"UNAUTHENTICATED");return {sessionId:"1",tokenHash:"fixture",user:{id:"1",role,displayName:"Fixture"}} as AuthContext;}} as unknown as AuthService;
 const verify=async()=>{calls++;return {status:"missing" as const,fingerprint:null};};const app=express().use(cookieParser()).use("/api",createReceiptEvidenceRouter(auth,verify)).use(errorHandler);const url="/api/finance/evidence/payment-references/1/receipt";
 assert.equal((await request(app).get(url)).status,401);assert.equal((await request(app).get(url).set("Cookie","trackcoop_session=fixture")).status,403);assert.equal(calls,0);
 for(role of ["bookkeeper","chairman"])assert.equal((await request(app).get(url).set("Cookie","trackcoop_session=fixture")).status,200);
 assert.equal(calls,2);
});
