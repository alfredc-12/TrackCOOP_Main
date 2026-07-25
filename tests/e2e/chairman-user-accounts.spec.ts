import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 5056);

let server: Server | null = null;
let accountStatus = "Pending";
let activeSessionCount = 2;

function envelope(data: unknown, meta: Record<string, unknown> = {}) {
  return JSON.stringify({ success: true, message: "ok", data, meta });
}

function userSummary() {
  return {
    id: "7",
    username: "bookkeeper",
    email: "bookkeeper@example.test",
    displayName: "Book Keeper",
    role: "bookkeeper",
    accountStatus,
    lastLoginAt: null,
    createdAt: "2026-07-24T00:00:00.000Z",
    linkedMemberId: null,
    linkedMemberCode: null,
    linkedMemberName: null,
    activeSessionCount,
    activationTokenExpiresAt: accountStatus === "Pending" ? "2026-07-27T00:00:00.000Z" : null,
  };
}

function userDetail() {
  return {
    ...userSummary(),
    sessions: activeSessionCount > 0
      ? [
          {
            id: "99",
            ipAddress: "127.0.0.1",
            userAgent: "Playwright",
            createdAt: "2026-07-24T00:00:00.000Z",
            expiresAt: "2026-07-27T00:00:00.000Z",
            isCurrent: false,
          },
        ]
      : [],
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

  if (url.startsWith("/api/users/summary")) {
    return {
      status: 200,
      body: envelope({
        total: 1,
        active: accountStatus === "Active" ? 1 : 0,
        pendingActivation: accountStatus === "Pending" ? 1 : 0,
        suspendedInactive: accountStatus === "Suspended" || accountStatus === "Inactive" ? 1 : 0,
      }),
    };
  }

  if (url.startsWith("/api/users/linkable-members")) {
    return {
      status: 200,
      body: envelope([
        {
          id: "12",
          memberCode: "NFFAC-2026-000012",
          fullName: "Linked Member",
          email: "member@example.test",
        },
      ]),
    };
  }

  if (url.startsWith("/api/users?")) {
    return { status: 200, body: envelope([userSummary()], { total: 1, page: 1, pageSize: 10 }) };
  }

  if (url === "/api/users/7" && method === "GET") {
    return { status: 200, body: envelope(userDetail()) };
  }

  if (url === "/api/users/7/activation-link") {
    accountStatus = "Pending";
    return {
      status: 200,
      body: envelope({
        user: userSummary(),
        activationUrl: "http://localhost:3000/activate?token=account-token",
        activationTokenExpiresAt: "2026-07-27T00:00:00.000Z",
      }),
    };
  }

  if (url === "/api/users/7/status") {
    accountStatus = "Suspended";
    activeSessionCount = 0;
    return { status: 200, body: envelope(userSummary()) };
  }

  if (url === "/api/users/7/sessions/revoke") {
    activeSessionCount = 0;
    return { status: 200, body: envelope(userDetail()) };
  }

  return {
    status: 404,
    body: JSON.stringify({ success: false, message: "not found", errors: [] }),
  };
}

test.beforeAll(async () => {
  accountStatus = "Pending";
  activeSessionCount = 2;

  server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", request.headers.origin ?? "http://localhost:3000");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Application-Tracking-Token");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");

    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    const url = request.url ?? "";
    response.setHeader("Content-Type", "application/json");
    const result = mockApiResponse(url, request.method ?? "GET");
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

test("chairman manages account lifecycle and activation links", async ({ page, context }) => {
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

  await page.goto("/portal/chairman/users");

  await expect(page.getByRole("main").getByRole("heading", { name: "User Accounts" })).toBeVisible();
  await expect(page.getByText("Book Keeper").first()).toBeVisible();
  await expect(page.getByText("Pending Activation")).toBeVisible();

  await page.getByRole("button", { name: "Manage" }).click();
  await expect(page.getByRole("heading", { name: "Book Keeper" })).toBeVisible();
  await expect(page.getByText("Active Sessions")).toBeVisible();

  await page.getByRole("button", { name: "Issue Activation Link" }).click();
  await page.getByLabel("Reason").fill("Original activation link expired.");
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByRole("heading", { name: "Activation Link" })).toBeVisible();
  await expect(page.getByText("http://localhost:3000/activate?token=account-token")).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Revoke All" }).click();
  await page.getByLabel("Reason").fill("Role changed.");
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("No active sessions.")).toBeVisible();
});
