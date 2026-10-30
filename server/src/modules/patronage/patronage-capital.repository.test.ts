import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import type { AuthContext } from "../auth/auth.types";
import { AppError } from "../../utils/app-error";
import { createPatronageRepository } from "./patronage.repository";
import { createPatronageCapitalRepository } from "./patronage-capital.repository";
import { assertPatronageCapitalAmount, availablePatronageRefund } from "./patronage-capital.rules";

const member: AuthContext = { user: { id: "3", role: "member", displayName: "Member", username: "member", email: "member@example.test" }, sessionId: "1", tokenHash: "test" };
const bookkeeper: AuthContext = { ...member, user: { ...member.user, id: "2", role: "bookkeeper" } };
const request = { allocationId: "10", amount: 300, requestKey: "4c106f59-1548-4c75-8eb3-351a33817fc0" };
type Transfer = { id: string; allocationId: string; memberId: string; amount: number; requestKey: string; status: string; capitalTransactionId: string | null };

// A transactional adapter: unknown SQL fails, writes are rolled back on failure, and
// transactions serialize to exercise competing requests against the same locked member.
class Database {
  state = { balance: 2000, refundAmount: 500, paymentStatus: "Pending", periodStatus: "Finalized", pendingQrph: 0, transfers: [] as Transfer[], ledger: [] as number[] };
  statements: string[] = [];
  failAudit = false;
  private queue: Promise<void> = Promise.resolve();
  async getConnection() {
    let unlock!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => { unlock = resolve; });
    await previous;
    const snapshot = structuredClone(this.state);
    return { beginTransaction: async () => {}, commit: async () => {}, rollback: async () => { this.state = snapshot; }, release: () => unlock(), execute: this.execute.bind(this) };
  }
  async execute(sql: string, values: unknown[] = []) {
    this.statements.push(sql);
    const rows = (value: unknown) => [value, []];
    const write = (id = 1) => rows({ insertId: id, affectedRows: 1 });
    if (sql.includes("FROM patronage_capital_transfers t JOIN member_profiles")) {
      let found = this.state.transfers;
      if (sql.includes("WHERE t.request_key = ?")) found = found.filter((t) => t.requestKey === values[0]);
      if (sql.includes("WHERE t.transfer_id = ?")) found = found.filter((t) => t.id === values[0]);
      return rows(found.map((t) => ({ ...t, memberName: "Member", memberCode: "M-1", periodName: "2026", requestedAt: new Date(), processedAt: null, notes: null })));
    }
    if (sql.includes("FROM member_profiles") && sql.includes("user_id = ?")) return rows(values[0] === member.user.id ? [{ id: "1" }] : []);
    if (sql.includes("FROM member_profiles") && sql.includes("FOR UPDATE")) return rows([{ approvalStatus: "Approved", memberStatus: "Active" }]);
    if (sql.includes("FROM patronage_allocations a JOIN patronage_periods") || (sql.includes("FROM patronage_allocations a") && sql.includes("FOR UPDATE") && !sql.includes("a.payment_notes AS paymentNotes"))) {
      if (sql.includes("AND a.member_id = ?") && values[1] !== "1") return rows([]);
      if (values[0] !== "10") return rows([]);
      return rows([{ id: "10", memberId: "1", periodId: "20", periodName: "2026", refundAmount: this.state.refundAmount, paymentStatus: this.state.paymentStatus, periodStatus: this.state.periodStatus }]);
    }
    if (sql.includes("FROM patronage_capital_transfers WHERE")) {
      const total = (status: string) => this.state.transfers.filter((t) => t.status === status).reduce((sum, t) => sum + t.amount, 0);
      return rows([{ capitalizedAmount: total("Approved"), pendingCapitalAmount: total("Pending") }]);
    }
    if (sql.includes("FROM share_capital_accounts")) return rows([{ id: "30", balance: this.state.balance }]);
    if (sql.includes("FROM system_settings")) return rows([{ value: "15000" }]);
    if (sql.includes("FROM payment_references pr")) return rows([{ amount: this.state.pendingQrph }]);
    if (sql.includes("INSERT INTO patronage_capital_transfers")) {
      const id = this.state.transfers.length + 1;
      this.state.transfers.push({ id: String(id), allocationId: String(values[0]), memberId: String(values[1]), amount: Number(values[2]), requestKey: String(values[3]), status: "Pending", capitalTransactionId: null });
      return write(id);
    }
    if (sql.includes("INSERT INTO share_capital_transactions")) { this.state.ledger.push(Number(values[2])); return write(this.state.ledger.length); }
    if (sql.includes("UPDATE share_capital_accounts")) { this.state.balance = Number(values[0]); return write(); }
    if (sql.includes("UPDATE patronage_allocations")) { if (values.length === 3) assert.match(String(values[1]), /Cash paid: 200\.00/); this.state.paymentStatus = "Paid"; return write(); }
    if (sql.includes("UPDATE patronage_periods")) { if (this.state.paymentStatus === "Paid") this.state.periodStatus = "Paid"; return write(); }
    if (sql.includes("UPDATE patronage_capital_transfers")) {
      const transfer = this.state.transfers.find((t) => t.id === values[4])!;
      transfer.status = String(values[0]); transfer.capitalTransactionId = values[3] as string | null;
      return write();
    }
    if (sql.includes("INSERT INTO audit_logs")) { if (this.failAudit) throw new Error("Audit failed"); return write(); }
    if (sql.includes("SELECT SUM(payment_status")) return rows([{ pending: this.state.paymentStatus === "Pending" ? 1 : 0 }]);
    if (sql.includes("a.payment_notes AS paymentNotes")) {
      const capitalizedAmount = this.state.transfers.filter((t) => t.status === "Approved").reduce((sum, t) => sum + t.amount, 0);
      return rows([{ id: "10", refundAmount: 500, paymentStatus: this.state.paymentStatus, capitalizedAmount, pendingCapitalAmount: 0 }]);
    }
    throw new Error(`Unexpected test SQL: ${sql}`);
  }
  pool() { return this as unknown as Pool; }
}

