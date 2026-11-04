import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import {
  configurationFromSettings,
  defaultRfmFilters,
  rfmFiltersSchema,
} from "../../server/src/modules/member-indicators/member-indicator.policy";
import {
  percentage,
  histogramMedian,
  rfmDiagnostics,
} from "../../server/src/modules/member-indicators/member-indicator.workspace-query";
import { exportRfmWorkspace } from "../../server/src/modules/member-indicators/member-indicator.export";
import type {
  RfmFilters,
  RfmMemberRow,
  RfmSnapshotMetadata,
  RfmWorkspace,
} from "../../server/src/modules/member-indicators/member-indicator.workspace-types";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 5055);
const settings = configurationFromSettings(new Map());
let server: Server | null = null;
let commits = 0,
  previews = 0,
  workspaceRequests = 0;
let failCommit = false,
  failWorkspace = false,
  failExport = false;
const longName =
  "Maria Elena de los Santos Villanueva — Community Agricultural Representative";
function member(index: number): RfmMemberRow {
  const missing = index === 3,
    needs = index === 1,
    inactive = index === 2;
  return {
    memberId: String(10 + index),
    memberCode: `NFFAC-2026-${String(10 + index).padStart(6, "0")}`,
    fullName:
      index === 0
        ? longName
        : `Fixture Member ${String(index + 1).padStart(2, "0")}`,
    membershipType: index % 2 ? "True Member" : "Associate",
    officialMemberStatus: "Active",
    barangay: index % 2 ? "Palico" : "Wawa",
    sector: "Rice",
    indicatorId: missing ? null : String(80 + index),
    basisStart: missing ? null : "2025-11-02",
    basisEnd: missing ? null : "2026-11-02",
    recencyDays: missing || inactive ? null : needs ? 220 : 12,
    frequencyCount: missing ? null : inactive ? 0 : needs ? 1 : 7,
    validatedShareCapital: missing ? null : inactive ? 0 : needs ? 1500 : 8500,
    recencyScore: missing ? null : inactive ? 1 : needs ? 2 : 5,
    frequencyScore: missing ? null : inactive ? 1 : needs ? 2 : 4,
    contributionScore: missing ? null : inactive ? 1 : needs ? 3 : 4,
    totalScore: missing ? null : inactive ? 3 : needs ? 7 : 13,
    classification: missing
      ? null
      : inactive
        ? "Inactive"
        : needs
          ? "Needs Monitoring"
          : "Active",
    scoringVersion: missing ? null : settings.formulaVersion,
    computedAt: missing ? null : "2026-11-02T00:00:00Z",
    computedBy: missing ? null : "1",
    configurationFingerprint: missing
      ? null
      : settings.configurationFingerprint,
    evidenceAvailable: !missing,
    lastParticipation: missing || inactive ? null : "2026-10-21",
    quality: missing ? "Missing" : "Current",
    calculationAgeDays: missing ? null : 0,
    basisAgeDays: missing ? null : 0,
    lowestComponents: missing
      ? []
      : inactive
        ? ["Recency", "Frequency", "Contribution"]
        : needs
          ? ["Recency", "Frequency"]
          : ["Frequency", "Contribution"],
  };
}
const members = Array.from({ length: 25 }, (_, i) => member(i));
function fixtureWorkspace(q: RfmFilters, all = false): RfmWorkspace {
  let rows = members.map((row) => ({ ...row }));
  if (q.context === "historical" && q.basisEnd !== "2026-11-02")
    rows = rows.map((r) => ({
      ...r,
      indicatorId: null,
      basisStart: null,
      basisEnd: null,
      totalScore: null,
      recencyScore: null,
      frequencyScore: null,
      contributionScore: null,
      classification: null,
      quality: "Missing",
      computedAt: null,
      configurationFingerprint: null,
      evidenceAvailable: false,
    }));
  if (q.search)
    rows = rows.filter((r) =>
      `${r.fullName} ${r.memberCode}`
        .toLowerCase()
        .includes(q.search!.toLowerCase()),
    );
  if (q.classification)
    rows = rows.filter((r) =>
      q.classification === "Not Yet Scored"
        ? r.totalScore === null
        : r.classification === q.classification,
    );
  for (const key of [
    "membershipType",
    "barangay",
    "sector",
    "quality",
    "recencyScore",
    "frequencyScore",
    "contributionScore",
  ] as const)
    if (q[key] !== undefined) rows = rows.filter((r) => r[key] === q[key]);
  for (const [key, field, min] of [
    ["minScore", "totalScore", true],
    ["maxScore", "totalScore", false],
    ["minFrequency", "frequencyCount", true],
    ["maxFrequency", "frequencyCount", false],
    ["minContribution", "validatedShareCapital", true],
    ["maxContribution", "validatedShareCapital", false],
  ] as const)
    if (q[key] !== undefined)
      rows = rows.filter(
        (r) =>
          r.totalScore !== null &&
          r[field] !== null &&
          (min ? r[field]! >= q[key]! : r[field]! <= q[key]!),
      );
  rows.sort((a, b) => {
    const first = a[q.sortBy] ?? "",
      second = b[q.sortBy] ?? "";
    return (
      (typeof first === "number" && typeof second === "number"
        ? first - second
        : String(first).localeCompare(String(second))) *
      (q.sortDirection === "asc" ? 1 : -1)
    );
  });
  const scored = rows.filter((r) => r.totalScore !== null),
    eligible = rows.length;
  const counts = new Map<
    string,
    {
      recencyScore: number;
      frequencyScore: number;
      contributionScore: number;
      count: number;
    }
  >();
  for (const row of scored) {
    const key = `${row.recencyScore}:${row.frequencyScore}:${row.contributionScore}`;
    const item = counts.get(key) ?? {
      recencyScore: row.recencyScore!,
      frequencyScore: row.frequencyScore!,
      contributionScore: row.contributionScore!,
      count: 0,
    };
    item.count++;
    counts.set(key, item);
  }
  return {
    rows: all
      ? rows
      : rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    total: eligible,
    page: q.page,
    pageSize: q.pageSize,
    filters: q,
    settings,
    generatedAt: "2026-11-02T00:00:00Z",
    summary: {
      eligible,
      scored: scored.length,
      notScored: eligible - scored.length,
      active: scored.filter((r) => r.classification === "Active").length,
      needsMonitoring: scored.filter(
        (r) => r.classification === "Needs Monitoring",
      ).length,
      inactive: scored.filter((r) => r.classification === "Inactive").length,
      coverage: percentage(scored.length, eligible),
      average: scored.length
        ? scored.reduce((n, r) => n + r.totalScore!, 0) / scored.length
        : null,
      median: histogramMedian(
        scored.map((r) => ({ score: r.totalScore!, count: 1 })),
      ),
      latestCalculation: scored[0]?.computedAt ?? null,
      basisPeriods: scored.length
        ? [{ start: "2025-11-02", end: "2026-11-02", count: scored.length }]
        : [],
      versions: scored.length
        ? [{ version: settings.formulaVersion, count: scored.length }]
        : [],
      byType: ["Associate", "True Member"].map((type) => {
        const eligible = rows.filter((r) => r.membershipType === type).length,
          scoredCount = scored.filter((r) => r.membershipType === type).length;
        return {
          type,
          eligible,
          scored: scoredCount,
          coverage: percentage(scoredCount, eligible),
        };
      }),
      quality: [
        { status: "Current", count: scored.length },
        { status: "Missing", count: eligible - scored.length },
      ],
    },
    ...rfmDiagnostics([...counts.values()], scored.length),
    options: {
      barangays: ["Palico", "Wawa"],
      sectors: ["Rice"],
      versions: [settings.formulaVersion],
      bases: ["2026-11-02", "2026-10-02"],
    },
  };
}
function evidence(row = member(0)): RfmSnapshotMetadata {
  return {
    formulaVersion: settings.formulaVersion,
    configurationFingerprint: settings.configurationFingerprint,
    configuration: settings,
    runId: "fixture-run",
    advisoryOnly: true,
    officialStatusUnchanged: true,
    basisPeriod: { start: row.basisStart!, end: row.basisEnd! },
    rawMetrics: {
      recencyDays: row.recencyDays,
      frequencyCount: row.frequencyCount!,
      contributionAmount: row.validatedShareCapital!,
      sourceCounts: {
        qualifyingParticipation: 8,
        validatedShareCapitalPayments: 2,
      },
    },
    evidence: {
      participation: [
        {
          id: "101",
          activityId: "20",
          activity: "Cooperative assembly",
          date: "2026-10-21",
          status: "Participated",
          qualifies: true,
          inFrequencyWindow: true,
          reason: "Included in frequency and recency",
        },
      ],
      contributions: [
        {
          id: "201",
          date: "2026-05-01",
          amount: 8500,
          status: "Validated",
          qualifies: true,
          reason: "Validated payment through basis date",
        },
      ],
      lastParticipation: "2026-10-21",
      qualifyingAllTimeThroughBasis: 8,
      frequencyInPeriod: 7,
      validatedPaymentCount: 2,
      sourceFreshness: "Not independently verified",
    },
    scoring: {
      method: "configured-thresholds",
      recencyScore: 5,
      frequencyScore: 4,
      contributionScore: 4,
      totalScore: 13,
      label: "Active",
      explanation:
        "R + F + C, evaluated against the saved configured thresholds.",
      safeguardApplied: false,
    },
  };
}
const envelope = (data: unknown) =>
  JSON.stringify({ success: true, message: "ok", data, meta: {} });
