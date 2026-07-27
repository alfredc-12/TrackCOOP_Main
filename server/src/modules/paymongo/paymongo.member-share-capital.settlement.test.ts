import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolConnection } from "mysql2/promise";
import { createPaymentSettlementRepository } from "./paymongo.settlement";
import { postMemberShareCapitalSettlement } from "./paymongo.settlement.member-share-capital";

class SettlementConnection implements PoolConnection {
  validationStatus = "Pending";
  memberPostingCalls = 0;
  commits = 0;
  async beginTransaction() {}
  async commit() { this.commits += 1; }
  async rollback() {}
  release() {}
  async getConnection() { return this; }
  async execute<T = unknown>(sql: string, values: unknown[] = []): Promise<[T, unknown]> {
    if (sql.includes("FROM payment_references") && sql.includes("FOR UPDATE")) {
      return [[{
        id: "501", memberId: "member-10", payerName: "Member Ten",
        payerEmail: "member10@example.test", payerContact: "09170000000",
        provider: "PayMongo Hosted Checkout", referenceNumber: "SC-2026-000501",
        paymentPurpose: "Share Capital", relatedEntityType: "member_profile",
        relatedEntityId: "member-10", amount: 1500, validationStatus: this.validationStatus,
        paymentChannel: "PayMongo", gatewayEnvironment: "Test", gatewayCheckoutId: "cs_501",
        gatewayPaymentId: this.validationStatus === "Validated" ? "pay_501" : null,
        gatewayPaymentIntentId: null, paidAt: null, validatedAt: null,
      }] as T, null];
    }
    if (sql.includes("FROM users u") && sql.includes("WHERE u.user_id = ?")) {
      return [[{
        id: String(values[0]), displayName: "PayMongo System Service",
        username: "paymongo-system", accountStatus: "Active",
        role: "bookkeeper", roleIsActive: 1,
      }] as T, null];
    }
    if (sql.includes("FROM member_profiles") && sql.includes("member_code")) {
      return [[{ id: "member-10", userId: "user-10", memberCode: "NFFAC-10", fullName: "Member Ten" }] as T, null];
    }
    if (sql.startsWith("UPDATE payment_references")) {
      this.validationStatus = "Validated";
      return [{ affectedRows: 1, insertId: 0 } as T, null];
    }
    return [{ affectedRows: 1, insertId: 1 } as T, null];
  }
}

test("duplicate webhook settlement posts the Member contribution exactly once", async () => {
  const connection = new SettlementConnection();
  const repository = createPaymentSettlementRepository(connection as unknown as Pool, {
    async postMemberShareCapitalSettlement() {
      connection.memberPostingCalls += 1;
      return {
        shareCapitalCreated: true,
        financeCreated: true,
        memberId: "member-10",
        memberUserId: "user-10",
        subjectReference: "NFFAC-10",
        subjectName: "Member Ten",
        membershipType: "Associate",
      };
    },
    async recordSettlementCommunication() {},
    async queuePaymentReceipt() {},
    systemActorUserId: "900",
    receiptService: {
      async getStatus() { return null; },
      async process() {
        return {
          paymentReferenceId: "501", receiptNumber: "PAY-RCPT-2026-000501",
          processingStatus: "Generated", documentId: "77", attemptCount: 1,
          lastErrorCode: null, lastErrorMessage: null, reversedAt: null, reversalNote: null,
        };
      },
    },
  });
  const input = {
    paymentReferenceId: "501", validationSource: "PayMongo Webhook" as const,
    actorUserId: null, gatewayEventId: "event-501",
    gatewayDetails: {
      checkoutId: "cs_501", paymentId: "pay_501", amount: 1500,
      currency: "PHP" as const, environment: "Test" as const,
      gatewayStatus: "paid", paidAt: new Date("2026-07-27T10:00:00.000Z"),
    },
  };
  const first = await repository.settlePaymentReference(input);
  const second = await repository.settlePaymentReference(input);
  assert.equal(first.alreadySettled, false);
  assert.equal(second.alreadySettled, true);
  assert.equal(connection.memberPostingCalls, 1);
  assert.equal(first.receiptStatus, "Generated");
});

class PostingConnection implements PoolConnection {
  memberType = "Associate";
  async beginTransaction() {}
  async commit() {}
  async rollback() {}
  release() {}
  async getConnection() { return this; }
  async execute<T = unknown>(sql: string): Promise<[T, unknown]> {
    if (/UPDATE\s+member_profiles/i.test(sql) || /membership_type\s*=/i.test(sql)) {
      throw new Error("Member settlement must not promote membership type");
    }
    if (sql.includes("FROM member_profiles") && sql.includes("FOR UPDATE")) {
      return [[{ id: "member-10", userId: "user-10", memberCode: "NFFAC-10",
        fullName: "Member Ten", membershipType: this.memberType,
        approvalStatus: "Approved", officialMemberStatus: "Active" }] as T, null];
    }
    if (sql.includes("FROM system_settings")) return [[{ value: "15000" }] as T, null];
    if (sql.includes("FROM share_capital_payments") && sql.includes("SUM")) return [[{ total: 0 }] as T, null];
    if (sql.includes("FROM financial_categories")) return [[{ id: "4" }] as T, null];
    return [{ affectedRows: 1, insertId: 1 } as T, null];
  }
}

test("member settlement posts finance and capital without automatic promotion", async () => {
  const result = await postMemberShareCapitalSettlement({
    connection: new PostingConnection() as unknown as PoolConnection,
    payment: {
      id: "601", memberId: "member-10", payerName: "Member Ten", payerEmail: null,
      payerContact: null, provider: "PayMongo", referenceNumber: "SC-601",
      paymentPurpose: "Share Capital", relatedEntityType: "member_profile",
      relatedEntityId: "member-10", amount: 1500, validationStatus: "Validated",
      paymentChannel: "PayMongo", gatewayEnvironment: "Test", gatewayCheckoutId: "cs",
      gatewayPaymentId: "pay", gatewayPaymentIntentId: null,
    },
    actorUserId: "bookkeeper-1",
    gatewayDetails: { amount: 1500, currency: "PHP" },
  });
  assert.equal(result.shareCapitalCreated, true);
  assert.equal(result.financeCreated, true);
  assert.equal(result.membershipType, "Associate");
});
