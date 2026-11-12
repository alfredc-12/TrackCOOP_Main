import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import type { AuthContext } from "../auth/auth.types";
import { createMemberSelfRepository } from "./member-self.repository";

const auth = { user: { id: "7", role: "member" } } as AuthContext;
function fixture() {
  const calls: {sql:string; params:unknown[]}[] = [];
  const pool = { async execute(sql:string, params:unknown[] = []) {
    calls.push({sql,params});
    if (sql.includes("FROM member_profiles")) return [[{member_id:12, membership_type:"Associate", referral_code:"REF-12", occupation:"Farmer", livelihoods:[]}],[]];
    if (sql.includes("COUNT(*) as count FROM rental_bookings")) return [[{count:1}],[]];
    if (sql.includes("'Rental Payment' AS type")) return [[
      {id:"RENTAL-PAY-2",date:"2026-11-09",amount:2500,status:"Validated",type:"Rental Payment"},
      {id:"RENTAL-PAY-1",date:"2026-11-08",amount:500,status:"Pending",type:"Rental Payment"},
    ],[]];
    if (sql.includes("FROM rental_bookings")) return [[{id:1,date:"2026-11-07",amount:2500,status:"Scheduled",type:"Rental Booking"}],[]];
    return [[],[]];
  }} as unknown as Pool;
  return {repository:createMemberSelfRepository(pool),calls};
}
test("member dashboard counts linked bookings and sorts rental payments by recorded date without changing payment status", async () => {
  const {repository,calls} = fixture();
  const data = await repository.dashboard(auth);
  assert.equal((data.stats as {rentals:number}).rentals,1);
  assert.deepEqual((data.recentActivity as {type:string;status:string}[]).map(i=>[i.type,i.status]),[["Rental Payment","Validated"],["Rental Payment","Pending"],["Rental Booking","Scheduled"]]);
  const payments = calls.find(c=>c.sql.includes("'Rental Payment' AS type"))!;
  assert.deepEqual(payments.params,[12,12]);
  assert.match(payments.sql,/p.member_id IS NULL/);
  const bookings = calls.find(c=>c.sql.includes("'Rental Booking' as type"))!;
  assert.match(bookings.sql,/created_at as date/);
  assert.match(bookings.sql,/ORDER BY created_at DESC/);
});
test("paginated member activity includes all rental payments before searching and paging", async () => {
  const {repository,calls} = fixture();
  const data = await repository.activity(auth,{search:"Rental Payment",page:2,pageSize:1});
  assert.equal(data.total,2);
  assert.equal((data.records as {status:string}[])[0].status,"Pending");
  assert.doesNotMatch(calls.find(c=>c.sql.includes("'Rental Payment' AS type"))!.sql,/LIMIT 5/);
});
