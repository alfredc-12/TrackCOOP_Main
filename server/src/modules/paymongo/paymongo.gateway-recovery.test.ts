import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolConnection } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { PaymentSettlementRepository } from "./paymongo.settlement";
import { createPaymongoGatewayRecoveryService } from "./paymongo.gateway-recovery";

const bookkeeper = { user: { id: "bookkeeper-1", displayName: "Bookkeeper", role: "bookkeeper" } } as AuthContext;
const chairman = { user: { id: "chairman-1", displayName: "Chairman", role: "chairman" } } as AuthContext;
const member = { user: { id: "member-1", displayName: "Member", role: "member" } } as AuthContext;

class RecoveryConnection implements PoolConnection {
  status: "Failed" | "Processed" | "Received" | "Processing" | "Ignored" = "Failed";
  retryCount = 0;
  signatureVerifiedAt: Date | null = new Date("2026-07-27T00:00:00Z");
  amount = 500;
  referenceAmount = 500;
  currency = "PHP";
  auditActions: string[] = [];
  queryCount = 0;
  async beginTransaction() {}
  async commit() {}
  async rollback() {}
  release() {}
  async getConnection() { return this; }
  async execute<T = unknown>(sql: string, values: unknown[] = []): Promise<[T, unknown]> {
    this.queryCount += 1;
    if (sql.includes("FROM payment_gateway_events e") && sql.includes("FOR UPDATE")) {
      return [[{
        eventId: "event-77", paymentReferenceId: "payment-77",
        eventType: "checkout_session.payment.paid", processingStatus: this.status,
        retryCount: this.retryCount, signatureVerifiedAt: this.signatureVerifiedAt,
        checkoutId: "cs_77", paymentId: "pay_77", paymentIntentId: "pi_77",
        livemode: 0, amount: this.amount, currency: this.currency,
        paymentStatus: "paid", paymentMethod: "card", feeAmount: 10, netAmount: 490,
        paidAt: new Date("2026-07-27T01:00:00Z"), referenceAmount: this.referenceAmount,
        referenceStatus: "Pending", referencePurpose: "Share Capital",
        referenceChannel: "PayMongo", referenceEnvironment: "Test",
        referenceCheckoutId: "cs_77", referencePaymentId: null,
        referencePaymentIntentId: null,
      }] as T, null];
    }
    if (sql.includes("FROM payment_gateway_checkout_attempts")) {
      return [[{ environment: "Test", amount: 500 }] as T, null];
    }
    if (sql.includes("SET processing_status = 'Processing'")) {
      this.status = "Processing";
      this.retryCount += 1;
      return [{ affectedRows: 1, insertId: 0 } as T, null];
    }
    if (sql.includes("INSERT INTO audit_logs")) {
      const match = sql.match(/'([^']+)'\s*,\s*'payment_gateway_events'/);
      if (match) this.auditActions.push(match[1]);
    }
    if (sql.includes("SELECT processing_status AS processingStatus")) {
      return [[{ processingStatus: this.status, retryCount: this.retryCount }] as T, null];
    }
    return [{ affectedRows: 1, insertId: 1 } as T, null];
  }
}

function settlement(connection: RecoveryConnection) {
  let calls = 0;
  let captured: any = null;
  const repository: PaymentSettlementRepository = {
    async settlePaymentReference(input) {
      calls += 1;
      captured = input;
      connection.status = "Processed";
      return {
        paymentReferenceId: input.paymentReferenceId,
        alreadySettled: false,
        validationStatus: "Validated",
        receiptStatus: "Generated",
        receiptErrorCode: null,
      };
    },
    async markGatewayEventProcessed() { connection.status = "Processed"; },
    async markGatewayEventFailed() { connection.status = "Failed"; },
  };
  return { repository, calls: () => calls, captured: () => captured };
}

test("Bookkeeper retries a failed verified event using only normalized stored fields", async () => {
  const connection = new RecoveryConnection();
  const settled = settlement(connection);
  const result = await createPaymongoGatewayRecoveryService(connection as unknown as Pool, settled.repository)
    .retryFailedEvent({ gatewayEventId: "event-77", note: "Retry after member reconciliation", auth: bookkeeper });
  assert.equal(result.processingStatus, "Processed");
  assert.equal(result.retryCount, 1);
  assert.equal(settled.calls(), 1);
  assert.equal(settled.captured().actorUserId, null);
  assert.equal(settled.captured().gatewayEventId, "event-77");
  assert.deepEqual(settled.captured().gatewayDetails, {
    checkoutId: "cs_77", paymentId: "pay_77", paymentIntentId: "pi_77",
    gatewayStatus: "paid", paymentMethod: "card", amount: 500,
    currency: "PHP", feeAmount: 10, netAmount: 490,
    paidAt: new Date("2026-07-27T01:00:00Z"), environment: "Test",
  });
  assert.ok(connection.auditActions.includes("payment_gateway_event.retry_requested"));
});

test("Chairman and Member cannot retry gateway settlement", async () => {
  for (const auth of [chairman, member]) {
    const connection = new RecoveryConnection();
    await assert.rejects(
      () => createPaymongoGatewayRecoveryService(connection as unknown as Pool, settlement(connection).repository)
        .retryFailedEvent({ gatewayEventId: "event-77", note: "Retry after reconciliation", auth }),
      (error) => error instanceof AppError && error.code === "FORBIDDEN",
    );
    assert.equal(connection.queryCount, 0);
  }
});

test("retry requires Failed state, prior signature verification, and matching amount", async () => {
  const received = new RecoveryConnection();
  received.status = "Received";
  await assert.rejects(
    () => createPaymongoGatewayRecoveryService(received as unknown as Pool, settlement(received).repository)
      .retryFailedEvent({ gatewayEventId: "event-77", note: "Retry after reconciliation", auth: bookkeeper }),
    (error) => error instanceof AppError && error.code === "GATEWAY_EVENT_NOT_FAILED",
  );
  const unsigned = new RecoveryConnection();
  unsigned.signatureVerifiedAt = null;
  await assert.rejects(
    () => createPaymongoGatewayRecoveryService(unsigned as unknown as Pool, settlement(unsigned).repository)
      .retryFailedEvent({ gatewayEventId: "event-77", note: "Retry after reconciliation", auth: bookkeeper }),
    (error) => error instanceof AppError && error.code === "GATEWAY_EVENT_SIGNATURE_NOT_VERIFIED",
  );
  const mismatch = new RecoveryConnection();
  mismatch.referenceAmount = 600;
  await assert.rejects(
    () => createPaymongoGatewayRecoveryService(mismatch as unknown as Pool, settlement(mismatch).repository)
      .retryFailedEvent({ gatewayEventId: "event-77", note: "Retry after reconciliation", auth: bookkeeper }),
    (error) => error instanceof AppError && error.code === "PAYMENT_AMOUNT_MISMATCH",
  );
});

test("a duplicate retry after processing returns an idempotent safe result", async () => {
  const connection = new RecoveryConnection();
  connection.status = "Processed";
  connection.retryCount = 2;
  const settled = settlement(connection);
  const result = await createPaymongoGatewayRecoveryService(connection as unknown as Pool, settled.repository)
    .retryFailedEvent({ gatewayEventId: "event-77", note: "Confirm already processed event", auth: bookkeeper });
  assert.equal(result.alreadyProcessed, true);
  assert.equal(result.retryCount, 2);
  assert.equal(settled.calls(), 0);
});
