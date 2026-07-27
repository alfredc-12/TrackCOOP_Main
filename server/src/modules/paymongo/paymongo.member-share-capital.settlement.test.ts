import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";
import { createPaymentSettlementRepository } from "./paymongo.settlement";
import { postMemberShareCapitalSettlement } from "./paymongo.settlement.member-share-capital";
import { ensureMemberShareCapitalReceipt } from "./paymongo.settlement.receipt";

class SettlementConnection implements PoolConnection {
  validationStatus = "Pending";
  memberPostingCalls = 0;
  commits = 0;
  rollbacks = 0;
  async beginTransaction() {}
  async commit() { this.commits += 1; }
  async rollback() { this.rollbacks += 1; }
  release() {}
  async getConnection() { return this; }
  async execute<T = unknown>(sql: string): Promise<[T, unknown]> {
    if (sql.includes("FROM payment_references") && sql.includes("FOR UPDATE")) {
      return [[{
        id: "501",
        memberId: "member-10",
        payerName: "Member Ten",
        payerEmail: "member10@example.test",
        payerContact: "09170000000",
        provider: "PayMongo Hosted Checkout",
        referenceNumber: "SC-2026-000501",
        paymentPurpose: "Share Capital",
        relatedEntityType: "member_profile",
        relatedEntityId: "member-10",
        amount: 1500,
        validationStatus: this.validationStatus,
        paymentChannel: "PayMongo",
        gatewayEnvironment: "Test",
        gatewayCheckoutId: "cs_501",
        gatewayPaymentId: this.validationStatus === "Validated" ? "pay_501" : null,
        gatewayPaymentIntentId: null,
      }] as T, null];
    }
    if (sql.includes("FROM users u JOIN roles")) {
      return [[{ id: "bookkeeper-1" }] as T, null];
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
  const pool = connection as unknown as Pool;
  const repository = createPaymentSettlementRepository(pool, {
    async postMemberShareCapitalSettlement() {
      connection.memberPostingCalls += 1;
      return {
        shareCapitalCreated: true,
        financeCreated: true,
        receipt: {
          receiptId: "1",
          receiptNumber: "PAY-RCPT-2026-000501",
          documentId: "1",
          created: true,
        },
        notificationCreated: true,
        auditCreated: true,
      };
    },
  });
  const input = {
    paymentReferenceId: "501",
    validationSource: "PayMongo Webhook" as const,
    actorUserId: null,
    gatewayEventId: "event-501",
    gatewayDetails: {
      checkoutId: "cs_501",
      paymentId: "pay_501",
      amount: 1500,
      currency: "PHP" as const,
      environment: "Test" as const,
      gatewayStatus: "paid",
      paidAt: new Date("2026-07-27T10:00:00.000Z"),
    },
  };
  const first = await repository.settlePaymentReference(input);
  const second = await repository.settlePaymentReference(input);
  assert.equal(first.alreadySettled, false);
  assert.equal(second.alreadySettled, true);
  assert.equal(connection.memberPostingCalls, 1);
});


const settledPayment = {
  id: "601",
  memberId: "member-10",
  payerName: "Member Ten",
  payerEmail: "member10@example.test",
  payerContact: "09170000000",
  provider: "PayMongo Hosted Checkout",
  referenceNumber: "SC-2026-000601",
  paymentPurpose: "Share Capital",
  relatedEntityType: "member_profile",
  relatedEntityId: "member-10",
  amount: 1500,
  validationStatus: "Validated" as const,
  paymentChannel: "PayMongo",
  gatewayEnvironment: "Test" as const,
  gatewayCheckoutId: "cs_601",
  gatewayPaymentId: "pay_601",
  gatewayPaymentIntentId: null,
};

class ReceiptConnection implements PoolConnection {
  receipt: { receiptId: string; receiptNumber: string; documentId: string } | null = null;
  insertCount = 0;
  async beginTransaction() {}
  async commit() {}
  async rollback() {}
  release() {}
  async getConnection() { return this; }
  async execute<T = unknown>(sql: string, values?: any[]): Promise<[T, unknown]> {
    if (sql.includes("FROM payment_receipts")) {
      return [[...(this.receipt ? [this.receipt] : [])] as T, null];
    }
    if (sql.includes("INSERT INTO payment_receipts")) {
      this.insertCount += 1;
      this.receipt = {
        receiptId: "1",
        receiptNumber: String(values?.[3]),
        documentId: String(values?.[2]),
      };
      return [{ affectedRows: 1, insertId: 1 } as T, null];
    }
    throw new Error(`Unexpected receipt SQL: ${sql}`);
  }
}

test("receipt generation is idempotent per payment reference", async () => {
  const connection = new ReceiptConnection();
  let documentCount = 0;
  const input = {
    connection: connection as unknown as PoolConnection,
    payment: settledPayment,
    memberId: "member-10",
    memberCode: "NFFAC-2026-000010",
    memberName: "Member Ten",
    actorUserId: "bookkeeper-1",
    gatewayDetails: { amount: 1500, currency: "PHP" as const },
  };
  const dependencies = {
    async createDocument() {
      documentCount += 1;
      return { documentId: 77, documentReference: "DOC-2026-000077" };
    },
  };
  const first = await ensureMemberShareCapitalReceipt(input, dependencies);
  const second = await ensureMemberShareCapitalReceipt(input, dependencies);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.receiptNumber, second.receiptNumber);
  assert.equal(documentCount, 1);
  assert.equal(connection.insertCount, 1);
});

