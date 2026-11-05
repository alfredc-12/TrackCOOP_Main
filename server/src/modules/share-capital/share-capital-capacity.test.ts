import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolConnection } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  assertLockedMemberShareCapitalCapacity,
  selectMemberShareCapitalCapacity,
} from "./share-capital-capacity";
import { createShareCapitalRepository } from "./share-capital.repository";
import { postShareCapitalPaymentToLedger } from "./share-capital-ledger.repository";

const bookkeeperAuth: AuthContext = {
  user: {
    id: "2",
    displayName: "Bookkeeper",
    email: "bookkeeper@example.test",
    username: "bookkeeper",
    role: "bookkeeper",
  },
  sessionId: "1",
  tokenHash: "hash",
};

class CapacityDatabase {
  state = {
    ledgerBalance: 5000,
    validatedPayments: [
      { id: "1", amount: 5000, status: "Validated" as "Validated" | "Pending" | "Rejected" },
    ],
    activePendingQrph: 0,
    pendingPatronageTransfers: 0,
    pendingDividendCapitalizations: 0,
  };
  statements: string[] = [];

  async getConnection(): Promise<PoolConnection> {
    return {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      execute: this.execute.bind(this),
    } as unknown as PoolConnection;
  }

  async execute(sql: string, values: unknown[] = []) {
    this.statements.push(sql);
    const rows = (value: unknown) => [value, []];
    const write = (id = 1) => rows({ insertId: id, affectedRows: 1 });

    if (sql.includes("FROM member_profiles") && sql.includes("FOR UPDATE")) {
      return rows([{ member_id: String(values[0] ?? "1") }]);
    }
    if (sql.includes("AS ledgerBalance") && sql.includes("AS validatedPayments") && sql.includes("AS activePendingQrph")) {
      const excludingPaymentId = sql.includes("AND share_payment_id <> ?") ? String(values[1]) : null;
      const excludedPaymentAmount = excludingPaymentId
        ? this.state.validatedPayments.find((item) => item.id === excludingPaymentId && item.status === "Validated")?.amount ?? 0
        : 0;
      const validatedPayments = this.state.validatedPayments
        .filter((item) => item.status === "Validated" && item.id !== excludingPaymentId)
        .reduce((sum, item) => sum + item.amount, 0);
      return rows([{
        ledgerBalance: Math.max(0, this.state.ledgerBalance - excludedPaymentAmount),
        validatedPayments,
        activePendingQrph: this.state.activePendingQrph,
        pendingPatronageTransfers: this.state.pendingPatronageTransfers,
        pendingDividendCapitalizations: this.state.pendingDividendCapitalizations,
      }]);
    }
    if (sql.includes("INSERT INTO share_capital_accounts")) {
      return write();
    }
    if (sql.includes("FROM share_capital_accounts") && sql.includes("FOR UPDATE")) {
      return rows([{
        accountId: "10",
        memberId: "1",
        currentBalance: this.state.ledgerBalance,
      }]);
    }
    if (sql.includes("SELECT CAST(share_capital_transaction_id AS CHAR) AS id") && sql.includes("FROM share_capital_transactions")) {
      return rows([]);
    }
    if (sql.includes("SELECT CAST(s.share_payment_id AS CHAR) AS id") && sql.includes("WHERE s.share_payment_id = ?")) {
      const targetId = String(values[0]);
      const found = this.state.validatedPayments.find((item) => item.id === targetId);
      if (!found) return rows([]);
      return rows([{
        id: found.id,
        memberId: "1",
        memberCode: "MEM-2026-0001",
        memberName: "Juan Dela Cruz",
        paymentReferenceId: null,
        referenceNumber: null,
        amount: found.amount,
        paymentDate: "2026-06-01",
        paymentStatus: found.status,
        verifiedBy: "2",
        verifiedByName: "Bookkeeper",
        verifiedAt: new Date("2026-06-01T00:00:00Z"),
        remarks: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
      }]);
    }
    if (sql.includes("INSERT INTO share_capital_payments")) {
      const nextId = String(this.state.validatedPayments.length + 1);
      const amount = Number(values[2]);
      const status = String(values[4]) as "Validated" | "Pending" | "Rejected";
      this.state.validatedPayments.push({ id: nextId, amount, status });
      return write(Number(nextId));
    }
    if (sql.includes("UPDATE share_capital_payments")) {
      const targetId = String(values[9]);
      const target = this.state.validatedPayments.find((item) => item.id === targetId);
      if (target) {
        target.amount = Number(values[2]);
        target.status = String(values[4]) as "Validated" | "Pending" | "Rejected";
      }
      return write();
    }
    if (sql.includes("INSERT INTO share_capital_transactions")) {
      this.state.ledgerBalance = Number(values[6]);
      return write(100);
    }
    if (sql.includes("UPDATE share_capital_accounts")) {
      this.state.ledgerBalance = Number(values[0]);
      return write();
    }
    if (sql.includes("INSERT INTO audit_logs")) {
      return write();
    }

    throw new Error(`Unexpected SQL in CapacityDatabase: ${sql}`);
  }

