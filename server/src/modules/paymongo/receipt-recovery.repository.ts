import type { Pool, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";

/** Internal investigation only. It cannot retrieve, classify by age, or delete objects. */
export function createReceiptRecoveryRepository(pool: Pool) {
  async function inspect(paymentId: string, auth: AuthContext) {
    if (auth.user.role !== "chairman" || !/^[1-9]\d{0,19}$/.test(paymentId)) throw new AppError("Receipt not found",404,"RECEIPT_NOT_FOUND");
    return withTransaction(async connection => {
      const [receipts]=await connection.execute<RowDataPacket[]>("SELECT CAST(payment_receipt_id AS CHAR) AS id,processing_status AS status,attempt_count AS generation,CAST(document_id AS CHAR) AS documentId FROM payment_receipts WHERE payment_reference_id=? FOR UPDATE",[paymentId]);
      const receipt=receipts[0];if(!receipt)throw new AppError("Receipt not found",404,"RECEIPT_NOT_FOUND");
      const [attempts]=await connection.execute<RowDataPacket[]>("SELECT CAST(attempt_id AS CHAR) AS id,attempt_number AS generation,attempt_state AS state,CAST(document_id AS CHAR) AS documentId,upload_checksum AS checksum,upload_size AS size,created_at AS createdAt,updated_at AS updatedAt FROM payment_receipt_attempts WHERE payment_receipt_id=? ORDER BY attempt_number FOR UPDATE",[receipt.id]);
      const history=attempts.map(a=>({id:String(a.id),generation:Number(a.generation),state:String(a.state),isCurrent:Number(a.generation)===Number(receipt.generation),isLinked:a.documentId!==null && String(a.documentId)===receipt.documentId,uploadRecorded:a.checksum!==null && a.size!==null,objectAvailability:"UNKNOWN" as const,createdAt:a.createdAt,updatedAt:a.updatedAt}));
      await connection.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,new_values,action_time) VALUES(?,'receipt_recovery.inspect','payment_receipts',?,'Receipt attempt recovery history inspected',?,UTC_TIMESTAMP())",[auth.user.id,receipt.id,JSON.stringify({attemptCount:history.length})]);
      return {status:String(receipt.status),generation:Number(receipt.generation),hasDocument:receipt.documentId!==null,attempts:history};
    },pool);
  }
  return {inspect};
}
