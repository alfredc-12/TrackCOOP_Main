import { createHash } from "node:crypto";

export type ReceiptEvidenceBasis = {
  paymentId:string; receiptPaymentId:string; paymentStatus:string; paymentAmount:string; paymentMemberId:string|null;
  receiptId:string; receiptStatus:string; receiptAmount:string; receiptMemberId:string|null; receiptReversed:boolean;
  documentId:string|null; documentOwnerId:string|null; documentStatus:string|null; accessLevel:string|null;
  documentType:string|null; relatedModule:string|null; relatedRecordId:string|null; relationshipType:string|null;
  version:number|null; checksum:string|null; expirationDate:string|null;
};
export type ReceiptDiagnosticStatus = "observed_match" | "missing" | "invalid" | "stale" | "unsupported" | "unavailable";
export type ReceiptDiagnosticResult = { kind:"diagnostic"; status:ReceiptDiagnosticStatus; observationHash:string|null };
const result=(status:ReceiptDiagnosticStatus):ReceiptDiagnosticResult=>({kind:"diagnostic",status,observationHash:null});
function amount(value:string):string|null {
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value))return null;
  const [whole,fraction=""]=value.split(".");return `${whole}.${fraction.padEnd(2,"0")}`;
}
/** A receipt proves an internally validated receipt record, never gateway or bank settlement. */
export function verifyReceiptBasis(b:ReceiptEvidenceBasis,bytes:Buffer|null,today:string):ReceiptDiagnosticResult {
  if(!b.documentId || !bytes)return result("missing");
  if(b.paymentStatus!=="Validated" || b.receiptStatus!=="Generated" || b.receiptReversed)return result("stale");
  if(b.documentStatus!=="Active" || (b.expirationDate!==null && b.expirationDate<today))return result("stale");
  if(!Number.isSafeInteger(b.version) || !b.version || b.version<1 || !b.checksum || !/^[a-f0-9]{64}$/i.test(b.checksum))return result("unsupported");
  if(b.accessLevel==="Public" || !["Member-only","Bookkeeper-only","Admin-only"].includes(b.accessLevel??""))return result("invalid");
  if(b.accessLevel==="Member-only" && (!b.documentOwnerId || !b.paymentMemberId))return result("invalid");
  const pay=amount(b.paymentAmount),receipt=amount(b.receiptAmount);
  if(!pay || !receipt || pay!==receipt || b.paymentId!==b.receiptPaymentId || b.paymentMemberId!==b.receiptMemberId || b.documentOwnerId!==b.paymentMemberId || b.documentType!=="Receipt" || b.relatedModule!=="Payment" || b.relatedRecordId!==b.paymentId || b.relationshipType!=="Payment Receipt")return result("invalid");
  if(bytes.length<5 || bytes.subarray(0,5).toString()!=="%PDF-")return result("invalid");
  const contentHash=createHash("sha256").update(bytes).digest("hex");
  if(contentHash!==b.checksum.toLowerCase())return result("invalid");
  const fingerprint=createHash("sha256").update(JSON.stringify(["receipt-evidence-v1",b.paymentId,b.receiptId,b.documentId,b.documentOwnerId,b.version,contentHash,b.paymentStatus,b.receiptStatus,b.documentStatus,b.accessLevel,b.expirationDate,pay])).digest("hex");
  return {kind:"diagnostic",status:"observed_match",observationHash:fingerprint};
}
