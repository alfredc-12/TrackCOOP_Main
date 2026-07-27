import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolConnection } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import { createPaymentSettlementRepository } from "./paymongo.settlement";

class CentralConnection implements PoolConnection {
  status = "Pending";
  commits = 0;
  rollbacks = 0;
  posting = 0;
  communication = 0;
  queued = 0;
  audits = 0;
  actorQueries: string[] = [];
  auditDescriptions: string[] = [];
  constructor(readonly channel: string) {}
  async beginTransaction() {}
  async commit() { this.commits += 1; }
  async rollback() { this.rollbacks += 1; }
  release() {}
  async getConnection() { return this; }
  async execute<T = unknown>(sql: string, values: unknown[] = []): Promise<[T, unknown]> {
    if (sql.includes("FROM payment_references") && sql.includes("FOR UPDATE")) {
      return [[{
        id: "701", memberId: "member-7", payerName: "Member Seven", payerEmail: null,
        payerContact: null, provider: this.channel === "PayMongo" ? "PayMongo Hosted Checkout" : "Manual",
        referenceNumber: "SC-701", paymentPurpose: "Share Capital",
        relatedEntityType: "member_profile", relatedEntityId: "member-7", amount: 500,
        validationStatus: this.status, paymentChannel: this.channel,
        gatewayEnvironment: this.channel === "PayMongo" ? "Test" : "Manual",
        gatewayCheckoutId: this.channel === "PayMongo" ? "cs_701" : null,
        gatewayPaymentId: this.status === "Validated" && this.channel === "PayMongo" ? "pay_701" : null,
        gatewayPaymentIntentId: null, paidAt: null, validatedAt: null,
      }] as T, null];
    }
    if (sql.includes("FROM users u") && sql.includes("WHERE u.user_id = ?")) {
      const id = String(values[0]);
      this.actorQueries.push(id);
      if (id === "900") return [[{
        id, displayName: "PayMongo System Service", username: "paymongo-system",
        accountStatus: "Active", role: "bookkeeper", roleIsActive: 1,
      }] as T, null];
      if (id === "bookkeeper-1") return [[{
        id, displayName: "Bookkeeper One", username: "bookkeeper-one",
        accountStatus: "Active", role: "bookkeeper", roleIsActive: 1,
      }] as T, null];
      return [[] as T, null];
    }
    if (sql.includes("FROM member_profiles") && sql.includes("member_code")) {
      return [[{ id: "member-7", userId: "user-7", memberCode: "NFFAC-7", fullName: "Member Seven" }] as T, null];
    }
    if (sql.startsWith("UPDATE payment_references")) {
      this.status = "Validated";
      return [{ affectedRows: 1, insertId: 0 } as T, null];
    }
    if (sql.includes("INSERT INTO audit_logs")) {
      this.audits += 1;
      if (typeof values[2] === "string") this.auditDescriptions.push(values[2]);
    }
    return [{ affectedRows: 1, insertId: 1 } as T, null];
  }
}

function repositoryFor(connection: CentralConnection, receiptStates: Array<"Failed" | "Generated">) {
  let receiptCall = 0;
  return createPaymentSettlementRepository(connection as unknown as Pool, {
    async postMemberShareCapitalSettlement() {
      connection.posting += 1;
      return {
        shareCapitalCreated: true, financeCreated: true, memberId: "member-7",
        memberUserId: "user-7", subjectReference: "NFFAC-7",
        subjectName: "Member Seven", membershipType: "Associate",
      };
    },
    async recordSettlementCommunication() { connection.communication += 1; },
    async queuePaymentReceipt() { connection.queued += 1; },
    systemActorUserId: "900",
    receiptService: {
      async getStatus() { return null; },
      async process() {
        const processingStatus = receiptStates[Math.min(receiptCall++, receiptStates.length - 1)];
        return {
          paymentReferenceId: "701", receiptNumber: "PAY-RCPT-701", processingStatus,
          documentId: processingStatus === "Generated" ? "88" : null,
          attemptCount: receiptCall,
          lastErrorCode: processingStatus === "Failed" ? "FILESYSTEM_WRITE_FAILED" : null,
          lastErrorMessage: processingStatus === "Failed" ? "Safe receipt failure" : null,
          reversedAt: null, reversalNote: null,
        };
      },
    },
  });
}

