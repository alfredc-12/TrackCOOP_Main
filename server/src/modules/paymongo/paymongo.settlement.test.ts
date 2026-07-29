import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolConnection } from "mysql2/promise";
import { createPaymentSettlementRepository } from "./paymongo.settlement";

type ExecuteCall = {
  sql: string;
  values: unknown[] | undefined;
};

function makePool(options: { failFinanceInsert?: boolean } = {}) {
  const executeCalls: ExecuteCall[] = [];
  const counters = {
    begin: 0,
    commit: 0,
    rollback: 0,
    release: 0,
  };

  const connection = {
    async beginTransaction() {
      counters.begin += 1;
    },
    async commit() {
      counters.commit += 1;
    },
    async rollback() {
      counters.rollback += 1;
    },
    release() {
      counters.release += 1;
    },
    async execute(sql: string, values?: unknown[]) {
      executeCalls.push({ sql, values });

      if (options.failFinanceInsert && sql.includes("INSERT IGNORE INTO financial_records")) {
        throw new Error("finance insert failed");
      }

      if (sql.includes("COALESCE(SUM(amount), 0) AS total")) {
        return [[{ total: "200.00" }], []];
      }

      if (sql.includes("FROM payment_references")) {
        return [[{
          id: "900",
          memberId: null,
          payerName: "Applicant",
          referenceNumber: "MEM-APP-2026-000300-FEE",
          paymentPurpose: "Associate Membership Fee",
          relatedEntityType: "membership_application",
          relatedEntityId: "300",
          amount: "200.00",
          validationStatus: "Pending",
          paymentChannel: "PayMongo",
          gatewayEnvironment: "Test",
          gatewayCheckoutId: "cs_test_123",
          gatewayPaymentId: null,
          gatewayPaymentIntentId: null,
        }], []];
      }
      if (sql.includes("FROM users u") && sql.includes("JOIN roles")) {
        return [[{
          id: "900",
          displayName: "PayMongo System Service",
          username: "paymongo-system",
          accountStatus: "Active",
          role: "bookkeeper",
          roleIsActive: 1,
        }], []];
      }
      if (sql.includes("FROM membership_applications")) {
        return [[{
          id: "300",
          applicationCode: "APP-SEED-0300",
          applicationStatus: "Pending Payment",
          requestedMembershipType: "Associate",
          convertedMemberId: null,
          memberUserId: null,
          fullName: "Applicant One",
        }], []];
      }
      if (sql.includes("FROM membership_application_requirements")) {
        return [[{
          id: "400",
          requirementStatus: "Pending",
        }], []];
      }
      if (sql.includes("FROM system_settings")) {
        return [[{ value: "200" }], []];
      }
      if (sql.includes("FROM financial_categories")) {
        return [[{ id: "10" }], []];
      }

      return [{ affectedRows: 1, insertId: 1 }, []];
    },
  } as unknown as PoolConnection;

  const pool = {
    async getConnection() {
      return connection;
    },
  } as unknown as Pool;

  return { pool, executeCalls, counters };
}

test("settlePaymentReference posts membership fee side effects in one transaction", async () => {
  const { pool, executeCalls, counters } = makePool();
  const repository = createPaymentSettlementRepository(pool, {
    systemActorUserId: "900",
    receiptService: {
      async getStatus() { return null; },
      async process() { return null; },
    },
  });

  const result = await repository.settlePaymentReference({
    paymentReferenceId: "900",
    validationSource: "PayMongo Webhook",
    actorUserId: null,
    gatewayEventId: "70",
    gatewayDetails: {
      checkoutId: "cs_test_123",
      paymentId: "pay_test_123",
      paymentIntentId: "pi_test_123",
      gatewayStatus: "paid",
      paymentMethod: "card",
      amount: 200,
      currency: "PHP",
      feeAmount: 5,
      netAmount: 195,
      paidAt: new Date("2026-07-26T01:02:03.000Z"),
      environment: "Test",
    },
  });

  const sql = executeCalls.map((call) => call.sql);

  assert.deepEqual(result, {
    paymentReferenceId: "900",
    alreadySettled: false,
    validationStatus: "Validated",
    receiptStatus: null,
    receiptErrorCode: null,
  });
  assert.equal(counters.begin, 1);
  assert.equal(counters.commit, 1);
  assert.equal(counters.rollback, 0);
  assert.equal(counters.release, 1);
  assert.ok(sql.some((statement) => statement.includes("UPDATE payment_references")));
  assert.ok(sql.some((statement) => statement.includes("INSERT INTO payment_validation_history")));
  assert.ok(sql.some((statement) => statement.includes("UPDATE membership_application_requirements")));
  assert.ok(sql.some((statement) => statement.includes("INSERT IGNORE INTO financial_records")));
  assert.ok(sql.some((statement) => statement.includes("INSERT INTO membership_application_status_history")));
  assert.ok(sql.some((statement) => statement.includes("INSERT INTO notifications")));
  assert.ok(sql.some((statement) => statement.includes("INSERT INTO audit_logs")));
  assert.ok(sql.some((statement) => statement.includes("UPDATE payment_gateway_events")));
});

test("settlePaymentReference rolls back all business changes when posting fails", async () => {
  const { pool, counters } = makePool({ failFinanceInsert: true });
  const repository = createPaymentSettlementRepository(pool, {
    systemActorUserId: "900",
    receiptService: {
      async getStatus() { return null; },
      async process() { return null; },
    },
  });

  await assert.rejects(
    () => repository.settlePaymentReference({
      paymentReferenceId: "900",
      validationSource: "PayMongo Webhook",
      actorUserId: null,
      gatewayEventId: "70",
      gatewayDetails: {
        checkoutId: "cs_test_123",
        paymentId: "pay_test_123",
        paymentIntentId: "pi_test_123",
        gatewayStatus: "paid",
        paymentMethod: "card",
        amount: 200,
        currency: "PHP",
        feeAmount: 5,
        netAmount: 195,
        paidAt: new Date("2026-07-26T01:02:03.000Z"),
        environment: "Test",
      },
    }),
    /finance insert failed/,
  );

  assert.equal(counters.begin, 1);
  assert.equal(counters.commit, 0);
  assert.equal(counters.rollback, 1);
  assert.equal(counters.release, 1);
});