async function responseFor(url: URL, method: string, body: string) {
  if (url.pathname === "/api/auth/me")
    return {
      status: 200,
      body: envelope({
        id: "1",
        username: "chairman",
        email: "chairman@example.test",
        displayName: "Test Chairman",
        role: "chairman",
        accountStatus: "Active",
      }),
    };
  const prefix = "/api/member-indicators/workspace";
  const path = url.pathname.slice(prefix.length);
  if (!url.pathname.startsWith(prefix))
    return { status: 404, body: envelope(null) };
  const query = rfmFiltersSchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (path === "" || path === "/") {
    workspaceRequests++;
    if (failWorkspace)
      return {
        status: 503,
        body: JSON.stringify({
          success: false,
          message: "Fixture workspace unavailable",
          errors: [],
        }),
      };
    return {
      status: 200,
      body: envelope(
        fixtureWorkspace(query.success ? query.data : defaultRfmFilters()),
      ),
    };
  }
  if (path === "/export") {
    if (failExport)
      return {
        status: 500,
        body: JSON.stringify({
          success: false,
          message: "Fixture export unavailable",
          errors: [],
        }),
      };
    return {
      status: 200,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: await exportRfmWorkspace(
        fixtureWorkspace(
          query.success ? query.data : defaultRfmFilters(),
          true,
        ),
      ),
    };
  }
  if (path === "/preview" && method === "POST") {
    previews++;
    const input = JSON.parse(body);
    return {
      status: 200,
      body: envelope({
        basis: {
          start: `${Number(input.basisPeriodEnd.slice(0, 4)) - 1}${input.basisPeriodEnd.slice(4)}`,
          end: input.basisPeriodEnd,
        },
        settings,
        affected: input.memberId ? 1 : 25,
        newlyScored: 1,
        changed: 1,
        unchanged: input.memberId ? 0 : 23,
        missingParticipation: 1,
        zeroContributions: 1,
        previewFingerprint: "a".repeat(64),
        generatedAt: "2026-11-02T00:00:00Z",
      }),
    };
  }
  if (path === "/recalculate" && method === "POST") {
    commits++;
    if (failCommit)
      return {
        status: 409,
        body: JSON.stringify({
          success: false,
          message: "Fixture sources changed after preview",
          errors: [],
        }),
      };
    return {
      status: 200,
      body: envelope({
        basis: { start: "2025-11-02", end: "2026-11-02" },
        settings,
        affected: 25,
        newlyScored: 1,
        changed: 1,
        unchanged: 23,
        missingParticipation: 1,
        zeroContributions: 1,
        previewFingerprint: "a".repeat(64),
        generatedAt: "2026-11-02T00:00:00Z",
        runId: "fixture-run",
        saved: 25,
        skippedIdentical: 0,
        computedAt: "2026-11-02T00:00:00Z",
      }),
    };
  }
  if (/\/\d+\/evidence\/\d+$/.test(path))
    return {
      status: 200,
      body: envelope({
        metadata: path.includes("/81") ? null : evidence(),
        message: path.includes("/81")
          ? "Detailed source records are unavailable for this saved calculation."
          : "Immutable source evidence captured when this calculation was saved.",
      }),
    };
  if (/\/\d+\/history$/.test(path)) {
    const rows = [
      member(0),
      {
        ...member(0),
        indicatorId: "79",
        basisStart: "2025-10-02",
        basisEnd: "2026-10-02",
        computedAt: "2026-11-03T00:00:00Z",
        recencyScore: 4,
        frequencyScore: 3,
        contributionScore: 4,
        totalScore: 11,
        classification: "Needs Monitoring" as const,
      },
    ];
    return {
      status: 200,
      body: envelope({ rows, total: 2, page: 1, pageSize: 50 }),
    };
  }
  if (path === "/runs")
    return {
      status: 200,
      body: envelope({
        rows: [
          {
            id: "fixture-run",
            basisStart: "2025-11-02",
            basisEnd: "2026-11-02",
            version: settings.formulaVersion,
            computedAt: "2026-11-02T00:00:00Z",
            count: 24,
            legacy: false,
          },
        ],
        total: 1,
      }),
    };
  return { status: 404, body: envelope(null) };
}
test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    response.setHeader(
      "Access-Control-Allow-Origin",
      request.headers.origin ?? "http://localhost:3107",
    );
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk);
    const result = await responseFor(
      new URL(request.url ?? "/", `http://localhost:${apiPort}`),
      request.method ?? "GET",
      Buffer.concat(chunks).toString(),
    );
    response.setHeader("Content-Type", result.type ?? "application/json");
    response.writeHead(result.status);
    response.end(result.body);
  });
  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(apiPort, resolve);
  });
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});
test.beforeEach(async ({ context }) => {
  commits = 0;
  previews = 0;
  workspaceRequests = 0;
  failCommit = false;
  failWorkspace = false;
  failExport = false;
  await context.addCookies([
    {
      name: "trackcoop_session",
      value: "fixture-session",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    },
  ]);
});
async function visit(page: Page, query = "") {
  await page.goto(`/portal/chairman/member-indicators${query}`);
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Member Indicators", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Scored Members/ }),
  ).toBeVisible();
}
async function select(page: Page, name: string, option: string) {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("KPIs, refresh, evidence and basis-ordered history are inspectable without recalculation", async ({
  page,
}) => {
  await visit(page);
  await expect(
    page.getByRole("button", { name: /Scored Members/ }),
  ).toContainText("24");
  await expect(
    page.getByRole("button", { name: /Not Yet Scored/ }),
  ).toContainText("1");
  const reads = workspaceRequests;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => workspaceRequests).toBeGreaterThan(reads);
  expect(commits).toBe(0);
  expect(previews).toBe(0);
  await select(page, "Sort by", "Member name");
  await select(page, "Sort direction", "Descending");
  const inspect = page
    .getByRole("button", { name: "Inspect RFM", exact: true })
    .first();
  await inspect.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("tab", { name: "Score Overview" }),
  ).toBeVisible();
  await dialog.getByRole("tab", { name: "Raw Evidence" }).click();
  await expect(
    dialog.getByText("Cooperative assembly", { exact: false }),
  ).toBeVisible();
  await expect(dialog.getByText(/all time/)).toBeVisible();
  await dialog.getByRole("tab", { name: "Score History" }).click();
  await expect(dialog.getByText(/Total \+2/)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(inspect).toBeFocused();
  expect(commits).toBe(0);
});

