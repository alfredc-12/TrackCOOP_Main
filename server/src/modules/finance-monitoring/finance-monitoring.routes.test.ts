import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createFinanceMonitoringRouter } from "./finance-monitoring.routes";
import { createShareCapitalRouter } from "../share-capital/share-capital.routes";
import type { FinanceMonitoringService } from "./finance-monitoring.service";
import type { ShareCapitalService } from "../share-capital/share-capital.service";
import type { AuthService } from "../auth/auth.service";
import { AppError } from "../../utils/app-error";
import { errorHandler } from "../../middleware/error-handler";
test('monitoring and exports are staff-only, filters validate, and only Bookkeeper may record capital',async()=>{
 let role='chairman',loggedIn=true,reads=0,mutations=0;
 const auth={authenticate:async()=>{if(!loggedIn)throw new AppError('Login required',401,'UNAUTHENTICATED');return {sessionId:'1',tokenHash:'fixture',user:{id:'1',role,displayName:'Staff'}};}} as unknown as AuthService;
 const data=async()=>{reads++;return {};};
 const service={payments:data,capital:data,accounts:data,transactions:data,options:data,schema:data,export:async()=>Buffer.from('fixture workbook')} as unknown as FinanceMonitoringService;
 const shares={createPayment:async()=>{mutations++;return {id:'1'};}} as unknown as ShareCapitalService;
 const app=express();app.use(express.json());app.use('/api',createFinanceMonitoringRouter(auth,service));app.use('/api',createShareCapitalRouter(auth,shares));app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Test server failed');const base=`http://127.0.0.1:${address.port}/api`;
 try{
  role='member';assert.equal((await fetch(`${base}/finance-monitoring/payments`)).status,403);assert.equal((await fetch(`${base}/finance-monitoring/capital/export`)).status,403);assert.equal(reads,0);
  role='chairman';assert.equal((await fetch(`${base}/finance-monitoring/payments`)).status,200);assert.equal((await fetch(`${base}/finance-monitoring/payments?sortBy=invalid`)).status,422);
  assert.equal((await fetch(`${base}/share-capital`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({memberId:'1',amount:100,paymentDate:'2026-11-03'})})).status,403);assert.equal(mutations,0);
  role='bookkeeper';assert.equal((await fetch(`${base}/share-capital`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({memberId:'1',amount:100,paymentDate:'2026-11-03'})})).status,201);assert.equal(mutations,1);
  const workbook=await fetch(`${base}/finance-monitoring/payments/export`);assert.equal(workbook.status,200);assert.match(workbook.headers.get('content-type')??'',/spreadsheetml/);
  loggedIn=false;assert.equal((await fetch(`${base}/finance-monitoring/capital`)).status,401);
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
