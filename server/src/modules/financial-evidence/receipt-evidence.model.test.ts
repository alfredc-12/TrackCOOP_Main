import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { verifyReceiptBasis,type ReceiptEvidenceBasis } from "./receipt-evidence.model";
const bytes=Buffer.from("%PDF-synthetic");
const basis:ReceiptEvidenceBasis={paymentId:"1",receiptPaymentId:"1",paymentStatus:"Validated",paymentAmount:"10.00",paymentMemberId:"2",receiptId:"3",receiptStatus:"Generated",receiptAmount:"10.00",receiptMemberId:"2",receiptReversed:false,documentId:"4",documentOwnerId:"2",documentStatus:"Active",accessLevel:"Member-only",documentType:"Receipt",relatedModule:"Payment",relatedRecordId:"1",relationshipType:"Payment Receipt",version:1,checksum:createHash("sha256").update(bytes).digest("hex"),expirationDate:null};
test("valid linked receipt requires exact identity, amount, owner, checksum and content",()=>{
 const good=verifyReceiptBasis(basis,bytes,"2026-11-07");assert.equal(good.status,"verified");assert.match(good.fingerprint!,/^[a-f0-9]{64}$/);
 for(const patch of [{relatedRecordId:"9"},{receiptPaymentId:"9"},{documentOwnerId:"3"},{receiptAmount:"10.01"},{accessLevel:"Public"},{documentType:"Other"},{checksum:"a".repeat(64)}])assert.notEqual(verifyReceiptBasis({...basis,...patch},bytes,"2026-11-07").status,"verified");
 assert.equal(verifyReceiptBasis({...basis,documentOwnerId:null},bytes,"2026-11-07").status,"invalid");
 assert.equal(verifyReceiptBasis(basis,Buffer.from("bad"),"2026-11-07").status,"invalid");
 assert.equal(verifyReceiptBasis(basis,null,"2026-11-07").status,"missing");
});
test("replacement, archive, expiry and version changes cannot retain an earlier verified basis",()=>{
 const initial=verifyReceiptBasis(basis,bytes,"2026-11-07");
 assert.equal(verifyReceiptBasis({...basis,documentStatus:"Archived"},bytes,"2026-11-07").status,"stale");
 assert.equal(verifyReceiptBasis({...basis,expirationDate:"2026-11-06"},bytes,"2026-11-07").status,"stale");
 assert.equal(verifyReceiptBasis({...basis,checksum:null},bytes,"2026-11-07").status,"unsupported");
 assert.notEqual(verifyReceiptBasis({...basis,version:2},bytes,"2026-11-07").fingerprint,initial.fingerprint);
 assert.equal(verifyReceiptBasis({...basis,paymentStatus:"Pending"},bytes,"2026-11-07").status,"stale");
});
