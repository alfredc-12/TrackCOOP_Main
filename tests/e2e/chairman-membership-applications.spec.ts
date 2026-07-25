import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 5055);
const apiUrl = `http://localhost:${apiPort}`;

let server: Server | null = null;
let currentStatus = "Submitted";

const detail = () => ({
  id: "1",
  applicationCode: "MEM-APP-2026-000001",
  applicationSource: "Public Website",
  requestedMembershipType: "Associate",
  fullName: "Maria Santos",
  email: "maria@example.com",
  contactNumber: "09171234567",
  barangay: "Barangay 1",
  applicationStatus: currentStatus,
  submittedAt: "2026-07-24T08:00:00.000Z",
  reviewedAt: currentStatus === "Submitted" ? null : "2026-07-24T08:05:00.000Z",
  convertedMemberId: currentStatus === "Approved" ? "42" : null,
  civilStatus: "Single",
  placeOfBirth: "Nasugbu",
  dateOfBirth: "1990-01-01",
  currentAddress: "Barangay 1, Nasugbu",
  municipality: "Nasugbu",
  province: "Batangas",
  fatherName: "Juan Santos",
  motherName: "Ana Santos",
  spouseName: null,
  occupation: "Farmer",
  orientationCommitmentAccepted: true,
  membershipFeeCommitmentAccepted: true,
  shareSubscriptionCommitmentAccepted: true,
  patronageRefundAcknowledged: true,
  bylawsAgreementAccepted: true,
  privacyConsentAccepted: true,
  applicantSignatureName: "Maria Santos",
  signedAt: "2026-07-24T08:00:00.000Z",
  signedPlace: "Nasugbu, Batangas",
  boardMeetingDate: null,
  secretaryName: null,
  decisionReason: null,
  submittedByUserId: null,
  reviewedBy: currentStatus === "Submitted" ? null : "1",
  submittedIp: "127.0.0.1",
  submittedUserAgent: "Playwright",
  beneficiaries: [
    {
      id: "10",
      applicationId: "1",
      fullName: "Pedro Santos",
      relationship: "Child",
      ageAtApplication: 10,
      birthDate: null,
      displayOrder: 0,
    },
  ],
  documents: [
    {
      id: "20",
      applicationId: "1",
      documentType: "Valid ID",
      originalFileName: "valid-id.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1200,
      checksumSha256: "hash",
      uploadedByUserId: null,
      uploadedAt: "2026-07-24T08:01:00.000Z",
    },
  ],
  requirements: [
    {
      id: "30",
      applicationId: "1",
      requirementType: "Valid ID",
      requirementStatus: "Verified",
      paymentReferenceId: null,
      documentId: "20",
      completionDate: "2026-07-24",
      verifiedBy: "1",
      verifiedAt: "2026-07-24T08:02:00.000Z",
      remarks: null,
    },
  ],
  history: [
    {
      id: "40",
      applicationId: "1",
      oldStatus: null,
      newStatus: "Submitted",
      internalNote: null,
      applicantMessage: "Your application was submitted.",
      changedBy: null,
      changedAt: "2026-07-24T08:00:00.000Z",
    },
  ],
});

function envelope(data: unknown, meta: Record<string, unknown> = {}) {
  return JSON.stringify({ success: true, message: "ok", data, meta });
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
    return {
      status: 200,
      body: envelope({
        total: 1,
        submitted: currentStatus === "Submitted" ? 1 : 0,
        underReview: currentStatus === "Under Review" ? 1 : 0,
        needsInformation: 0,
        approved: currentStatus === "Approved" ? 1 : 0,
        rejected: 0,
        withdrawn: 0,
      }),
    };
  }

  if (url.startsWith("/api/membership-applications?")) {
    return { status: 200, body: envelope([detail()], { total: 1, page: 1, pageSize: 10 }) };
  }

  if (url === "/api/membership-applications/1" && method === "GET") {
    return { status: 200, body: envelope(detail()) };
  }

  if (url === "/api/membership-applications/1/start-review") {
    currentStatus = "Under Review";
    return { status: 200, body: envelope(detail()) };
  }

  if (url === "/api/membership-applications/1/approve") {
    currentStatus = "Approved";
    return {
      status: 200,
      body: envelope({
        applicationId: "1",
        applicationCode: "MEM-APP-2026-000001",
        memberId: "42",
        memberCode: "MEM-2026-000042",
        membershipType: "Associate",
        shareCapitalDeadline: null,
        activationUrl: "http://localhost:3000/activate/member-token",
        activationTokenExpiresAt: "2026-07-25T08:00:00.000Z",
      }),
    };
  }

  return {
    status: 404,
    body: JSON.stringify({ success: false, message: "not found", errors: [] }),
  };
}

test.beforeAll(async () => {
  currentStatus = "Submitted";

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

test("chairman reviews and approves a membership application", async ({ page, context }) => {
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

  await expect(page.getByRole("main").getByRole("heading", { name: "Members" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Applications" })).toBeVisible();
  await expect(page.getByText("MEM-APP-2026-000001").first()).toBeVisible();

  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("Maria Santos").first()).toBeVisible();

  await page.getByRole("button", { name: "Start Review" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Under Review").first()).toBeVisible();

  await page.getByPlaceholder("Secretary name").fill("Secretary Test");
  await page.getByPlaceholder("Decision reason").fill("Requirements verified.");
  await page.getByLabel("Create member portal account").check();
  await page.getByRole("button", { name: "Approve and Convert" }).click();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByRole("heading", { name: "Application Approved" })).toBeVisible();
  await expect(page.getByText("http://localhost:3000/activate/member-token")).toBeVisible();
});
