import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import JSZip from "jszip";
import {
  configurationFromSettings,
  defaultRfmFilters,
  manilaToday,
  normalizeRfmBasis,
  rfmCommitSchema,
  rfmFiltersSchema,
} from "./member-indicator.policy";
import {
  decorateRfmRow,
  histogramMedian,
  percentage,
  rfmDiagnostics,
  rfmWorkspaceQuery,
} from "./member-indicator.workspace-query";
import { createRfmWorkspaceRepository } from "./member-indicator.workspace-repository";
import {
  createRfmWorkbook,
  safeSpreadsheetText,
} from "./member-indicator.export";
import type { AuthContext } from "../auth/auth.types";

test("basis dates use Manila, clamp leap years, reject future/invalid/nonrolling periods", () => {
  assert.equal(manilaToday(new Date("2026-11-01T17:00:00Z")), "2026-11-02");
  assert.deepEqual(
    normalizeRfmBasis({ basisPeriodEnd: "2024-02-29" }, "2026-11-02"),
    { start: "2023-02-28", end: "2024-02-29" },
  );
  assert.deepEqual(
    normalizeRfmBasis({ basisPeriodEnd: "2026-03-31" }, "2026-11-02"),
    { start: "2025-03-31", end: "2026-03-31" },
  );
  for (const value of ["2026-02-30", "2026-11-03", "nonsense"])
    assert.throws(() =>
      normalizeRfmBasis({ basisPeriodEnd: value }, "2026-11-02"),
    );
  assert.throws(() =>
    normalizeRfmBasis({
      basisPeriodEnd: "2026-01-01",
      basisPeriodStart: "2020-01-01",
    }),
  );
});
test("configuration is validated, immutable and fingerprints include actual ordered thresholds and statuses", () => {
  const first = configurationFromSettings(new Map());
  const changed = configurationFromSettings(
    new Map([
      [
        "member_indicators.fallback_thresholds",
        JSON.stringify({ frequencyCount: [{ min: 2, score: 5 }] }),
      ],
    ]),
  );
  assert.notEqual(
    first.configurationFingerprint,
    changed.configurationFingerprint,
  );
  assert.equal(
    configurationFromSettings(new Map()).thresholds.frequencyCount[0].min,
    12,
  );
  assert.throws(() =>
    configurationFromSettings(
      new Map([
        [
          "member_indicators.label_thresholds",
          '{"activeMin":3,"needsMonitoringMin":7}',
        ],
      ]),
    ),
  );
  assert.throws(() =>
    configurationFromSettings(
      new Map([["member_indicators.qualifying_participation_statuses", "[]"]]),
    ),
  );
  assert.throws(() =>
    configurationFromSettings(
      new Map([["member_indicators.fallback_thresholds", "broken json"]]),
    ),
  );
});
test("filters validate sorts, paired ranges, history contexts and explicit save confirmation", () => {
  assert.equal(
    rfmFiltersSchema.safeParse({ sortBy: "DROP TABLE members" }).success,
    false,
  );
  assert.equal(
    rfmFiltersSchema.safeParse({ context: "historical" }).success,
    false,
  );
  assert.equal(rfmFiltersSchema.safeParse({ context: "run" }).success, false);
  assert.equal(
    rfmFiltersSchema.safeParse({ minScore: 12, maxScore: 6 }).success,
    false,
  );
  assert.equal(
    rfmCommitSchema.safeParse({
      basisPeriodEnd: "2026-01-01",
      confirmed: false,
      previewFingerprint: "a".repeat(64),
    }).success,
    false,
  );
});
test("snapshot queries rank valid scores by basis before calculation ID; exact historical/run contexts and filters are parameterized", () => {
  const settings = configurationFromSettings(new Map());
  const q = rfmWorkspaceQuery(
    {
      ...defaultRfmFilters(),
      context: "historical",
      basisEnd: "2025-01-01",
      search: "x%' OR 1=1 --",
      classification: "Not Yet Scored",
      contributionScore: 2,
      sector: "Rice",
    },
    settings,
    "2026-11-02",
  );
  assert.match(
    q.cte,
    /ORDER BY validScore DESC, basis_period_end DESC, computed_at DESC, indicator_id DESC/,
  );
  assert.match(q.cte, /i\.basis_period_end = \?/);
  assert.match(
    q.cte,
    /approval_status = 'Approved'.*official_member_status IN \('Active', 'Inactive'\)/,
  );
  assert.ok(!q.cte.includes("MAX(indicator_id)"));
  assert.ok(!q.cte.includes("OR 1=1"));
  assert.match(q.where, /totalScore IS NULL/);
  assert.match(q.where, /sector = \?/);
  assert.ok(q.values.includes("2025-01-01"));
  assert.equal((q.cte + q.where).split("?").length - 1, q.values.length);
  const run = rfmWorkspaceQuery(
    {
      ...defaultRfmFilters(),
      context: "run",
      runId: "legacy:2025-01-01:2025-02-01T00:00:00",
    },
    settings,
  );
  assert.match(run.cte, /\$\.runId/);
  assert.ok(run.values.includes("legacy:2025-01-01:2025-02-01T00:00:00"));
});
test("diagnostics and matrix count distinct selected member rows, with null empty denominators", () => {
  const result = rfmDiagnostics(
    [
      { recencyScore: 1, frequencyScore: 2, contributionScore: 4, count: 2 },
      { recencyScore: 5, frequencyScore: 5, contributionScore: 5, count: 1 },
    ],
    3,
  );
  assert.equal(
    result.matrix.reduce((n, c) => n + c.count, 0),
    3,
  );
  assert.equal(result.components[0].median, 1);
  assert.equal(result.components[2].distribution[3].count, 2);
  assert.equal(
    histogramMedian([
      { score: 4, count: 1 },
      { score: 2, count: 1 },
    ]),
    3,
  );
  assert.equal(percentage(0, 0), null);
  assert.equal(rfmDiagnostics([], 0).components[0].average, null);
  const row = decorateRfmRow({
    totalScore: "9",
    recencyScore: "2",
    frequencyScore: "2",
    contributionScore: "5",
    metadata: "secret evidence",
    evidenceAvailable: 0,
  });
  assert.deepEqual(row.lowestComponents, ["Recency", "Frequency"]);
  assert.equal("metadata" in row, false);
});
test("Excel workbook is valid OOXML with numeric/currency/date cells and formula-safe text", async () => {
  assert.equal(safeSpreadsheetText(" =HYPERLINK(x)"), "' =HYPERLINK(x)");
  const file = await createRfmWorkbook([
    {
      name: "RFM Results",
      rows: [
        ["Name", "Capital", "Date"],
        ["=2+2", { value: 3000, style: 2 }, { value: 46000, style: 3 }],
        ["<Rice & Fish>", 0, null],
      ],
    },
  ]);
  const zip = await JSZip.loadAsync(file);
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.match(sheet, /t="inlineStr"/);
  assert.match(sheet, /&apos;=2\+2/);
  assert.match(sheet, /&lt;Rice &amp; Fish&gt;/);
  assert.ok(!sheet.includes("<f>"));
  assert.match(sheet, /s="2"><v>3000<\/v>/);
  assert.ok(zip.file("[Content_Types].xml"));
});

