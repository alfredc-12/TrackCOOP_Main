import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppError } from "../../utils/app-error";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext } from "../auth/auth.types";
import { fingerprint,taxonomy,transition } from "./finance-exception.model";
import { createFinanceExceptionRouter } from "./finance-exception.routes";
import type { FinanceExceptionRepository } from "./finance-exception.repository";

test("exception identity is deterministic and separates source and code",()=>{
 assert.equal(fingerprint("payment_reference","9","MISSING_POSTING"),fingerprint("payment_reference","9","MISSING_POSTING"));
 assert.notEqual(fingerprint("payment_reference","9","MISSING_POSTING"),fingerprint("payment_reference","9","AMOUNT_MISMATCH"));
 assert.throws(()=>fingerprint("payment_reference","09","MISSING_POSTING"));
 assert.throws(()=>fingerprint("invalid" as never,"9","MISSING_POSTING"));
 assert.equal(taxonomy.DUPLICATE_POSTING,"Critical");assert.equal(taxonomy.RECEIPT_FAILURE,"Medium");
});
test("case transitions require reasons and verified source clearance",()=>{
 assert.equal(transition("Open","review","bookkeeper","INVESTIGATION","unknown"),"Under Review");
 assert.equal(transition("Under Review","escalate","bookkeeper","ESCALATION_REQUIRED","unknown"),"Escalated");
 assert.throws(()=>transition("Escalated","resolve","bookkeeper","SOURCE_CONDITION_CLEARED","cleared"));
 assert.throws(()=>transition("Under Review","resolve","chairman","SOURCE_CONDITION_CLEARED","unknown"));
 assert.throws(()=>transition("Under Review","resolve","chairman","SOURCE_CONDITION_CLEARED","present"));
 assert.throws(()=>transition("Resolved","close","chairman","REVIEW_COMPLETE","present"));
 assert.throws(()=>transition("Open","review","bookkeeper","REVIEW_COMPLETE","unknown"));
 assert.equal(transition("Under Review","resolve","chairman","SOURCE_CONDITION_CLEARED","cleared"),"Resolved");
 assert.equal(transition("Resolved","close","chairman","REVIEW_COMPLETE","cleared"),"Closed");
 assert.equal(transition("Closed","reopen","chairman","CONDITION_RECURRED","present"),"Reopened");
});
test("routes deny anonymous and members and reject arbitrary free-text metadata",async()=>{
 let role="member",calls=0;
 const auth={authenticate:async(token:string)=>{if(!token)throw new AppError("Login required",401,"UNAUTHENTICATED");return {sessionId:"1",tokenHash:"fixture",user:{id:"1",role,displayName:"Fixture"}} as AuthContext;}} as unknown as AuthService;
 const repo={create:async()=>{calls++;return {id:"1"}},act:async()=>{calls++;return {}},assign:async()=>{calls++;return {}},get:async()=>({}),list:async()=>[]} as unknown as FinanceExceptionRepository;
 const app=express().use(cookieParser()).use(express.json()).use("/api",createFinanceExceptionRouter(auth,repo)).use(errorHandler),path="/api/finance/exceptions",cookie="trackcoop_session=fixture";
 assert.equal((await request(app).get(path)).status,401);assert.equal((await request(app).get(path).set("Cookie",cookie)).status,403);
 role="bookkeeper";
 assert.equal((await request(app).post(path).set("Cookie",cookie).send({sourceType:"payment_reference",sourceId:"1",code:"MISSING_POSTING",requestKey:"a".repeat(64),details:"secret"})).status,422);
 assert.equal(calls,0);
 assert.equal((await request(app).post(path).set("Cookie",cookie).send({sourceType:"payment_reference",sourceId:"1",code:"MISSING_POSTING",requestKey:"a".repeat(64)})).status,201);
 assert.equal(calls,1);
});
