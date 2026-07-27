import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { createGeneratedPdfDocument } from "../../records/generated-pdf-document";
import type {
  GatewaySettlementDetails,
  PaymentReferenceForSettlement,
} from "./paymongo.settlement.types";
import { settlementRecordDate } from "./paymongo.settlement.queries";

type ReceiptRow = RowDataPacket & {
  receiptId: string;
  receiptNumber: string;
  documentId: string;
};

export type MemberShareCapitalReceiptResult = {
  receiptId: string;
  receiptNumber: string;
  documentId: string;
  created: boolean;
};

export async function ensureMemberShareCapitalReceipt(input: {
  connection: PoolConnection;
  payment: PaymentReferenceForSettlement;
  memberId: string;
  memberCode: string;
  memberName: string;
  actorUserId: string;
  gatewayDetails?: GatewaySettlementDetails | null;
}, dependencies: {
  createDocument?: typeof createGeneratedPdfDocument;
} = {}): Promise<MemberShareCapitalReceiptResult> {
  const [existingRows] = await input.connection.execute<ReceiptRow[]>(
    `SELECT CAST(payment_receipt_id AS CHAR) AS receiptId,
            receipt_number AS receiptNumber,
            CAST(document_id AS CHAR) AS documentId
       FROM payment_receipts
      WHERE payment_reference_id = ?
      LIMIT 1 FOR UPDATE`,
    [input.payment.id],
  );
  if (existingRows[0]) return { ...existingRows[0], created: false };

  const receiptNumber = `PAY-RCPT-${new Date().getUTCFullYear()}-${String(input.payment.id).padStart(6, "0")}`;
  const document = await (dependencies.createDocument ?? createGeneratedPdfDocument)(input.connection, {
    uploadedBy: input.actorUserId,
    uploaderRole: "system",
    memberId: input.memberId,
    title: `Share Capital Receipt ${receiptNumber}`,
    description: `System-generated receipt for ${input.payment.referenceNumber}.`,
    category: "Payment Receipt",
    documentType: "Receipt",
    accessLevel: "Member-only",
    relatedModule: "Payment",
    relatedRecordId: input.payment.id,
    relatedRecordReference: input.payment.referenceNumber,
    relationshipType: "Payment Receipt",
    fileBaseName: receiptNumber,
    heading: "Share Capital Payment Receipt",
    lines: [
      { label: "Receipt Number", value: receiptNumber },
      { label: "Payment Reference", value: input.payment.referenceNumber },
      { label: "Member", value: `${input.memberCode} — ${input.memberName}` },
      { label: "Payer", value: input.payment.payerName ?? input.memberName },
      { label: "Purpose", value: input.payment.paymentPurpose },
      { label: "Amount", value: `PHP ${Number(input.payment.amount).toFixed(2)}` },
      { label: "Channel", value: input.payment.paymentChannel },
      { label: "Provider", value: input.payment.provider },
      { label: "Payment Date", value: settlementRecordDate(input.gatewayDetails?.paidAt) },
    ],
    notice: "This receipt was generated after verified PayMongo webhook settlement.",
  });

  const [result] = await input.connection.execute<ResultSetHeader>(
    `INSERT INTO payment_receipts
       (payment_reference_id, member_id, document_id, receipt_number, amount,
        payment_channel, provider, issued_by, issued_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [
      input.payment.id,
      input.memberId,
      document.documentId,
      receiptNumber,
      input.payment.amount,
      input.payment.paymentChannel,
      input.payment.provider,
      input.actorUserId,
    ],
  );
  return {
    receiptId: String(result.insertId),
    receiptNumber,
    documentId: String(document.documentId),
    created: true,
  };
}