test("manual and PayMongo paths use the same centralized settlement workflow", async () => {
  const manual = new CentralConnection("Cash");
  const manualResult = await repositoryFor(manual, ["Generated"]).settlePaymentReference({
    paymentReferenceId: "701", validationSource: "Manual Bookkeeper",
    actorUserId: "bookkeeper-1", gatewayDetails: null,
  });
  const gateway = new CentralConnection("PayMongo");
  const gatewayResult = await repositoryFor(gateway, ["Generated"]).settlePaymentReference({
    paymentReferenceId: "701", validationSource: "PayMongo Webhook", actorUserId: null,
    gatewayEventId: "event-701", gatewayDetails: {
      checkoutId: "cs_701", paymentId: "pay_701", amount: 500,
      currency: "PHP", environment: "Test", gatewayStatus: "paid",
    },
  });
  for (const [connection, result] of [[manual, manualResult], [gateway, gatewayResult]] as const) {
    assert.equal(result.validationStatus, "Validated");
    assert.equal(connection.posting, 1);
    assert.equal(connection.communication, 1);
    assert.equal(connection.queued, 1);
    assert.equal(connection.audits, 1);
    assert.equal(connection.commits, 1);
    assert.equal(connection.actorQueries.length, 1);
  }
  assert.deepEqual(manual.actorQueries, ["bookkeeper-1"]);
  assert.deepEqual(gateway.actorQueries, ["900"]);
  assert.match(manual.auditDescriptions[0], /authenticated Bookkeeper/);
  assert.match(gateway.auditDescriptions[0], /automated PayMongo webhook/);
});

test("source and channel mismatches are rejected", async () => {
  const paymongo = new CentralConnection("PayMongo");
  await assert.rejects(
    () => repositoryFor(paymongo, ["Generated"]).settlePaymentReference({
      paymentReferenceId: "701", validationSource: "Manual Bookkeeper",
      actorUserId: "bookkeeper-1", gatewayDetails: null,
    }),
    (error) => error instanceof AppError && error.code === "PAYMENT_MANUAL_CHANNEL_REQUIRED",
  );
  const manual = new CentralConnection("Cash");
  await assert.rejects(
    () => repositoryFor(manual, ["Generated"]).settlePaymentReference({
      paymentReferenceId: "701", validationSource: "PayMongo Webhook", actorUserId: null,
      gatewayDetails: { checkoutId: "cs", paymentId: "pay", amount: 500, currency: "PHP" },
    }),
    (error) => error instanceof AppError && error.code === "PAYMENT_PAYMONGO_CHANNEL_REQUIRED",
  );
});

test("receipt failure does not undo payment and retry succeeds without reposting", async () => {
  const connection = new CentralConnection("PayMongo");
  const repository = repositoryFor(connection, ["Failed", "Generated"]);
  const input = {
    paymentReferenceId: "701", validationSource: "PayMongo Webhook" as const, actorUserId: null,
    gatewayEventId: "event-701", gatewayDetails: {
      checkoutId: "cs_701", paymentId: "pay_701", amount: 500,
      currency: "PHP" as const, environment: "Test" as const,
    },
  };
  const first = await repository.settlePaymentReference(input);
  const second = await repository.settlePaymentReference(input);
  assert.equal(first.receiptStatus, "Failed");
  assert.equal(first.validationStatus, "Validated");
  assert.equal(second.alreadySettled, true);
  assert.equal(second.receiptStatus, "Generated");
  assert.equal(connection.posting, 1);
  assert.equal(connection.commits, 2);
});
