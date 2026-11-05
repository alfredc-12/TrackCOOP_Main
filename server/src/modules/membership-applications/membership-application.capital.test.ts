import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import {
  buildCapitalConversionPlan,
  decideApprovalMembership,
  reconcileApplicationCapital,
  synchronizedInitialCapitalRequirementStatus,
  type ApplicationCapitalReference,
} from "./membership-application.capital";

const settings = {
  initialShareCapital: 1500,
  trueMemberRequiredCapital: 3000,
  maximumShareCapital: 15000,
};

function reference(
  id: string,
  amount: number,
  validationStatus: ApplicationCapitalReference["validationStatus"] = "Validated",
): ApplicationCapitalReference {
  return {
    paymentReferenceId: id,
    referenceNumber: `MEM-APP-2026-000500-CAP-${id.padStart(3, "0")}`,
    amount,
    validationStatus,
    validatedBy: validationStatus === "Validated" ? "9" : null,
    validatedAt: validationStatus === "Validated"
      ? new Date("2026-07-27T03:00:00.000Z")
      : null,
    paidAt: validationStatus === "Validated"
      ? new Date("2026-07-27T02:59:00.000Z")
      : null,
    submittedAt: new Date("2026-07-27T02:00:00.000Z"),
  };
}

class FakeReconciliationConnection {
  readonly existing = new Set<string>();
  readonly inserted: Array<{ paymentReferenceId: string; memberId: string }> = [];
  readonly payments = new Map<string, { id: string; memberId: string; amount: number; paymentStatus: string }>();
  readonly credits = new Map<string, { memberId: string; amount: number; transactionDate: string; referenceNumber: string }>();
  balance = 0;
  paymentLinks = 0;
  financeLinks = 0;

  async execute<T = any>(sql: string, values: any[] = []): Promise<[T, any]> {
    if (sql.includes("FROM member_profiles") && sql.includes("FOR UPDATE")) return [[{ id: "800" }] as T, null];
    if (sql.trimStart().startsWith("SELECT") && sql.includes("FROM share_capital_payments WHERE payment_reference_id")) return [[this.payments.get(String(values[0]))].filter(Boolean) as T, null];
    if (sql.includes("FROM share_capital_transactions") && sql.includes("source_type = ?")) {
      const key = String(values[1]); return [this.credits.has(key) ? [{ id: key }] as T : [] as T, null];
    }
    if (sql.includes("INSERT INTO share_capital_accounts")) return [{ affectedRows: 1 } as T, null];
    if (sql.includes("FROM share_capital_accounts")) return [[{ accountId: "1", currentBalance: this.balance }] as T, null];
    if (sql.includes("INSERT INTO share_capital_transactions")) {
      const key = String(values[9]);
      if (this.credits.has(key)) throw new Error("Duplicate ledger source");
      this.credits.set(key, { memberId: String(values[1]), amount: Number(values[4]), transactionDate: String(values[2]), referenceNumber: String(values[7]) });
      return [{ insertId: this.credits.size, affectedRows: 1 } as T, null];
    }
    if (sql.includes("UPDATE share_capital_accounts")) { this.balance = Number(values[4]); return [{ affectedRows: 1 } as T, null]; }
    if (sql.includes("FROM share_capital_payments s") && sql.includes("JOIN payment_references")) {
      return [[...this.existing].map((paymentReferenceId) => ({ paymentReferenceId })) as T, null];
    }
    if (sql.includes("COALESCE(SUM(sp.amount), 0)") && sql.includes("NOT EXISTS")) {
      return [[{ total: 0 }] as T, null];
    }
    if (sql.includes("SELECT COUNT(*) AS total")) {
      return [[{ total: 0 }] as T, null];
    }
    if (sql.includes("INSERT INTO share_capital_payments")) {
      const paymentReferenceId = String(values[1]);
      const affectedRows = this.existing.has(paymentReferenceId) ? 0 : 1;
      if (affectedRows) {
        this.existing.add(paymentReferenceId);
        this.payments.set(paymentReferenceId, { id: `share-${paymentReferenceId}`, memberId: String(values[0]), amount: Number(values[2]), paymentStatus: "Validated" });
        this.inserted.push({ paymentReferenceId, memberId: String(values[0]) });
      }
      return [{ affectedRows, insertId: this.inserted.length } as ResultSetHeader as T, null];
    }
    if (sql.includes("UPDATE payment_references")) {
      this.paymentLinks += 1;
      return [{ affectedRows: 2, insertId: 0 } as ResultSetHeader as T, null];
    }
    if (sql.includes("UPDATE financial_records")) {
      this.financeLinks += 1;
      return [{ affectedRows: 2, insertId: 0 } as ResultSetHeader as T, null];
    }
    throw new Error(`Unexpected SQL in fake connection: ${sql}`);
  }
}

