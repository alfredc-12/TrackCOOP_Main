import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppError } from "../../utils/app-error";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext } from "../auth/auth.types";
import { createControlledPostingRouter } from "./controlled-posting.routes";
import type { ControlledPostingRepository } from "./controlled-posting.repository";
import { assertControlledPostingInactive } from "./controlled-posting.model";
import { createControlledPostingRepository } from "./controlled-posting.repository";
import type { Pool } from "mysql2/promise";

test("controlled routes deny members and unauthorized approvals; client evidence is rejected; posting stays inactive", async () => {
  let role = "member", writes = 0;
  const auth = { authenticate: async (token: string) => { if (!token) throw new AppError("Login required",401,"UNAUTHENTICATED"); return { sessionId: "1",tokenHash: "test",user:{ id:"3", role, displayName:"Fixture" } } as AuthContext; } } as unknown as AuthService;
  const repo = { create: async () => { writes++; return {}; }, get: async () => ({}), refresh: async () => ({}), decide: async () => { writes++; return {}; }, post: assertControlledPostingInactive } as unknown as ControlledPostingRepository;
  const app = express().use(cookieParser()).use(express.json()).use("/api",createControlledPostingRouter(auth,repo)).use(errorHandler);
  const cookie = "trackcoop_session=fixture";
  const create = "/api/finance/controlled-operations";
  assert.equal((await request(app).post(create).send({})).status,401);
  assert.equal((await request(app).get(`${create}/1`).set("Cookie",cookie)).status,403);
  role = "bookkeeper";
  assert.equal((await request(app).post(`${create}/1/approve`).set("Cookie",cookie).send({ expectedVersion:1,reason:"ok" })).status,403);
  assert.equal((await request(app).post(create).set("Cookie",cookie).send({ recordId:"1",idempotencyKey:"a".repeat(64),evidenceVerified:true })).status,422);
  assert.equal((await request(app).post(`${create}/1/post`).set("Cookie",cookie).send({ expectedVersion:1,idempotencyKey:"b".repeat(64) })).status,409);
  assert.equal(writes,0);
  role = "chairman";
  assert.equal((await request(app).post(`${create}/1/approve`).set("Cookie",cookie).send({ expectedVersion:1,reason:" " })).status,422);
  assert.equal((await request(app).post(`${create}/1/approve`).set("Cookie",cookie).send({ expectedVersion:1,reason:"Reviewed" })).status,200);
  assert.equal(writes,1);
});

test("inactive default denies controlled draft creation without touching a database", async () => {
  let touched=false;
  const pool={ async getConnection() { touched=true; throw new Error("unexpected database access"); } } as unknown as Pool;
  const repo=createControlledPostingRepository(pool);
  const auth={ sessionId:"1",tokenHash:"test",user:{id:"1",role:"bookkeeper",displayName:"Fixture"} } as AuthContext;
  await assert.rejects(repo.createDraft({recordNumber:"D1",categoryId:"4",recordType:"Expense",amount:"1.00",date:"2026-06-01",seasonId:null,remarks:null,idempotencyKey:"a".repeat(64)},auth),(error:unknown)=>(error as AppError).code==="CONTROLLED_FINANCE_INACTIVE");
  await assert.rejects(repo.create("1","bad",auth),(error:unknown)=>(error as AppError).code==="INVALID_CONTROLLED_REQUEST");
  await assert.rejects(repo.requestLegacyCorrection("1","bad","reason",auth),(error:unknown)=>(error as AppError).code==="INVALID_CONTROLLED_REQUEST");
  assert.equal(touched,false);
});

test("the synthetic test gate cannot enable draft creation outside test mode", async () => {
  const mutableEnv=process.env as Record<string,string | undefined>;const previous=mutableEnv.NODE_ENV;let touched=false;
  try {
    mutableEnv.NODE_ENV="production";
    const pool={ async getConnection() { touched=true; throw new Error("unexpected database access"); } } as unknown as Pool;
    const repo=createControlledPostingRepository(pool,async()=>({verified:true,fingerprint:"f".repeat(64)}),()=>true);
    const auth={ sessionId:"1",tokenHash:"test",user:{id:"1",role:"bookkeeper",displayName:"Fixture"} } as AuthContext;
    await assert.rejects(repo.createDraft({recordNumber:"D1",categoryId:"4",recordType:"Expense",amount:"1.00",date:"2026-06-01",seasonId:null,remarks:null,idempotencyKey:"a".repeat(64)},auth),(error:unknown)=>(error as AppError).code==="CONTROLLED_FINANCE_INACTIVE");
    assert.equal(touched,false);
  } finally { if(previous===undefined) delete mutableEnv.NODE_ENV; else mutableEnv.NODE_ENV=previous; }
});
