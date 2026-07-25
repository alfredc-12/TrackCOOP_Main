import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 5055);
const apiUrl = `http://localhost:${apiPort}`;

let server: Server | null = null;
let membershipType = "Associate";
let officialMemberStatus = "Active";

function envelope(data: unknown, meta: Record<string, unknown> = {}) {
  return JSON.stringify({ success: true, message: "ok", data, meta });
}

function member() {
  return {
    id: "10",
    userId: "20",
    linkedUserEmail: "sample.member@example.test",
    linkedUserUsername: "samplemember",
    linkedUserStatus: "Active",
    linkedUserRole: "member",
    memberCode: "NFFAC-2026-000010",
    fullName: "Sample Member",
    contactNumber: "09170000000",
    email: "sample.member@example.test",
    barangay: "Palico",
    municipality: "Nasugbu",
    province: "Batangas",
    sector: "Farming",
    membershipType,
    approvalStatus: "Approved",
    officialMemberStatus,
    applicationDate: "2026-07-01T00:00:00.000Z",
    approvedBy: "1",
    approvedAt: "2026-07-02T00:00:00.000Z",
    trueMemberSince: membershipType === "True Member" ? "2026-07-24T00:00:00.000Z" : null,
    shareCapitalDeadline: "2027-07-01T00:00:00.000Z",
    notes: null,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    shareCapital: {
      validatedTotal: 3000,
      pendingTotal: 500,
      validatedPayments: 2,
      fullRequirement: 3000,
      maximumAllowed: 15000,
      remainingToFull: 0,
      remainingAllowed: 12000,
      fullRequirementMet: true,
    },
    recentPayments: [
      {
        id: "50",
        referenceNumber: "GCASH-100",
        paymentPurpose: "Share Capital",
        amount: 3000,
        validationStatus: "Validated",
        submittedAt: "2026-07-20T00:00:00.000Z",
      },
    ],
    recentPosActivity: [
      {
        id: "60",
        saleNumber: "POS-100",
        saleStatus: "Completed",
        paymentStatus: "Paid",
        totalAmount: 1200,
        saleDate: "2026-07-21T00:00:00.000Z",
      },
    ],
    recentRentalActivity: [
      {
        id: "70",
        bookingNumber: "RNT-100",
        assetName: "Hand Tractor",
        bookingStatus: "Completed",
        paymentStatus: "Paid",
        totalAmount: 2500,
        startDatetime: "2026-07-22T00:00:00.000Z",
      },
    ],
    latestIndicator: {
      id: "80",
      statusLabel: "Active",
      totalScore: 13,
      computedAt: "2026-07-23T00:00:00.000Z",
      basisSummary: "Recent validated activity.",
    },
    statusHistory: [
      {
        id: "90",
        memberId: "10",
        oldMembershipType: "Associate",
        newMembershipType: membershipType,
        oldOfficialStatus: "Pending",
        newOfficialStatus: officialMemberStatus,
        reason: "Approved by chairman.",
        changedBy: "1",
        changedAt: "2026-07-24T00:00:00.000Z",
      },
    ],
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

  if (url.startsWith("/api/membership-applications/summary")) {
    return { status: 200, body: envelope({ total: 0, submitted: 0, underReview: 0, needsInformation: 0, approved: 0, rejected: 0, withdrawn: 0 }) };
  }

  if (url.startsWith("/api/membership-applications?")) {
    return { status: 200, body: envelope([], { total: 0, page: 1, pageSize: 10 }) };
  }

  if (url.startsWith("/api/members/summary")) {
    return {
      status: 200,
      body: envelope({
        total: 1,
        pendingApproval: 0,
        approved: 1,
        associate: membershipType === "Associate" ? 1 : 0,
        trueMember: membershipType === "True Member" ? 1 : 0,
        active: officialMemberStatus === "Active" ? 1 : 0,
        inactive: 0,
        suspended: 0,
      }),
    };
  }

  if (url.startsWith("/api/members/status-history")) {
    return {
      status: 200,
      body: envelope([
        {
          id: "member-90",
          sourceModule: "Member",
          subjectId: "10",
          subjectCode: "NFFAC-2026-000010",
          subjectName: "Sample Member",
          oldStatus: "Associate / Active",
          newStatus: `${membershipType} / ${officialMemberStatus}`,
          reason: "Capital requirement met.",
          actor: "Test Chairman",
          changedAt: "2026-07-24T00:00:00.000Z",
        },
      ], { total: 1, page: 1, pageSize: 10 }),
    };
  }

  if (url.startsWith("/api/members?")) {
    return { status: 200, body: envelope([member()], { total: 1, page: 1, pageSize: 10 }) };
  }

  if (url === "/api/members/10" && method === "GET") {
    return { status: 200, body: envelope(member()) };
  }

  if (url === "/api/members/10/status" && method === "PATCH") {
    membershipType = "True Member";
    officialMemberStatus = "Active";
    return { status: 200, body: envelope(member()) };
  }

  return {
    status: 404,
    body: JSON.stringify({ success: false, message: "not found", errors: [] }),
  };
}

test.beforeAll(async () => {
  membershipType = "Associate";
  officialMemberStatus = "Active";

  server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", request.headers.origin ?? "http://localhost:3000");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Application-Tracking-Token");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");

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

test("chairman manages member directory and unified status history", async ({ page, context }) => {
  await page.route(`${apiUrl}/api/**`, async (route) => {
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

  await page.goto("/portal/chairman/members");

  await page.getByRole("button", { name: "Member Directory" }).click();
  await expect(page.getByText("Sample Member").first()).toBeVisible();
  await expect(page.getByText("NFFAC-2026-000010").first()).toBeVisible();

  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page.getByText("Share-Capital Progress")).toBeVisible();
  await expect(page.getByText("GCASH-100")).toBeVisible();
  await expect(page.getByText("POS-100")).toBeVisible();
  await expect(page.getByText("RNT-100")).toBeVisible();

  await page.getByRole("button", { name: "Update Status / Type" }).click();
  await page.getByLabel("Membership type").selectOption("True Member");
  await page.getByLabel("Reason").fill("Capital requirement met.");
  await page.getByLabel('Type "Sample Member" to confirm').fill("Sample Member");
  await page.getByRole("button", { name: "Save Status" }).click();

  await expect(page.getByText("True Member").first()).toBeVisible();

  await page.getByRole("dialog").filter({ hasText: "NFFAC-2026-000010" }).locator("button").first().click();
  await page.getByRole("button", { name: "Status History" }).click();
  await expect(page.getByText("Capital requirement met.").first()).toBeVisible();
  await expect(page.getByText("Member").first()).toBeVisible();
});
