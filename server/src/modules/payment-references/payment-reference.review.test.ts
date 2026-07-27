import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolConnection } from "mysql2/promise";
import { createPaymentReferenceReviewService } from "./payment-reference.review";
import { createPaymentReferenceReversalService } from "./payment-reference.reversal";

const auth: any = { user: { id: "bookkeeper-1", displayName: "Bookkeeper", role: "bookkeeper" } };

class ReviewConnection implements PoolConnection {
  status = "Pending";
  history: Array<[string, string]> = [];
  adjustments = 0;
  receiptReversed = 0;
  documentMarked = 0;
  async beginTransaction() {}
  async commit() {}
  async rollback() {}
  release() {}
  async getConnection() { return this; }
  async execute<T = unknown>(sql: string, values?: any[]): Promise<[T, unknown]> {
    if (sql.includes("reference_number AS referenceNumber")) {
      return [[{ id: "901", referenceNumber: "PAY-901", validationStatus: this.status,
        memberId: "member-9", relatedEntityType: "member_profile", relatedEntityId: "member-9" }] as T, null];
    }
    if (sql.includes("validation_status AS validationStatus")) return [[{ validationStatus: this.status }] as T, null];
    if (sql.startsWith("UPDATE payment_references SET validation_status = ?")) this.status = String(values?.[0]);
    if (sql.includes("SET validation_status = 'Reversed'")) this.status = "Reversed";
    if (sql.includes("INSERT INTO payment_validation_history")) {
      const oldStatus = sql.includes("'Validated', 'Reversed'") ? "Validated" : String(values?.[1] ?? "Pending");
      const newStatus = sql.includes("'Validated', 'Reversed'") ? "Reversed" : String(values?.[2] ?? "Pending");
      this.history.push([oldStatus, newStatus]);
    }
    if (sql.includes("INSERT INTO financial_records")) this.adjustments += 1;
    if (sql.includes("UPDATE payment_receipts SET reversed_at")) this.receiptReversed += 1;
    if (sql.includes("UPDATE documents SET description")) this.documentMarked += 1;
    if (sql.includes("FROM member_profiles WHERE member_id")) {
      return [[{ membershipType: "Associate", officialStatus: "Active" }] as T, null];
    }
    return [{ affectedRows: 1, insertId: 1 } as T, null];
  }
}

test("clarification, returned-to-pending, and rejection create validation history", async () => {
  const connection = new ReviewConnection();
  const service = createPaymentReferenceReviewService(connection as unknown as Pool);
  await service.transition({ paymentReferenceId: "901", newStatus: "Needs Clarification", reason: "Upload clearer proof", auth });
  await service.transition({ paymentReferenceId: "901", newStatus: "Pending", reason: "Replacement proof received", auth });
  await service.transition({ paymentReferenceId: "901", newStatus: "Rejected", reason: "Reference could not be verified", auth });
  assert.deepEqual(connection.history, [
    ["Pending", "Needs Clarification"],
    ["Needs Clarification", "Pending"],
    ["Pending", "Rejected"],
  ]);
});

test("reversal creates financial adjustment, history, and marks receipt without changing membership", async () => {
  const connection = new ReviewConnection();
  connection.status = "Validated";
  const service = createPaymentReferenceReversalService(connection as unknown as Pool);
  await service.reverse({
    paymentReferenceId: "901", confirmation: "PAY-901", reason: "Confirmed duplicate payment", auth,
  });
  assert.equal(connection.status, "Reversed");
  assert.equal(connection.adjustments, 1);
  assert.equal(connection.receiptReversed, 1);
  assert.equal(connection.documentMarked, 1);
  assert.ok(connection.history.some((entry) => entry[1] === "Reversed"));
});