test("a validated PHP 1,500 pre-approval contribution is retained", () => {
  const plan = buildCapitalConversionPlan({
    references: [reference("1", 1500)],
    maximumShareCapital: settings.maximumShareCapital,
  });
  assert.equal(plan.validatedTotal, 1500);
  assert.equal(plan.missingReferences.length, 1);
});

test("two validated installments are preserved as two member capital rows", async () => {
  const connection = new FakeReconciliationConnection();
  const result = await reconcileApplicationCapital({
    connection: connection as unknown as PoolConnection,
    applicationId: "500",
    applicationCode: "MEM-APP-2026-000500",
    memberId: "800",
    actorUserId: "9",
    maximumShareCapital: settings.maximumShareCapital,
    references: [reference("1", 1500), reference("2", 1500)],
  });

  assert.equal(result.validatedCapitalAmount, 3000);
  assert.equal(result.validatedReferenceCount, 2);
  assert.equal(result.insertedCapitalRows, 2);
  assert.deepEqual(connection.inserted, [
    { paymentReferenceId: "1", memberId: "800" },
    { paymentReferenceId: "2", memberId: "800" },
  ]);
  assert.equal(connection.paymentLinks, 1);
  assert.equal(connection.financeLinks, 1);
  assert.equal(connection.credits.size, 2);
  assert.equal(connection.balance, 3000);
  assert.equal(connection.credits.get("share-1")?.transactionDate, "2026-07-27");
});

test("reconciliation retry does not duplicate Share Capital rows", async () => {
  const connection = new FakeReconciliationConnection();
  const input = {
    connection: connection as unknown as PoolConnection,
    applicationId: "500",
    applicationCode: "MEM-APP-2026-000500",
    memberId: "800",
    actorUserId: "9",
    maximumShareCapital: settings.maximumShareCapital,
    references: [reference("1", 1500), reference("2", 1500)],
  };

  const first = await reconcileApplicationCapital(input);
  const second = await reconcileApplicationCapital(input);
  assert.equal(first.insertedCapitalRows, 2);
  assert.equal(second.insertedCapitalRows, 0);
  assert.equal(connection.inserted.length, 2);
  assert.equal(connection.credits.size, 2);
  assert.equal(connection.balance, 3000);
});

test("only Validated application references are converted", () => {
  const plan = buildCapitalConversionPlan({
    references: [
      reference("1", 1500, "Validated"),
      reference("2", 1500, "Pending"),
      reference("3", 1500, "Rejected"),
      reference("4", 1500, "Needs Clarification"),
      reference("5", 1500, "Reversed"),
    ],
    maximumShareCapital: settings.maximumShareCapital,
  });

  assert.deepEqual(
    plan.validatedReferences.map((item) => item.paymentReferenceId),
    ["1"],
  );
  assert.equal(plan.validatedTotal, 1500);
});