  pool(): Pool {
    return this as unknown as Pool;
  }
}

test("selectMemberShareCapitalCapacity uses GREATEST(ledgerBalance, validatedPayments) and subtracts all pending reservations", async () => {
  const db = new CapacityDatabase();
  db.state.ledgerBalance = 12000;
  db.state.validatedPayments = [{ id: "1", amount: 13000, status: "Validated" }];
  db.state.activePendingQrph = 500;
  db.state.pendingPatronageTransfers = 400;
  db.state.pendingDividendCapitalizations = 300;

  const snapshot = await selectMemberShareCapitalCapacity(await db.getConnection(), {
    memberId: "1",
  });

  assert.equal(snapshot.ledgerBalance, 12000);
  assert.equal(snapshot.validatedPayments, 13000);
  assert.equal(snapshot.committedCapital, 13000);
  assert.equal(snapshot.reservedCapital, 1200);
  assert.equal(snapshot.availableCapacity, 800);
});

test("assertLockedMemberShareCapitalCapacity locks member_profiles FOR UPDATE and rejects contributions exceeding PHP 15,000", async () => {
  const db = new CapacityDatabase();
  db.state.ledgerBalance = 14000;
  db.state.validatedPayments = [{ id: "1", amount: 14000, status: "Validated" }];
  db.state.pendingPatronageTransfers = 500;

  const connection = await db.getConnection();
  await assert.rejects(
    () =>
      assertLockedMemberShareCapitalCapacity(connection, {
        memberId: "1",
        requestedAmount: 500.01,
      }),
    (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_LIMIT_EXCEEDED",
  );

  assert.match(db.statements[0], /FROM member_profiles\s+WHERE member_id = \?\s+LIMIT 1 FOR UPDATE/);
});

test("shareCapitalRepository.create and .update enforce transactional PHP 15,000 capacity including CBU and pending reservations", async () => {
  const db = new CapacityDatabase();
  // Member has PHP 14,000 from CBU/ledger (only PHP 10,000 in share_capital_payments) + PHP 500 pending QRPH
  db.state.ledgerBalance = 14000;
  db.state.validatedPayments = [{ id: "1", amount: 10000, status: "Validated" }];
  db.state.activePendingQrph = 500;

  const repo = createShareCapitalRepository(db.pool());

  // 1. Direct Validated create of PHP 600 must be rejected (14,000 + 500 + 600 > 15,000)
  await assert.rejects(
    () =>
      repo.create(
        {
          memberId: "1",
          paymentReferenceId: null,
          amount: 600,
          paymentDate: "2026-06-02",
          paymentStatus: "Validated",
          remarks: null,
        },
        bookkeeperAuth,
      ),
    (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_LIMIT_EXCEEDED",
  );

  // 2. Creating a Pending payment of PHP 600 succeeds, but updating it to Validated is rejected
  const pending = await repo.create(
    {
      memberId: "1",
      paymentReferenceId: null,
      amount: 600,
      paymentDate: "2026-06-02",
      paymentStatus: "Pending",
      remarks: null,
    },
    bookkeeperAuth,
  );
  assert.equal(pending.paymentStatus, "Pending");

  await assert.rejects(
    () =>
      repo.update(
        pending.id,
        {
          memberId: "1",
          paymentReferenceId: null,
          amount: 600,
          paymentDate: "2026-06-02",
          paymentStatus: "Validated",
          remarks: null,
        },
        bookkeeperAuth,
      ),
    (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_LIMIT_EXCEEDED",
  );
});

test("postShareCapitalPaymentToLedger rejects ledger credits that would exceed PHP 15,000", async () => {
  const db = new CapacityDatabase();
  db.state.ledgerBalance = 14800;
  const connection = await db.getConnection();

  await assert.rejects(
    () =>
      postShareCapitalPaymentToLedger({
        connection,
        memberId: "1",
        sharePaymentId: "99",
        amount: 250,
        transactionDate: "2026-06-02",
        referenceNumber: "SC-PAY-000099",
        remarks: null,
        createdBy: "2",
      }),
    (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_LIMIT_EXCEEDED",
  );
  assert.equal(db.state.ledgerBalance, 14800);
});
