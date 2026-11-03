import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import type { AuthContext } from "../auth/auth.types";
import { createPaymentReferenceReversalService } from "../payment-references/payment-reference.reversal";
const auth={sessionId:'1',tokenHash:'test',user:{id:'2',role:'bookkeeper',displayName:'Bookkeeper',email:'book@example.test',username:'book'}} as AuthContext;
class ReversalConnection{
 balance=1500;debits=0;status='Validated';rolledBack=0;before={balance:1500,debits:0,status:'Validated'};
 async beginTransaction(){this.before={balance:this.balance,debits:this.debits,status:this.status};}async commit(){}async rollback(){Object.assign(this,this.before);this.rolledBack++;}release(){}async getConnection(){return this;}
 async execute(sql:string,values:unknown[]=[]):Promise<[unknown,unknown]>{
  if(sql.includes('FROM payment_references')&&sql.includes('FOR UPDATE'))return[[{id:'9',referenceNumber:'REF-9',validationStatus:this.status,paymentPurpose:'Share Capital',memberId:'1',relatedEntityType:'member_profile',relatedEntityId:'1'}],[]];
  if(sql.includes('FROM share_capital_payments WHERE payment_reference_id'))return[[{id:'10',memberId:'1'}],[]];
  if(sql.includes('FROM share_capital_transactions')&&sql.includes('source_type = ?'))return[[],[]];
  if(sql.includes("WHERE source_type = 'share_capital_payment'"))return[[{id:'100',accountId:'1',memberId:'1',amount:'1500.00',referenceNumber:'SC-10'}],[]];
  if(sql.includes('FROM share_capital_accounts'))return[[{accountId:'1',initialCapital:'1500.00',currentBalance:String(this.balance),additionalContributions:'0.00',dividendsAdded:'0.00',totalDeductions:'0.00'}],[]];
  if(sql.includes('INSERT INTO share_capital_transactions')){this.debits++;assert.equal(values[5],0);return[{insertId:101,affectedRows:1},[]];}
  if(sql.includes('UPDATE share_capital_accounts'))this.balance=Number(values[1]);
  if(sql.includes("SET validation_status = 'Reversed'"))this.status='Reversed';
  if(sql.includes('FROM member_profiles WHERE member_id'))return[[],[]];
  return[{insertId:1,affectedRows:1},[]];
 }
}
test('authorized payment reversal posts exactly one capital debit and prevents a second reversal',async()=>{
 const connection=new ReversalConnection(),service=createPaymentReferenceReversalService(connection as unknown as Pool);
 await service.reverse({paymentReferenceId:'9',reason:'Duplicate payment recorded',confirmation:'REF-9',auth});assert.equal(connection.balance,0);assert.equal(connection.debits,1);assert.equal(connection.status,'Reversed');
 await assert.rejects(()=>service.reverse({paymentReferenceId:'9',reason:'Duplicate payment recorded',confirmation:'REF-9',auth}),{code:'PAYMENT_REFERENCE_NOT_VALIDATED'});assert.equal(connection.debits,1);
});
test('insufficient capital blocks the entire reversal transaction',async()=>{
 const connection=new ReversalConnection();connection.balance=1000;const service=createPaymentReferenceReversalService(connection as unknown as Pool);
 await assert.rejects(()=>service.reverse({paymentReferenceId:'9',reason:'Duplicate payment recorded',confirmation:'REF-9',auth}),{code:'SHARE_CAPITAL_REVERSAL_BALANCE_INVALID'});assert.equal(connection.balance,1000);assert.equal(connection.debits,0);assert.equal(connection.status,'Validated');assert.equal(connection.rolledBack,1);
});