const auth: AuthContext = {
  sessionId: "1",
  tokenHash: "hash",
  user: {
    id: "1",
    displayName: "Chair",
    email: "chair@example.test",
    username: "chair",
    role: "chairman",
  },
};
function calculationDatabase(
  options: { busy?: boolean; failInsert?: boolean } = {},
) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  let previous: Record<string, unknown> | null = null;
  let committed = 0,
    rolledBack = 0;
  const connection = {
    async query(sql: string) {
      calls.push({ sql, values: [] });
      return [[], []];
    },
    async execute(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      if (sql.includes("GET_LOCK"))
        return [[{ acquired: options.busy ? 0 : 1 }], []];
      if (sql.includes("FROM system_settings")) return [[], []];
      if (sql.startsWith("SELECT CAST(m.member_id"))
        return [[{ memberId: "10" }], []];
      if (sql.includes("FROM member_activity_participation p"))
        return [
          [
            {
              memberId: "10",
              id: "1",
              activityId: "11",
              activity: "Assembly",
              date: "2026-01-01",
              status: "Participated",
              qualifying: 1,
            },
            {
              memberId: "10",
              id: "2",
              activityId: "12",
              activity: "Seminar",
              date: "2026-02-01",
              status: "Absent",
              qualifying: 1,
            },
            {
              memberId: "10",
              id: "3",
              activityId: "13",
              activity: "Nonqualifying",
              date: "2026-03-01",
              status: "Participated",
              qualifying: 0,
            },
          ],
          [],
        ];
      if (sql.includes("FROM share_capital_payments p"))
        return [
          [
            {
              memberId: "10",
              id: "1",
              date: "2026-01-01",
              amount: "3000.00",
              status: "Validated",
              reversalOf: null,
            },
            {
              memberId: "10",
              id: "2",
              date: "2026-01-01",
              amount: "500.00",
              status: "Rejected",
              reversalOf: null,
            },
            {
              memberId: "10",
              id: "3",
              date: "2026-01-01",
              amount: "-1000.00",
              status: "Reversed",
              reversalOf: "4",
            },
            {
              memberId: "10",
              id: "4",
              date: "2026-01-01",
              amount: "1000.00",
              status: "Reversed",
              reversalOf: null,
            },
          ],
          [],
        ];
      if (sql.includes("i.basis_period_start = ?"))
        return [previous ? [previous] : [], []];
      if (sql.startsWith("INSERT INTO member_status_indicators")) {
        if (options.failInsert) throw new Error("write failed");
        previous = {
          memberId: "10",
          id: "100",
          classification: values[10],
          metadata: values[12],
        };
        return [{ insertId: 100 }, []];
      }
      return [[], []];
    },
    async beginTransaction() {},
    async commit() {
      committed++;
    },
    async rollback() {
      rolledBack++;
    },
    release() {},
    destroy() {},
  };
  const pool = {
    async getConnection() {
      return connection;
    },
  } as unknown as Pool;
  return {
    repository: createRfmWorkspaceRepository(pool),
    calls,
    stats: () => ({ committed, rolledBack }),
    changePrior: () => {
      previous = {
        memberId: "10",
        id: "101",
        classification: "Inactive",
        metadata: "{}",
      };
    },
  };
}
test("preview and commit share the engine, preserve actual evidence/configuration, skip identical observations, and only audit RFM", async () => {
  const db = calculationDatabase();
  const input = { basisPeriodEnd: "2026-03-31" };
  const preview = await db.repository.preview(input);
  assert.equal(preview.affected, 1);
  assert.equal(
    db.calls.some((c) => c.sql.startsWith("INSERT")),
    false,
  );
  const first = await db.repository.recalculate(
    input,
    auth,
    preview.previewFingerprint,
  );
  assert.equal(first.saved, 1);
  const insert = db.calls.find((c) =>
    c.sql.startsWith("INSERT INTO member_status_indicators"),
  )!;
  assert.equal(insert.values[5], 3000);
  const metadata = JSON.parse(String(insert.values[12]));
  assert.equal(metadata.rawMetrics.frequencyCount, 1);
  assert.equal(metadata.evidence.participation[1].qualifies, false);
  assert.equal(metadata.evidence.contributions[2].qualifies, false);
  assert.equal(
    metadata.configuration.configurationFingerprint,
    preview.settings.configurationFingerprint,
  );
  assert.equal(metadata.runId, first.runId);
  assert.match(
    db.calls.find((c) =>
      c.sql.includes("FROM member_activity_participation p"),
    )!.sql,
    /p\.participation_date <= \?/,
  );
  assert.match(
    db.calls.find((c) => c.sql.includes("FROM share_capital_payments p"))!.sql,
    /p\.payment_date <= \?/,
  );
  const secondPreview = await db.repository.preview(input);
  const second = await db.repository.recalculate(
    input,
    auth,
    secondPreview.previewFingerprint,
  );
  assert.equal(second.saved, 0);
  assert.equal(second.skippedIdentical, 1);
  assert.equal(
    db.calls.some((c) =>
      /UPDATE member_profiles|INSERT INTO member_status_history/.test(c.sql),
    ),
    false,
  );
  assert.equal(
    db.calls.filter((c) => c.sql.includes("RELEASE_LOCK")).length,
    2,
  );
});
test("changed previews, concurrent execution and write failures never claim success and release locks", async () => {
  const db = calculationDatabase(),
    input = { basisPeriodEnd: "2026-03-31" };
  const preview = await db.repository.preview(input);
  db.changePrior();
  await assert.rejects(
    db.repository.recalculate(input, auth, preview.previewFingerprint),
    /changed after preview/,
  );
  assert.equal(
    db.calls.some((c) => c.sql.startsWith("INSERT")),
    false,
  );
  const busy = calculationDatabase({ busy: true });
  await assert.rejects(
    busy.repository.recalculate(input, auth),
    /Another indicator calculation/,
  );
  const failed = calculationDatabase({ failInsert: true });
  await assert.rejects(
    failed.repository.recalculate(input, auth),
    /write failed/,
  );
  assert.equal(failed.stats().rolledBack, 1);
  assert.equal(
    failed.calls.some((c) => c.sql.includes("RELEASE_LOCK")),
    true,
  );
  await assert.rejects(
    db.repository.recalculate(input, {
      ...auth,
      user: { ...auth.user, role: "member" },
    }),
    /Chairman access/,
  );
});