test("partial refund request reserves funds; approval credits capital exactly once", async () => {
  const db = new Database(); const repo = createPatronageCapitalRepository(db.pool());
  await repo.request(request, member);
  assert.equal(db.state.balance, 2000);
  assert.equal(db.state.transfers[0].status, "Pending");
  await repo.request(request, member);
  assert.equal(db.state.transfers.length, 1);
  await repo.decide("1", { decision: "Approve" }, bookkeeper);
  await repo.decide("1", { decision: "Approve" }, bookkeeper);
  assert.equal(db.state.balance, 2300);
  assert.deepEqual(db.state.ledger, [300]);
  assert.equal(db.state.paymentStatus, "Pending");
  assert.ok(db.statements.some((sql) => sql.includes("a.member_id = ?") && sql.includes("FOR UPDATE")));
  assert.ok(db.statements.some((sql) => sql.includes("FROM share_capital_accounts") && sql.includes("FOR UPDATE")));
});

test("competing refund requests cannot reserve more than the refund", async () => {
  const db = new Database(); const repo = createPatronageCapitalRepository(db.pool());
  const results = await Promise.allSettled([repo.request(request, member), repo.request({ ...request, requestKey: "another-key" }, member)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(db.state.transfers.length, 1);
});

test("declining releases the refund; a conflicting retry cannot reuse an old request key", async () => {
  const db = new Database(); const repo = createPatronageCapitalRepository(db.pool());
  await repo.request(request, member);
  await assert.rejects(repo.request({ ...request, amount: 200 }, member), (e) => e instanceof AppError && e.code === "PATRONAGE_REQUEST_CONFLICT");
  await repo.decide("1", { decision: "Reject" }, bookkeeper);
  await repo.request({ ...request, amount: 500, requestKey: "new-key" }, member);
  assert.equal(db.state.balance, 2000);
  assert.equal(db.state.transfers[1].amount, 500);
});

test("approval rechecks capital limit including pending QRPH and leaves a failing request pending", async () => {
  const db = new Database(); const repo = createPatronageCapitalRepository(db.pool());
  await repo.request(request, member); db.state.balance = 14600; db.state.pendingQrph = 200;
  await assert.rejects(repo.decide("1", { decision: "Approve" }, bookkeeper), (e) => e instanceof AppError && e.code === "SHARE_CAPITAL_LIMIT_EXCEEDED");
  assert.equal(db.state.balance, 14600); assert.equal(db.state.transfers[0].status, "Pending"); assert.equal(db.state.ledger.length, 0);
});

test("full transfer settles the refund and payout period, preserving the original amount", async () => {
  const db = new Database(); const repo = createPatronageCapitalRepository(db.pool());
  await repo.request({ ...request, amount: 500 }, member); await repo.decide("1", { decision: "Approve" }, bookkeeper);
  assert.equal(db.state.balance, 2500); assert.equal(db.state.refundAmount, 500); assert.equal(db.state.paymentStatus, "Paid"); assert.equal(db.state.periodStatus, "Paid");
  await assert.rejects(createPatronageRepository(db.pool()).markPaid("10", null, bookkeeper), (e) => e instanceof AppError && e.code === "PATRONAGE_REFUND_ALREADY_PAID");
});

test("cash payout is blocked while a transfer is awaiting review", async () => {
  const db = new Database(); const repo = createPatronageCapitalRepository(db.pool()); await repo.request(request, member);
  await assert.rejects(createPatronageRepository(db.pool()).markPaid("10", null, bookkeeper), (e) => e instanceof AppError && e.code === "PATRONAGE_TRANSFER_PENDING");
  assert.equal(db.state.paymentStatus, "Pending");
});

test("cash payout after a partial transfer pays only the remainder", async () => {
  const db = new Database(); const repo = createPatronageCapitalRepository(db.pool()); await repo.request(request, member); await repo.decide("1", { decision: "Approve" }, bookkeeper);
  const result = await createPatronageRepository(db.pool()).markPaid("10", null, bookkeeper);
  assert.equal(result.capitalizedAmount, 300); assert.equal(result.refundAmount, 500); assert.equal(result.paymentStatus, "Paid");
  assert.equal(db.state.balance, 2300);
});

test("a failure after the capital write rolls back both balances and request status", async () => {
  const db = new Database(); const repo = createPatronageCapitalRepository(db.pool()); await repo.request(request, member); db.failAudit = true;
  await assert.rejects(repo.decide("1", { decision: "Approve" }, bookkeeper), /Audit failed/);
  assert.equal(db.state.balance, 2000); assert.equal(db.state.ledger.length, 0); assert.equal(db.state.transfers[0].status, "Pending");
});

test("unfinalized, paid, missing and another member's refunds cannot be transferred", async () => {
  for (const status of ["Draft", "Paid"]) {
    const db = new Database(); db.state.periodStatus = status;
    await assert.rejects(createPatronageCapitalRepository(db.pool()).request(request, member), (e) => e instanceof AppError && e.code === "PATRONAGE_REFUND_UNAVAILABLE");
  }
  const db = new Database();
  await assert.rejects(createPatronageCapitalRepository(db.pool()).request({ ...request, allocationId: "999" }, member), (e) => e instanceof AppError && e.code === "PATRONAGE_REFUND_NOT_FOUND");
  await assert.rejects(createPatronageCapitalRepository(db.pool()).request(request, bookkeeper), (e) => e instanceof AppError && e.code === "MEMBER_PATRONAGE_NOT_ELIGIBLE");
});

test("refund availability preserves cents and rejects invalid or excessive amounts", () => {
  assert.equal(availablePatronageRefund({ refundAmount: 500.05, capitalizedAmount: 100.01, pendingCapitalAmount: 50.02, paymentStatus: "Pending" }), 350.02);
  for (const amount of [0, -1, Infinity, NaN, 0.001, 500.01]) assert.throws(() => assertPatronageCapitalAmount(amount, 500, 500));
  assert.doesNotThrow(() => assertPatronageCapitalAmount(0.29, 0.29, 0.29));
});
