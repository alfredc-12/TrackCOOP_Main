import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "mysql2/promise";
import {
  capitalCases,
  caseProgress,
  monthlyCapitalProgress,
  recordApplicationCapitalEvent,
} from "./membership-progress.repository";
import { membershipLocation } from "./membership-location";
import locations from "./batangas-locations.json";
import { enqueueCapitalReminders } from "./capital-reminders";
import type { EmailConfig } from "../email/email-config";
import { validateApplicationShareCapitalAmount } from "../paymongo/paymongo.membership-installment.rules";
const policyCase = {
  id: "1",
  applicationId: "42",
  upgradeId: null,
  memberId: null,
  startedOn: "2026-01-31",
  deadline: "2026-07-31",
  opening: 0,
  target: 3000,
  createdAt: new Date("2026-01-31T00:00:00Z"),
  closedAt: null,
  name: "Test Applicant",
  email: "applicant@example.test",
};
class Store {
  events = [
    { date: "2026-02-01 00:00:00", amount: 1500 },
    { date: "2026-08-01 00:00:00", amount: 1500 },
  ];
  keys = new Map<string, string>();
  next = 1;
  commands: { sql: string; params: unknown[] }[] = [];
  async execute(sql: string, params: unknown[] = []): Promise<unknown> {
    this.commands.push({ sql, params });
    if (sql.includes("FROM membership_capital_cases c"))
      return [[{ ...policyCase }], []];
    if (sql.includes("SELECT CAST(capital_case_id AS CHAR) AS caseId"))
      return [
        this.events.map((e) => ({ caseId: "1", amount: e.amount, at: e.date })),
        [],
      ];
    if (
      sql.includes("SUM(amount)") &&
      sql.includes("membership_capital_events")
    )
      return [
        [
          {
            total: this.events
              .filter((e) => e.date <= String(params[1]))
              .reduce((s, e) => s + e.amount, 0),
          },
        ],
        [],
      ];
    if (sql.includes("SUM(amount)") && sql.includes("payment_references"))
      return [[{ total: 0 }], []];
    if (sql.includes("INSERT INTO email_outbox")) {
      const key = String(params[1]);
      if (this.keys.has(key)) throw { code: "ER_DUP_ENTRY" };
      const id = String(this.next++);
      this.keys.set(key, id);
      return [{ insertId: id }, []];
    }
    if (sql.includes("SELECT CAST(email_outbox_id"))
      return [[{ id: this.keys.get(String(params[0])) }], []];
    return [{ affectedRows: 1 }, []];
  }
  async getConnection() {
    return this;
  }
  async beginTransaction() {}
  async commit() {}
  async rollback() {}
  release() {}
  pool() {
    return this as unknown as Pool;
  }
}
test("full initial capital and installments count separately from the fee", () => {
  assert.equal(
    validateApplicationShareCapitalAmount({
      requestedAmount: 3000,
      validatedAmount: 0,
      otherActivePendingAmount: 0,
      initialShareCapital: 1500,
      maximumShareCapital: 15000,
      allowFullInitial: true,
    }).requestedAmount,
    3000,
  );
  assert.throws(() =>
    validateApplicationShareCapitalAmount({
      requestedAmount: 100,
      validatedAmount: 0,
      otherActivePendingAmount: 0,
      initialShareCapital: 1500,
      maximumShareCapital: 15000,
      allowFullInitial: true,
    }),
  );
  assert.throws(() =>
    validateApplicationShareCapitalAmount({
      requestedAmount: 1500,
      validatedAmount: 14000,
      otherActivePendingAmount: 0,
      initialShareCapital: 1500,
      maximumShareCapital: 15000,
      allowFullInitial: true,
    }),
  );
});
test("monthly completion uses historical validation dates; late completion preserves overdue month", async () => {
  const store = new Store();
  const rows = await monthlyCapitalProgress(
    store.pool(),
    "2026-02-01",
    "2026-08-31",
  );
  assert.equal(rows[0].outstanding, 1500);
  assert.equal(rows[2].reminder, 1);
  assert.equal(rows[5].overdue, 0);
  assert.equal(rows[6].completed, 1);
  const [c] = await capitalCases(store.pool());
  assert.equal(
    (await caseProgress(store.pool(), c, "2026-08-01")).status,
    "Completed",
  );
  store.events[1].date = "2026-09-01 00:00:00";
  assert.equal(
    (await caseProgress(store.pool(), c, "2026-08-31")).status,
    "Overdue",
  );
});
test("capital reminder runs deduplicate milestones without browser timers or financial writes", async () => {
  const store = new Store();
  const config: EmailConfig = {
    mode: "resend",
    stage: "general",
    allowlist: [],
    fromName: "TrackCOOP",
    frontendUrl: "https://example.test",
  };
  assert.equal(
    (await enqueueCapitalReminders(store.pool(), config, "2026-05-01")).queued,
    1,
  );
  assert.equal(
    (await enqueueCapitalReminders(store.pool(), config, "2026-05-02"))
      .duplicate,
    1,
  );
  store.events[1].date = "2026-09-01 00:00:00";
  assert.equal(
    (await enqueueCapitalReminders(store.pool(), config, "2026-08-01")).queued,
    1,
  );
  assert.equal(store.keys.size, 2);
  assert.ok(store.commands.some(c=>c.sql.includes("c.deadline<?")),"preserved earlier deadlines must not wait for the new three-month anniversary");
  store.events[1].date = "2026-08-01 00:00:00";
  await enqueueCapitalReminders(store.pool(), config, "2026-08-02");
  assert.equal(store.keys.size, 2);
  assert.ok(
    !store.commands.some((c) =>
      /UPDATE member_profiles|UPDATE users|INSERT INTO financial_records/.test(
        c.sql,
      ),
    ),
  );
});
test("application capital events are source-scoped and idempotently keyed", async () => {
  const store = new Store();
  await recordApplicationCapitalEvent(store.pool(), "77");
  await recordApplicationCapitalEvent(store.pool(), "77", true);
  for (const c of store.commands) {
    assert.match(c.sql, /INSERT IGNORE/);
    assert.match(c.sql, /p.related_entity_type='membership_application'/);
    assert.match(c.sql, /p.payment_purpose='Share Capital'/);
  }
});
test("Batangas cached data is complete, dependent and preserves PSGC string codes", () => {
  assert.equal(locations.cities.length, 34);
  assert.equal(
    locations.cities.reduce((s, c) => s + c.barangays.length, 0),
    1077,
  );
  const codes = locations.cities.flatMap((c) => c.barangays.map((b) => b[0]));
  assert.equal(new Set(codes).size, codes.length);
  const n = locations.cities.find((c) => c.name === "Nasugbu")!;
  const b = n.barangays[0];
  const location = membershipLocation({
    municipality: n.name,
    barangay: b[1],
    province: "Batangas",
  });
  assert.equal(location.barangayPsgc, b[0]);
  assert.throws(() =>
    membershipLocation({
      municipality: "Nasugbu",
      barangay: b[1],
      barangayPsgc: locations.cities[0].barangays[0][0],
      province: "Batangas",
    }),
  );
  assert.throws(() =>
    membershipLocation({
      municipality: "Nasugbu",
      barangay: b[1],
      province: "Cavite",
    }),
  );
});