test("debounced search, filters, matrix selection, sort, pagination and URL state work", async ({
  page,
}) => {
  await visit(page);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await page
    .getByLabel("Search Member", { exact: true })
    .fill("NFFAC-2026-000010");
  await expect(page).toHaveURL(/search=NFFAC-2026-000010/);
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByText(longName, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await select(page, "RFM Classification", "Needs Monitoring");
  await expect(
    page.getByRole("button", { name: /Needs Monitoring.*scored members/ }),
  ).toContainText("100%");
  await page.getByRole("button", { name: "Reset all filters" }).click();
  await page.getByRole("button", { name: "Compare RFM Components" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Compare RFM Components" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /Recency 5, Frequency 4:/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/recencyScore=5/);
  await expect(page).toHaveURL(/frequencyScore=4/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Scored Members/ }),
  ).toContainText("22");
  await page.getByRole("button", { name: "More filters" }).click();
  await select(page, "Barangay", "Wawa");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page).toHaveURL(/barangay=Wawa/);
});

test("historical browsing, missing scores and legacy evidence never invent current calculations", async ({
  page,
}) => {
  await visit(page);
  await select(page, "Calculation Basis", "Historical Snapshot");
  await page.getByLabel("Saved historical basis end").fill("2025-01-31");
  await expect(
    page.getByText(/No valid saved calculation is available/),
  ).toBeVisible();
  expect(commits).toBe(0);
  expect(previews).toBe(0);
  await page.getByRole("button", { name: "Reset all filters" }).click();
  await select(page, "RFM Classification", "Not Yet Scored");
  await expect(
    page.getByRole("button", { name: /Scored Members/ }),
  ).toContainText("0");
  await page
    .getByRole("button", { name: "Inspect RFM", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(/No Inactive RFM label has been assigned/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Reset all filters" }).click();
  await select(page, "RFM Classification", "Needs Monitoring");
  await page
    .getByRole("button", { name: "Inspect RFM", exact: true })
    .first()
    .click();
  await page.getByRole("tab", { name: "Raw Evidence" }).click();
  await expect(
    page.getByText(
      "Detailed source records are unavailable for this saved calculation.",
    ),
  ).toBeVisible();
});

test("recalculation requires a real preview and explicit confirmation and handles failure", async ({
  page,
}) => {
  await visit(page);
  await page
    .getByRole("button", { name: "Recalculate Indicators", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Confirm and save indicators" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Preview calculation" }).click();
  await expect(
    dialog.getByRole("button", { name: "Confirm and save indicators" }),
  ).toBeDisabled();
  expect(commits).toBe(0);
  expect(previews).toBe(1);
  await dialog.getByRole("checkbox").check();
  failCommit = true;
  await dialog
    .getByRole("button", { name: "Confirm and save indicators" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Fixture sources changed after preview",
  );
  await expect(
    dialog.getByText("Calculation completed", { exact: true }),
  ).toHaveCount(0);
  failCommit = false;
  await dialog.getByRole("button", { name: "Preview calculation" }).click();
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Confirm and save indicators" })
    .click();
  await expect(
    dialog.getByText("Calculation completed", { exact: true }),
  ).toBeVisible();
  expect(commits).toBe(2);
});

test("Excel includes all filtered rows rather than one page, and print hides the portal", async ({
  page,
}) => {
  await visit(page, "?pageSize=10");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel", exact: true }).click();
  const download = await downloadPromise,
    path = await download.path();
  expect(path).toBeTruthy();
  const zip = await JSZip.loadAsync(await readFile(path!));
  const sheet = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
  expect(sheet.match(/<row r=/g)?.length).toBe(26);
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("heading", {
      name: "TrackCOOP · Member Indicators",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).not.toBeVisible();
});

test("workspace and export errors offer recovery without fabricated zeros", async ({
  page,
}) => {
  failWorkspace = true;
  await page.goto("/portal/chairman/member-indicators");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Fixture workspace unavailable",
  );
  failWorkspace = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("button", { name: /Scored Members/ }),
  ).toContainText("24");
  failExport = true;
  await page.getByRole("button", { name: "Export Excel", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Fixture export unavailable",
  );
  failExport = false;
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Retry export" }).click();
  await download;
});

test("diagnostics, quality filters, saved runs and column preferences are functional", async ({
  page,
}) => {
  await visit(page);
  await page
    .getByRole("button", { name: "Inspect Frequency diagnostics" })
    .click();
  await expect(
    page.getByRole("dialog").getByText(/Denominator: 24/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Filter score 2", exact: true })
    .click();
  await expect(page).toHaveURL(/frequencyScore=2/);
  await page.getByRole("button", { name: "Reset all filters" }).click();
  await page.getByRole("button", { name: "Coverage & Data Quality" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Missing:/ })
    .click();
  await expect(page).toHaveURL(/quality=Missing/);
  await expect(
    page.getByRole("button", { name: /^Scored Members/ }),
  ).toContainText("0");
  await page.getByRole("button", { name: "Reset all filters" }).click();
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Official status", exact: true })
    .check();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("columnheader", { name: "Official status", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("columnheader", { name: "Official status", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Calculation History", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View saved run", exact: true })
    .click();
  await expect(page).toHaveURL(/context=run/);
  await expect(page).toHaveURL(/runId=fixture-run/);
});

for (const width of [1440, 768, 390])
  test(`responsive ${width}px: long text, keyboard combobox and accessible drawers`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await visit(page);
    await page.screenshot({
      path: `scratch/rfm-evidence/rfm-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const combo = page.getByRole("combobox", {
      name: "RFM Classification",
      exact: true,
    });
    await combo.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(combo).toBeFocused();
    await page.getByRole("button", { name: "Compare RFM Components" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: `scratch/rfm-evidence/rfm-matrix-${width}.png`,
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Compare RFM Components" }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Scoring Guide", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close RFM drawer" }).click();
    if (width === 390) {
      await select(page, "RFM Classification", "Not Yet Scored");
      const card = page.locator("article").first();
      await expect(card).toContainText("Not scored");
      await expect(card).not.toContainText("No recorded participation");
    }
  });