test("validated application capital cannot exceed PHP 15,000", () => {
  assert.throws(
    () => buildCapitalConversionPlan({
      references: [reference("1", 10000), reference("2", 5000.01)],
      maximumShareCapital: settings.maximumShareCapital,
    }),
    (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
  );
});

test("official membership type follows configured initial and true-member rules", () => {
  assert.deepEqual(
    decideApprovalMembership({
      requestedMembershipType: "True Member",
      validatedCapitalAmount: 1500,
      settings,
    }),
    {
      membershipType: "Associate",
      trueMemberEligible: false,
      needsShareCapitalDeadline: true,
    },
  );
  assert.deepEqual(
    decideApprovalMembership({
      requestedMembershipType: "True Member",
      validatedCapitalAmount: 3000,
      settings,
    }),
    {
      membershipType: "True Member",
      trueMemberEligible: true,
      needsShareCapitalDeadline: false,
    },
  );
});

test("PHP 1,500 share capital qualifies a True Member application", () => {
  assert.deepEqual(
    decideApprovalMembership({
      requestedMembershipType: "True Member",
      validatedCapitalAmount: 1500,
      settings: { ...settings, trueMemberRequiredCapital: 1500 },
    }),
    {
      membershipType: "True Member",
      trueMemberEligible: true,
      needsShareCapitalDeadline: false,
    },
  );
});

test("initial Share Capital requirement verifies at PHP 1,500 without approving the application", () => {
  const application = { applicationStatus: "Under Review", membershipType: null as string | null };
  const requirementStatus = synchronizedInitialCapitalRequirementStatus({
    currentStatus: "Pending",
    validatedCapitalAmount: 1500,
    initialShareCapital: settings.initialShareCapital,
  });

  assert.equal(requirementStatus, "Verified");
  assert.equal(application.applicationStatus, "Under Review");
  assert.equal(application.membershipType, null);
});

test("a webhook-sized PHP 3,000 total establishes eligibility but does not auto-promote", () => {
  const application = { applicationStatus: "Under Review", convertedMemberId: null as string | null };
  const decision = decideApprovalMembership({
    requestedMembershipType: "True Member",
    validatedCapitalAmount: 3000,
    settings,
  });

  assert.equal(decision.trueMemberEligible, true);
  assert.equal(application.applicationStatus, "Under Review");
  assert.equal(application.convertedMemberId, null);
});


test("previously reconciled payments missing ledger credits are posted once", async () => {
 const connection = new FakeReconciliationConnection();
 connection.existing.add("1");
 connection.payments.set("1", { id: "existing-share", memberId: "800", amount: 1500, paymentStatus: "Validated" });
 const input = { connection: connection as unknown as PoolConnection, applicationId: "500", applicationCode: "MEM-APP-2026-000500", memberId: "800", actorUserId: "9", maximumShareCapital: 15000, references: [reference("1",1500), reference("2",1500)] };
 const first = await reconcileApplicationCapital(input);
 assert.equal(first.insertedCapitalRows,1); assert.equal(connection.balance,3000); assert.equal(connection.credits.size,2);
 const second = await reconcileApplicationCapital(input);
 assert.equal(second.insertedCapitalRows,0); assert.equal(connection.balance,3000); assert.equal(connection.credits.size,2);
});

test("inconsistent historical payment rows are rejected without overwriting or crediting them", async () => {
 const connection = new FakeReconciliationConnection();
 connection.existing.add("1");
 connection.payments.set("1", { id: "existing-share", memberId: "800", amount: 1000, paymentStatus: "Validated" });
 await assert.rejects(()=>reconcileApplicationCapital({connection:connection as unknown as PoolConnection,applicationId:"500",applicationCode:"MEM-APP-2026-000500",memberId:"800",actorUserId:"9",maximumShareCapital:15000,references:[reference("1",1500)]}), (error)=>error instanceof AppError && error.code==="MEMBERSHIP_CAPITAL_POSTING_CONFLICT");
 assert.equal(connection.payments.get("1")?.amount,1000); assert.equal(connection.credits.size,0);
});
