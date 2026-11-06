import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import type { Pool } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext } from "../auth/auth.types";
import { createFinanceRepository } from "./finance.repository";
import { createFinanceService } from "./finance.service";
import { createFinanceRouter } from "./finance.routes";
import { assertLegacyFinanceWriteAllowed } from "./controlled-finance.mode";

test("inactive legacy behavior remains allowed while hypothetical Active mode blocks every finance writer before database access", async () => {
  assert.doesNotThrow(() => assertLegacyFinanceWriteAllowed("Inactive"));
  assert.doesNotThrow(() => assertLegacyFinanceWriteAllowed("StagingVerified"));
  const pool = { getConnection: async () => { throw new Error("Database was unexpectedly touched"); } } as unknown as Pool;
  const repo = createFinanceRepository(pool,()=>"Active");
  const auth = { sessionId:"1",tokenHash:"test",user:{ id:"1",role:"bookkeeper",displayName:"Fixture" } } as AuthContext;
  const calls = [() => repo.createRecord({} as never,auth),() => repo.updateRecord("1",{} as never,auth),() => repo.postRecord("1",auth),() => repo.voidRecord("1","reason",auth),() => repo.createOperatingExpense({} as never,auth),() => repo.createCategory({} as never,auth),() => repo.updateCategory("1",{} as never,auth)];
  for (const call of calls) await assert.rejects(call,(e:unknown)=>(e as AppError).code==="POLICY_ENFORCEMENT_REQUIRED");
});

test("hypothetical Active mode blocks both legacy posting routes for a Bookkeeper", async () => {
  const pool = { getConnection: async () => { throw new Error("Database was unexpectedly touched"); } } as unknown as Pool;
  const auth = { authenticate: async () => ({ sessionId:"1",tokenHash:"test",user:{ id:"1",role:"bookkeeper",displayName:"Fixture" } } as AuthContext) } as unknown as AuthService;
  const app=express().use(cookieParser()).use(express.json()).use("/api",createFinanceRouter(auth,createFinanceService(createFinanceRepository(pool,()=>"Active"),()=>"Active"))).use(errorHandler);
  const post=await request(app).post("/api/financial-records/1/post").set("Cookie","trackcoop_session=fixture").send({});
  const expense=await request(app).post("/api/operating-expenses").set("Cookie","trackcoop_session=fixture").send({expenseType:"Fuel",amount:10,expenseDate:"2026-06-01"});
  assert.equal(post.status,409);assert.equal(expense.status,409);
});
