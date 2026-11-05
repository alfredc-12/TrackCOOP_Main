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
import {
  createShareCapitalLedgerRepository,
  postShareCapitalPaymentToLedger,
} from "./share-capital-ledger.repository";
import { createPatronageCapitalRepository } from "../patronage/patronage-capital.repository";
import { createPaymongoMemberShareCapitalRepository } from "../paymongo/paymongo.member-share-capital.repository";

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

const memberAuth: AuthContext = {
  user: {
    id: "3",
    displayName: "Juan Dela Cruz",
    email: "juan@example.test",
    username: "juan",
    role: "member",
  },
  sessionId: "2",
  tokenHash: "hash-member",
};

type SimulatedPayment = {
  id: string;
  amount: number;
  status: "Validated" | "Pending" | "Rejected";
  postedToLedger: boolean;
  paymentReferenceId: string | null;
};

type SimulatedPendingCheckout = {
  id: string;
  amount: number;
  environment: "Test" | "Live";
  clientRequestId: string | null;
};

type SimulatedPatronageTransfer = {
  id: string;
  allocationId: string;
  memberId: string;
  amount: number;
  requestKey: string;
  status: "Pending" | "Approved" | "Rejected";
  capitalTransactionId: string | null;
};

type SimulatedDividend = {
  id: string;
  memberId: string;
  amount: number;
  status: "Available" | "Capitalization Requested" | "Added to Share Capital";
  declarationName: string;
};

class TransactionalCapitalDatabase {
  state = {
    ledgerBalance: 5000,
    validatedPayments: [
      { id: "1", amount: 5000, status: "Validated", postedToLedger: true, paymentReferenceId: null },
    ] as SimulatedPayment[],
    pendingCheckouts: [] as SimulatedPendingCheckout[],
    patronageTransfers: [] as SimulatedPatronageTransfer[],
    dividends: [] as SimulatedDividend[],
    patronageRefundAmount: 500,
    patronagePaymentStatus: "Pending",
    patronagePeriodStatus: "Finalized",
  };
  statements: string[] = [];
  private queue: Promise<void> = Promise.resolve();

  async getConnection(): Promise<PoolConnection> {
    let unlock!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    await previous;
    const snapshot = structuredClone(this.state);
    return {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {
        this.state = snapshot;
      },
      release: () => unlock(),
      execute: this.execute.bind(this),
    } as unknown as PoolConnection;
  }

