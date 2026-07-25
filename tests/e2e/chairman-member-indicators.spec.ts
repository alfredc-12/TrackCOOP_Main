import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 5058);

let server: Server | null = null;

function envelope(data: unknown, meta: Record<string, unknown> = {}) {
  return JSON.stringify({ success: true, message: "ok", data, meta });
}

function indicator(overrides: Record<string, unknown> = {}) {
  return {
    id: "80",
    memberId: "10",
    memberCode: "NFFAC-2026-000010",
    fullName: "Sample Member",
    membershipType: "Associate",
    officialMemberStatus: "Active",
    basisPeriodStart: "2025-07-25",
    basisPeriodEnd: "2026-07-25",
    recencyScore: 5,
    frequencyScore: 4,
    contributionScore: 4,
    totalScore: 13,
    statusLabel: "Active",
    computedBy: "1",
    computedAt: "2026-07-25T00:00:00.000Z",
    basisSummary: JSON.stringify({
      formulaVersion: "transaction-rfm-v1",
      advisoryOnly: true,
      officialStatusUnchanged: true,
      rawMetrics: {
        recencyDays: 5,
        frequencyCount: 7,
        contributionAmount: 8500,
        sourceCounts: {
          shareCapitalPayments: 2,
          posSales: 3,
          rentalBookings: 1,
          paymentReferences: 1,
          financialRecords: 0,
        },
      },
      basisPeriod: {
        start: "2025-07-25",
        end: "2026-07-25",
      },
      scoring: {
        method: "quintile-rank",
        recencyScore: 5,
        frequencyScore: 4,
        contributionScore: 4,
        totalScore: 13,
        label: "Active",
        explanation: "Scores use deterministic population ranks.",
      },
    }),
    ...overrides,
  };
}

function mockApiResponse(url: string, method: string) {
  if (url === "/api/auth/me") {
    return {
      status: 200,
      body: envelope({
        id: "1",
        username: "chairman",
        email: "chairman@example.com",
        displayName: "Test Chairman",
        role: "chairman",
        accountStatus: "Active",
      }),
    };
  }

  if (url.startsWith("/api/member-indicators/summary")) {
    return {
      status: 200,
      body: envelope({
        totalTracked: 1,
        active: 1,
        needsMonitoring: 0,
        inactive: 0,
        averageScore: 13,
        distribution: [
          { statusLabel: "Active", total: 1, percentage: 100 },
          { statusLabel: "Needs Monitoring", total: 0, percentage: 0 },
          { statusLabel: "Inactive", total: 0, percentage: 0 },
        ],
      }),
    };
  }

  if (url === "/api/member-indicators/10/history") {
    return {
      status: 200,
      body: envelope([
        indicator(),
        indicator({
          id: "79",
          totalScore: 9,
          statusLabel: "Needs Monitoring",
          computedAt: "2026-06-25T00:00:00.000Z",
        }),
      ], { total: 2 }),
    };
  }

  if (url.startsWith("/api/member-indicators?")) {
    return { status: 200, body: envelope([indicator()], { total: 1, page: 1, pageSize: 20 }) };
  }

  if (url === "/api/member-indicators/recalculate" && method === "POST") {
    return {
      status: 200,
      body: envelope({
        recalculated: 1,
        basisPeriodStart: "2025-07-25",
        basisPeriodEnd: "2026-07-25",
      }),
    };
  }

  return {
    status: 404,
    body: JSON.stringify({ success: false, message: "not found", errors: [] }),
  };
}

test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", request.headers.origin ?? "http://localhost:3000");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    const result = mockApiResponse(request.url ?? "", request.method ?? "GET");
    response.setHeader("Content-Type", "application/json");
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

test("chairman reviews transaction-based member indicators", async ({ page, context }) => {
  await page.route("http://localhost:5000/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const result = mockApiResponse(`${requestUrl.pathname}${requestUrl.search}`, route.request().method());

    await route.fulfill({
      status: result.status,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
      },
      body: result.body,
    });
  });

  await context.addCookies([
    {
      name: "trackcoop_session",
      value: "test-session",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    },
  ]);

  await page.goto("/portal/chairman/member-indicators");

  await expect(page.getByText("descriptive decision-support signals")).toBeVisible();
  await expect(page.getByText("Sample Member")).toBeVisible();
  await expect(page.getByText("Contribution: ₱8,500.00")).toBeVisible();

  await page.getByRole("button", { name: "Recalculate All" }).click();
  await expect(page.getByText("Recalculated 1 member indicator(s).")).toBeVisible();

  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page.getByText("Included Sources")).toBeVisible();
  await expect(page.getByText("Financial Records")).toBeVisible();
  await expect(page.getByText("Scores use deterministic population ranks.")).toBeVisible();
  await expect(page.getByText("Total 9 (5 / 4 / 4)")).toBeVisible();
});
