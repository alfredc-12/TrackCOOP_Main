import { capitalScope } from "./capital-monitoring";
import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { cents,decimal,dateScope,financeFilterSchema,manilaToday,utcBoundary,validateFinanceKind } from "./finance-monitoring.schema";
import { createFinanceMonitoringService } from "./finance-monitoring.service";
const f=(patch:Record<string,unknown>={})=>financeFilterSchema.parse(patch);
test('Manila day boundaries and reporting presets handle UTC midnight, month/year and leap years',()=>{
 assert.equal(manilaToday(new Date('2026-11-02T15:59:59Z')),'2026-11-02');assert.equal(manilaToday(new Date('2026-11-02T16:00:00Z')),'2026-11-03');
 assert.equal(utcBoundary('2026-11-03'),'2026-11-02 16:00:00');assert.equal(utcBoundary('2026-11-03',true),'2026-11-03 16:00:00');
 assert.equal(dateScope(f({period:'yesterday'}),new Date('2026-01-01T04:00:00Z')).start,'2025-12-31');
 const leap=dateScope(f({period:'lastMonth'}),new Date('2024-03-01T04:00:00Z'));assert.equal(leap.start,'2024-02-01');assert.equal(leap.end,'2024-02-29');
 assert.equal(dateScope(f({period:'last7'}),new Date('2026-01-01T04:00:00Z')).start,'2025-12-26');
 assert.equal(dateScope(f({period:'all'})).end,null);
});
test('amount and date ranges, environments and sort keys are validated; decimals remain exact',()=>{
 assert.equal(cents('0.10')+cents('0.20'),BigInt(30));assert.equal(decimal('1500.2'),'1500.20');assert.throws(()=>decimal('1e3'));
 assert.throws(()=>dateScope(f({period:'custom',start:'2026-11-03',end:'2026-11-01'})));
 assert.throws(()=>dateScope(f({minAmount:'9.01',maxAmount:'9.00'})));
 assert.equal(financeFilterSchema.safeParse({sortBy:'amount; DROP TABLE payment_references'}).success,false);
 assert.equal(financeFilterSchema.safeParse({minAmount:'-0.01'}).success,false);
 assert.equal(financeFilterSchema.safeParse({environment:'Production'}).success,false);
 assert.throws(()=>validateFinanceKind(f({purpose:'Rental'}),'capital'),{code:'FINANCE_FILTER_COMBINATION'});
 assert.throws(()=>validateFinanceKind(f({stage:'none'}),'payments'),{code:'FINANCE_FILTER_COMBINATION'});
 assert.throws(()=>validateFinanceKind(f({status:'Needs Clarification'}),'capital'),{code:'FINANCE_FILTER_COMBINATION'});
 assert.throws(()=>dateScope(f({asOf:'9999-01-01'})));
});
test('monitoring uses a constant-query read-only snapshot and rolls back schema failures',async()=>{
 const operations:string[]=[];let commits=0,rollbacks=0,released=0,fail=false;
 const connection={query:async(sql:string)=>{operations.push(sql);return[[],[]];},execute:async(sql:string)=>{operations.push(sql);if(fail)throw Object.assign(new Error('fixture schema missing'),{code:'ER_NO_SUCH_TABLE'});return[[],[]];},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},release:()=>{released++;}};
 const pool={getConnection:async()=>connection} as unknown as Pool;const service=createFinanceMonitoringService(pool,()=>new Date('2026-11-03T04:00:00Z'));
 const report=await service.payments(f({period:'all'}));assert.equal(report.summary.validatedVolume,'0.00');assert.equal(commits,1);assert.equal(released,1);assert.ok(operations.includes('START TRANSACTION READ ONLY'));assert.ok(operations.length<=10);assert.ok(operations.every(s=>!/^\s*(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP)/i.test(s)));
 fail=true;await assert.rejects(()=>service.capital(f()),{code:'FINANCE_SCHEMA_REQUIRED'});assert.equal(rollbacks,1);assert.equal(released,2);
});

test("unassessed capital is reviewable, not reclassified as a non-applicable requirement", () => {
  const filters = f({ deadline: "na" });
  const scope = capitalScope(filters, dateScope(filters, new Date("2026-11-03T04:00:00Z")));
  assert.match(scope.clauses.join(" "), /NOT .*approvalStatus/);
  assert.doesNotMatch(scope.clauses.join(" "), /reconciled|sourceIssues|unverifiedSources/);
});

test("current deadline monitoring does not combine historical balances with current eligibility", () => {
  const filters = f({ deadline: "overdue", asOf: "2026-10-01" });
  const scope = capitalScope(filters, dateScope(filters, new Date("2026-11-03T04:00:00Z")));
  assert.match(scope.clauses.join(" "), /c\.currentBalance<3000/);
  assert.doesNotMatch(scope.clauses.join(" "), /c\.balance<3000/);
});