class PostingConnection implements PoolConnection {
  shareInserted = false;
  financeInserted = false;
  notifications = 0;
  audits = 0;
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
      return [[{
        id: "member-10",
        userId: "user-10",
        memberCode: "NFFAC-2026-000010",
        fullName: "Member Ten",
        membershipType: this.memberType,
        approvalStatus: "Approved",
        officialMemberStatus: "Active",
      }] as T, null];
    }
    if (sql.includes("FROM system_settings")) return [[{ value: "15000" }] as T, null];
    if (sql.includes("FROM share_capital_payments") && sql.includes("SUM")) {
      return [[{ total: this.shareInserted ? 1500 : 0 }] as T, null];
    }
    if (sql.includes("FROM financial_categories")) return [[{ id: "4" }] as T, null];
    if (sql.includes("INSERT INTO share_capital_payments")) {
      const affectedRows = this.shareInserted ? 0 : 1;
      this.shareInserted = true;
      return [{ affectedRows, insertId: 1 } as T, null];
    }
    if (sql.includes("INSERT IGNORE INTO financial_records")) {
      const affectedRows = this.financeInserted ? 0 : 1;
      this.financeInserted = true;
      return [{ affectedRows, insertId: 1 } as T, null];
    }
    if (sql.includes("INSERT INTO notifications")) {
      this.notifications += 1;
      return [{ affectedRows: 1, insertId: 1 } as T, null];
    }
    if (sql.includes("INSERT INTO audit_logs")) {
      this.audits += 1;
      return [{ affectedRows: 1, insertId: 1 } as T, null];
    }
    throw new Error(`Unexpected posting SQL: ${sql}`);
  }
}

test("member settlement creates capital, finance, receipt, notification and audit once without auto-promotion", async () => {
  const connection = new PostingConnection();
  let receiptCreated = false;
  const dependencies = {
    async ensureReceipt() {
      const created = !receiptCreated;
      receiptCreated = true;
      return {
        receiptId: "1",
        receiptNumber: "PAY-RCPT-2026-000601",
        documentId: "77",
        created,
      };
    },
  };
  const input = {
    connection: connection as unknown as PoolConnection,
    payment: settledPayment,
    actorUserId: "bookkeeper-1",
    gatewayDetails: { amount: 1500, currency: "PHP" as const },
  };
  const first = await postMemberShareCapitalSettlement(input, dependencies);
  const second = await postMemberShareCapitalSettlement(input, dependencies);
  assert.equal(first.shareCapitalCreated, true);
  assert.equal(first.financeCreated, true);
  assert.equal(first.receipt.created, true);
  assert.equal(second.shareCapitalCreated, false);
  assert.equal(second.financeCreated, false);
  assert.equal(second.receipt.created, false);
  assert.equal(connection.notifications, 1);
  assert.equal(connection.audits, 1);
  assert.equal(connection.memberType, "Associate");
});