  async execute(sql: string, values: unknown[] = []) {
    this.statements.push(sql);
    const rows = (value: unknown) => [value, []];
    const write = (id = 1) => rows({ insertId: id, affectedRows: 1 });

    if (sql.includes("FROM member_profiles m") && sql.includes("JOIN rental_bookings")) {
      return rows([{
        memberId: "1",
        memberCode: "MEM-2026-0001",
        memberName: "Juan Dela Cruz",
        membershipType: "True Member",
        purchasePatronage: 0,
        rentalPatronage: 16666.67,
      }]);
    }
    // Member lookups
    if (sql.includes("FROM member_profiles") && sql.includes("WHERE user_id = ?")) {
      return rows([{
        id: "1",
        memberId: "1",
        userId: String(values[0] ?? "3"),
        memberCode: "MEM-2026-0001",
        memberName: "Juan Dela Cruz",
        fullName: "Juan Dela Cruz",
        email: "juan@example.test",
        contactNumber: "09171234567",
        membershipType: "True Member",
        approvalStatus: "Approved",
        officialMemberStatus: "Active",
      }]);
    }
    if (sql.includes("FROM member_profiles") && sql.includes("FOR UPDATE")) {
      return rows([{
        member_id: String(values[0] ?? "1"),
        approvalStatus: "Approved",
        memberStatus: "Active",
        membershipType: "True Member",
      }]);
    }

    // Unified capacity snapshot query (selectMemberShareCapitalCapacity)
    if (
      sql.includes("AS ledgerBalance") &&
      sql.includes("AS unpostedValidatedPayments") &&
      sql.includes("AS validatedPayments") &&
      sql.includes("AS activePendingQrph")
    ) {
      const hasExcludePayment = sql.includes("AND s.share_payment_id <> ?");
      const excludingPaymentId = hasExcludePayment ? String(values[1]) : null;
      const gatewayEnv = String(values.find((v) => v === "Test" || v === "Live") ?? "Test");
      const excludeRefId = null;

      const excludedPostedPayment = excludingPaymentId
        ? this.state.validatedPayments.find(
            (item) => item.id === excludingPaymentId && item.status === "Validated" && item.postedToLedger,
          )?.amount ?? 0
        : 0;
      const unpostedValidatedPayments = this.state.validatedPayments
        .filter((item) => item.status === "Validated" && !item.postedToLedger && item.id !== excludingPaymentId)
        .reduce((sum, item) => sum + item.amount, 0);
      const validatedPayments = this.state.validatedPayments
        .filter((item) => item.status === "Validated" && item.id !== excludingPaymentId)
        .reduce((sum, item) => sum + item.amount, 0);
      const activePendingQrph = this.state.pendingCheckouts
        .filter((item) => item.environment === gatewayEnv && item.id !== excludeRefId)
        .reduce((sum, item) => sum + item.amount, 0);
      const pendingPatronageTransfers = this.state.patronageTransfers
        .filter((item) => item.status === "Pending")
        .reduce((sum, item) => sum + item.amount, 0);
      const pendingDividendCapitalizations = this.state.dividends
        .filter((item) => item.status === "Capitalization Requested")
        .reduce((sum, item) => sum + item.amount, 0);

      return rows([{
        ledgerBalance: Math.max(0, this.state.ledgerBalance - excludedPostedPayment),
        unpostedValidatedPayments,
        validatedPayments,
        activePendingQrph,
        pendingPatronageTransfers,
        pendingDividendCapitalizations,
      }]);
    }

    // PayMongo member share capital repository queries
    if (sql.includes("FROM payment_references p") && sql.includes("WHERE p.client_request_id = ?")) {
      const found = this.state.pendingCheckouts.find((item) => item.clientRequestId === values[0]);
      if (!found) return rows([]);
      return rows([{
        id: found.id,
        memberId: "1",
        memberUserId: "3",
        submittedBy: "3",
        payerName: "Juan Dela Cruz",
        payerEmail: "juan@example.test",
        payerContact: "09171234567",
        provider: "PayMongo Hosted Checkout",
        referenceNumber: `SC-2026-00000${found.id}`,
        paymentPurpose: "Share Capital",
        relatedEntityType: "member_profile",
        relatedEntityId: "1",
        amount: found.amount,
        validationStatus: "Pending",
        paymentChannel: "PayMongo",
        gatewayEnvironment: found.environment,
        gatewayCheckoutId: null,
        gatewayPaymentId: null,
        gatewayPaymentIntentId: null,
        gatewayStatus: "active",
        idempotencyKey: null,
        paidAt: null,
        clientRequestId: found.clientRequestId,
        submittedAt: new Date(),
      }]);
    }
    if (sql.includes("FROM payment_references pr") && sql.includes("LEFT JOIN payment_gateway_checkout_attempts a")) {
      const environment = String(values[0]);
      const excludeId = sql.includes("AND pr.payment_reference_id <> ?") ? String(values[4]) : null;
      const active = this.state.pendingCheckouts.filter(
        (item) => item.environment === environment && item.id !== excludeId,
      );
      return rows(active.map((item) => ({
        paymentReferenceId: item.id,
        clientRequestId: item.clientRequestId,
        amount: item.amount,
        checkoutId: `cs_${item.id}`,
        checkoutUrl: `https://checkout.paymongo.test/${item.id}`,
        attemptNumber: 1,
        gatewayStatus: "active",
      })));
    }
    if (sql.includes("FROM share_capital_payments") && sql.includes("AS total") && sql.includes("GREATEST(")) {
      const unposted = this.state.validatedPayments
        .filter((item) => item.status === "Validated" && !item.postedToLedger)
        .reduce((sum, item) => sum + item.amount, 0);
      const allValidated = this.state.validatedPayments
        .filter((item) => item.status === "Validated")
        .reduce((sum, item) => sum + item.amount, 0);
      return rows([{
        total: Math.max(this.state.ledgerBalance + unposted, allValidated),
      }]);
    }
    if (sql.includes("FROM patronage_capital_transfers t") && sql.includes("FROM member_dividends md") && sql.includes("AS total")) {
      const pendingPatronage = this.state.patronageTransfers
        .filter((item) => item.status === "Pending")
        .reduce((sum, item) => sum + item.amount, 0);
      const pendingDividends = this.state.dividends
        .filter((item) => item.status === "Capitalization Requested")
        .reduce((sum, item) => sum + item.amount, 0);
      return rows([{ total: pendingPatronage + pendingDividends }]);
    }
    if (sql.includes("INSERT INTO payment_references")) {
      const nextId = String(this.state.pendingCheckouts.length + 100);
      const environment = String(values[5]) as "Test" | "Live";
      const amount = Number(values[8]);
      const clientRequestId = String(values[10] ?? "");
      this.state.pendingCheckouts.push({ id: nextId, amount, environment, clientRequestId });
      return write(Number(nextId));
    }
    if (sql.includes("UPDATE payment_references SET reference_number = ?")) {
      return write();
    }
    if (sql.includes("INSERT INTO payment_validation_history")) {
      return write();
    }
    if (sql.includes("FROM payment_references p") && sql.includes("WHERE p.payment_reference_id = ?")) {
      const targetId = String(values[0]);
      const found = this.state.pendingCheckouts.find((item) => item.id === targetId);
      if (!found) return rows([]);
      return rows([{
        id: found.id,
        memberId: "1",
        memberUserId: "3",
        submittedBy: "3",
        payerName: "Juan Dela Cruz",
        payerEmail: "juan@example.test",
        payerContact: "09171234567",
        provider: "PayMongo Hosted Checkout",
        referenceNumber: `SC-2026-${found.id.padStart(6, "0")}`,
        paymentPurpose: "Share Capital",
        relatedEntityType: "member_profile",
        relatedEntityId: "1",
        amount: found.amount,
        validationStatus: "Pending",
        paymentChannel: "PayMongo",
        gatewayEnvironment: found.environment,
        gatewayCheckoutId: null,
        gatewayPaymentId: null,
        gatewayPaymentIntentId: null,
        gatewayStatus: "active",
        idempotencyKey: null,
        paidAt: null,
        clientRequestId: found.clientRequestId,
        submittedAt: new Date(),
      }]);
    }

    // Patronage capital repository queries
    if (sql.includes("FROM patronage_capital_transfers t JOIN member_profiles")) {
      let found = this.state.patronageTransfers;
      if (sql.includes("WHERE t.request_key = ?")) found = found.filter((t) => t.requestKey === values[0]);
      if (sql.includes("WHERE t.transfer_id = ?")) found = found.filter((t) => t.id === values[0]);
      return rows(found.map((t) => ({
        ...t,
        memberName: "Juan Dela Cruz",
        memberCode: "MEM-2026-0001",
        periodName: "2025",
        requestedAt: new Date(),
        processedAt: null,
        notes: null,
      })));
    }
    if (sql.includes("DATE_FORMAT(p.period_start") && sql.includes("AS rentalPatronage") && sql.includes("FOR UPDATE")) {
      return rows([{
        memberId: "1",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        rentalPatronage: 16666.67,
        refundAmount: this.state.patronageRefundAmount,
      }]);
    }
    if (sql.includes("FROM patronage_allocations a JOIN patronage_periods")) {
      return rows([{
        id: "10",
        memberId: "1",
        periodId: "20",
        periodName: "2025",
        refundAmount: this.state.patronageRefundAmount,
        policyVersion: "Rental3PercentAnnual",
        membershipType: "True Member",
        paymentStatus: this.state.patronagePaymentStatus,
        periodStatus: this.state.patronagePeriodStatus,
      }]);
    }
    if (sql.includes("FROM patronage_capital_transfers WHERE")) {
      const total = (status: string) =>
        this.state.patronageTransfers.filter((t) => t.status === status).reduce((sum, t) => sum + t.amount, 0);
      return rows([{ capitalizedAmount: total("Approved"), pendingCapitalAmount: total("Pending") }]);
    }
    if (sql.includes("FROM share_capital_accounts WHERE member_id = ?") && sql.includes("AS balance")) {
      const unposted = this.state.validatedPayments
        .filter((item) => item.status === "Validated" && !item.postedToLedger)
        .reduce((sum, item) => sum + item.amount, 0);
      const allValidated = this.state.validatedPayments
        .filter((item) => item.status === "Validated")
        .reduce((sum, item) => sum + item.amount, 0);
      return rows([{
        id: "10",
        balance: Math.max(this.state.ledgerBalance + unposted, allValidated),
      }]);
    }
    if (sql.includes("FROM system_settings")) {
      return rows([{ value: "15000" }]);
    }
    if (sql.includes("SELECT COALESCE(SUM(pr.amount), 0) AS amount FROM payment_references pr")) {
      const envFilter = String(values[1] ?? "Test");
      const total = this.state.pendingCheckouts
        .filter((item) => item.environment === envFilter)
        .reduce((sum, item) => sum + item.amount, 0);
      return rows([{ amount: total }]);
    }
    if (sql.includes("INSERT INTO patronage_capital_transfers")) {
      const id = String(this.state.patronageTransfers.length + 1);
      this.state.patronageTransfers.push({
        id,
        allocationId: String(values[0]),
        memberId: String(values[1]),
        amount: Number(values[2]),
        requestKey: String(values[3]),
        status: "Pending",
        capitalTransactionId: null,
      });
      return write(Number(id));
    }

    // Dividend / CBU queries
    if (sql.includes("FROM member_dividends md") && sql.includes("WHERE md.member_dividend_id = ?")) {
      const targetId = String(values[0]);
      const found = this.state.dividends.find((item) => item.id === targetId);
      if (!found) return rows([]);
      return rows([{
        id: found.id,
        memberId: found.memberId,
        memberCode: "MEM-2026-0001",
        memberName: "Juan Dela Cruz",
        declarationId: "1",
        membershipType: "True Member",
        declarationName: found.declarationName,
        declarationStatus: "Published",
        coverageStart: "2025-01-01",
        coverageEnd: "2025-12-31",
        declaredAt: new Date("2026-01-15T00:00:00Z"),
        distributionDate: new Date("2026-01-15T00:00:00Z"),
        amount: found.amount,
        status: found.status,
        decision: found.status === "Added to Share Capital" ? "Add to Share Capital" : "Undecided",
        withdrawalMethod: null,
        withdrawalProvider: null,
        withdrawalAccountName: null,
        withdrawalAccountNumber: null,
        withdrawalQrCode: null,
        withdrawalReceipt: null,
        withdrawalReceiptName: null,
        decidedAt: null,
        processedAt: null,
        capitalTransactionId: null,
        withdrawalReference: null,
        createdAt: new Date("2026-01-15T00:00:00Z"),
      }]);
    }
    if (sql.includes("UPDATE member_dividends") && sql.includes("dividend_status = 'Added to Share Capital'")) {
      const targetId = String(values[2]);
      const found = this.state.dividends.find((item) => item.id === targetId && item.status === "Available");
      if (!found) return rows({ insertId: 0, affectedRows: 0 });
      found.status = "Added to Share Capital";
      return write();
    }
    if (sql.includes("INSERT INTO dividend_action_history")) {
      return write();
    }

    // Share capital accounts & payments
    if (sql.includes("INSERT INTO share_capital_accounts")) {
      return write();
    }
    if (sql.includes("FROM share_capital_accounts") && sql.includes("FOR UPDATE")) {
      return rows([{
        accountId: "10",
        memberId: "1",
        initialCapital: 5000,
        currentBalance: this.state.ledgerBalance,
        additionalContributions: 0,
        dividendsAdded: 0,
        totalDeductions: 0,
        updatedAt: new Date(),
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
        paymentReferenceId: found.paymentReferenceId,
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
      this.state.validatedPayments.push({
        id: nextId,
        amount,
        status,
        postedToLedger: status === "Validated",
        paymentReferenceId: (values[1] as string | null) ?? null,
      });
      return write(Number(nextId));
    }
    if (sql.includes("UPDATE share_capital_payments")) {
      const targetId = String(values[9]);
      const target = this.state.validatedPayments.find((item) => item.id === targetId);
      if (target) {
        target.amount = Number(values[2]);
        target.status = String(values[4]) as "Validated" | "Pending" | "Rejected";
        if (target.status === "Validated") target.postedToLedger = true;
      }
      return write();
    }
    if (sql.includes("INSERT INTO share_capital_transactions")) {
      const balanceAfter = sql.includes("'Dividend Added to Share Capital'")
        ? Number(values[4])
        : Number(values[6]);
      this.state.ledgerBalance = balanceAfter;
      return write(100);
    }
    if (sql.includes("UPDATE share_capital_accounts")) {
      const nextBalance = values.length === 3 ? Number(values[1]) : Number(values[4]);
      this.state.ledgerBalance = nextBalance;
      return write();
    }
    if (sql.includes("INSERT INTO audit_logs")) {
      return write();
    }

    throw new Error(`Unexpected SQL in TransactionalCapitalDatabase: ${sql}`);
  }

  pool(): Pool {
    return this as unknown as Pool;
  }

  connection(): PoolConnection {
    return {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      execute: this.execute.bind(this),
    } as unknown as PoolConnection;
  }
}

test("selectMemberShareCapitalCapacity combines posted ledger capital, capitalized interest, and validated-but-unposted payments without undercounting", async () => {
  const db = new TransactionalCapitalDatabase();
  // Scenario:
  // - PHP 3,000 pre-approval Share Capital in share_capital_payments (validated, NOT posted to share_capital_transactions)
  // - PHP 10,000 post-approval Share Capital in share_capital_payments (validated AND posted to share_capital_transactions)
  // - PHP 1,500 capitalized Annual Interest / Patronage in share_capital_accounts (so ledger current_balance = 10,000 + 1,500 = 11,500)
  // True committed capital must be 11,500 (ledger) + 3,000 (unposted validated payments) = PHP 14,500, NOT max(11,500, 13,000) = 13,000!
  db.state.ledgerBalance = 11500;
  db.state.validatedPayments = [
    { id: "1", amount: 3000, status: "Validated", postedToLedger: false, paymentReferenceId: "ref-pre-1" },
    { id: "2", amount: 10000, status: "Validated", postedToLedger: true, paymentReferenceId: "ref-post-2" },
  ];
  db.state.pendingCheckouts = [
    { id: "201", amount: 200, environment: "Test", clientRequestId: "req-test-1" },
  ];

  const snapshot = await selectMemberShareCapitalCapacity(db.connection(), {
    memberId: "1",
    gatewayEnvironment: "Test",
  });

  assert.equal(snapshot.ledgerBalance, 11500);
  assert.equal(snapshot.unpostedValidatedPayments, 3000);
  assert.equal(snapshot.validatedPayments, 13000);
  assert.equal(snapshot.committedCapital, 14500);
  assert.equal(snapshot.activePendingQrph, 200);
  assert.equal(snapshot.availableCapacity, 300);
});

test("Test and Live PayMongo checkout reservations are isolated and cannot interfere with each other", async () => {
  const db = new TransactionalCapitalDatabase();
  db.state.ledgerBalance = 13000;
  db.state.validatedPayments = [
    { id: "1", amount: 13000, status: "Validated", postedToLedger: true, paymentReferenceId: null },
  ];
  // Active Test checkout of PHP 1,500
  db.state.pendingCheckouts = [
    { id: "301", amount: 1500, environment: "Test", clientRequestId: "test-checkout-uuid" },
  ];

  const conn = db.connection();
  const testSnapshot = await selectMemberShareCapitalCapacity(conn, {
    memberId: "1",
    gatewayEnvironment: "Test",
  });
  const liveSnapshot = await selectMemberShareCapitalCapacity(conn, {
    memberId: "1",
    gatewayEnvironment: "Live",
  });

  // In Test mode, the PHP 1,500 Test checkout reserves capacity (available = 500)
  assert.equal(testSnapshot.activePendingQrph, 1500);
  assert.equal(testSnapshot.availableCapacity, 500);

  // In Live mode, the Test checkout does NOT reserve Live capacity (available = 2,000)
  assert.equal(liveSnapshot.activePendingQrph, 0);
  assert.equal(liveSnapshot.availableCapacity, 2000);

  // PayMongo Member Share Capital repository in Live mode can prepare a PHP 1,500 Live contribution without being blocked by the Test checkout
  const paymongoRepo = createPaymongoMemberShareCapitalRepository(db.pool());
  const liveRef = await paymongoRepo.prepareContribution({
    userId: "3",
    checkout: {
      requestedAmount: 1500,
      clientRequestId: "live-checkout-uuid",
    },
    settings: {
      associateFee: 200,
      initialShareCapital: 1500,
      trueMemberRequiredCapital: 3000,
      maximumShareCapital: 15000,
    },
    environment: "Live",
    reuseMinutes: 30,
  });
  assert.equal(liveRef.gatewayEnvironment, "Live");
  assert.equal(liveRef.amount, 1500);
});

test("assertLockedMemberShareCapitalCapacity locks member_profiles FOR UPDATE and rejects contributions exceeding PHP 15,000", async () => {
  const db = new TransactionalCapitalDatabase();
  db.state.ledgerBalance = 14000;
  db.state.validatedPayments = [
    { id: "1", amount: 14000, status: "Validated", postedToLedger: true, paymentReferenceId: null },
  ];
  db.state.patronageTransfers.push({
    id: "1",
    allocationId: "10",
    memberId: "1",
    amount: 500,
    requestKey: "patronage-key-1",
    status: "Pending",
    capitalTransactionId: null,
  });

  const connection = db.connection();
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

test("shareCapitalRepository.create and .update enforce transactional PHP 15,000 capacity including CBU, unposted payments, and pending reservations", async () => {
  const db = new TransactionalCapitalDatabase();
  // PHP 11,500 ledger (10,000 posted payment + 1,500 CBU) + PHP 2,500 unposted pre-approval payment = PHP 14,000 committed + PHP 500 pending QRPH
  db.state.ledgerBalance = 11500;
  db.state.validatedPayments = [
    { id: "1", amount: 2500, status: "Validated", postedToLedger: false, paymentReferenceId: "pre-1" },
    { id: "2", amount: 10000, status: "Validated", postedToLedger: true, paymentReferenceId: "post-1" },
  ];
  db.state.pendingCheckouts = [
    { id: "401", amount: 500, environment: "Test", clientRequestId: "qrph-pending-1" },
  ];

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
  const db = new TransactionalCapitalDatabase();
  db.state.ledgerBalance = 14800;
  const connection = db.connection();

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

test("concurrent payment, patronage reservation, and CBU dividend capitalization serialize and cannot bypass the PHP 15,000 cap", async () => {
  const db = new TransactionalCapitalDatabase();
  // Start with PHP 14,600 committed capital (remaining capacity = PHP 400)
  db.state.ledgerBalance = 14600;
  db.state.validatedPayments = [
    { id: "1", amount: 14600, status: "Validated", postedToLedger: true, paymentReferenceId: null },
  ];
  db.state.dividends = [
    {
      id: "55",
      memberId: "1",
      amount: 300,
      status: "Available",
      declarationName: "2025 Annual Interest on Share Capital",
    },
  ];

  const shareCapitalRepo = createShareCapitalRepository(db.pool());
  const ledgerRepo = createShareCapitalLedgerRepository(db.pool());
  const patronageCapitalRepo = createPatronageCapitalRepository(db.pool());

  // Launch 3 competing PHP 300 operations concurrently against the same member:
  // 1) Bookkeeper validates a PHP 300 manual Share Capital payment
  // 2) Member capitalizes a PHP 300 CBU dividend
  // 3) Member requests a PHP 300 Patronage Refund transfer to Share Capital
  const results = await Promise.allSettled([
    shareCapitalRepo.create(
      {
        memberId: "1",
        paymentReferenceId: null,
        amount: 300,
        paymentDate: "2026-06-03",
        paymentStatus: "Validated",
        remarks: "Concurrent manual payment",
      },
      bookkeeperAuth,
    ),
    ledgerRepo.addDividendToShareCapital("3", "55"),
    patronageCapitalRepo.request(
      {
        allocationId: "10",
        amount: 300,
        requestKey: "8e7d3f58-4a12-4c91-8b2a-19f3d4e8c101",
      },
      memberAuth,
    ),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

  // Only 1 of the three PHP 300 operations can succeed because 14,600 + 300 = 14,900 (leaving 100 < 300)
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 2);
  for (const failure of rejected) {
    assert.ok(failure.reason instanceof AppError);
    assert.equal(failure.reason.code, "SHARE_CAPITAL_LIMIT_EXCEEDED");
  }

  const finalSnapshot = await selectMemberShareCapitalCapacity(db.connection(), {
    memberId: "1",
  });
  assert.equal(finalSnapshot.totalCommittedAndReserved, 14900);
  assert.equal(finalSnapshot.availableCapacity, 100);
});
