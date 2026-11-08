# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-investigation.spec.ts >> P16 investigate new True Member application snapshot and six month deadline
- Location: tests\e2e\evidence-investigation.spec.ts:21:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 429
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import mysql, { type RowDataPacket } from "mysql2/promise";
  3  | import { randomUUID } from "node:crypto";
  4  | import { fallbackRfmConfiguration, configurationFromSettings } from "../../server/src/modules/member-indicators/member-indicator.policy";
  5  | import { scoreMinimum } from "../../server/src/modules/member-indicators/member-indicator.scoring";
  6  | import { capitalCompletion } from "../../server/src/modules/membership-policy/membership-policy";
  7  | import { decideApprovalMembership } from "../../server/src/modules/membership-applications/membership-application.capital.rules";
  8  | 
  9  | const api = "http://127.0.0.1:3218";
  10 | async function db() {
  11 |   const connection = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  12 |   const [rows] = await connection.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  13 |   const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  14 |   if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) {
  15 |     await connection.end(); throw new Error("Refusing unverified database");
  16 |   }
  17 |   return connection;
  18 | }
  19 | test.beforeAll(async () => { const connection = await db(); await connection.end(); });
  20 | 
  21 | test("P16 investigate new True Member application snapshot and six month deadline", async ({ request }) => {
  22 |   const connection = await db();
  23 |   try {
  24 |     const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Deadline${token}`;
  25 |     const data = { requestedMembershipType: "True Member", firstName, lastName: "Fixture", email: `deadline-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  26 |     const response = await request.post(`${api}/api/membership-applications/public`, { data });
> 27 |     expect(response.status()).toBe(201);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  28 |     const code = (await response.json()).data.applicationCode;
  29 |     const [rows] = await connection.execute<RowDataPacket[]>("SELECT a.share_capital_deadline_months, DATE_FORMAT(c.started_on,'%Y-%m-%d') AS start_date, DATE_FORMAT(c.deadline,'%Y-%m-%d') AS deadline, DATE_FORMAT(DATE_ADD(c.started_on, INTERVAL 6 MONTH),'%Y-%m-%d') AS expected_deadline FROM membership_applications a JOIN membership_capital_cases c ON c.membership_application_id=a.membership_application_id WHERE a.application_code=?", [code]);
  30 |     expect(rows).toHaveLength(1); expect(Number(rows[0].share_capital_deadline_months)).toBe(6); expect(rows[0].deadline).toBe(rows[0].expected_deadline);
  31 |     expect(capitalCompletion({ startedOn: "2026-08-31", validated: 2999.99, asOf: "2027-02-28" }).status).toBe("Reminder");
  32 |     expect(capitalCompletion({ startedOn: "2026-08-31", validated: 2999.99, asOf: "2027-03-01" }).status).toBe("Overdue");
  33 |     expect(capitalCompletion({ startedOn: "2026-08-31", validated: 3000, asOf: "2027-03-01" }).status).toBe("Completed");
  34 |   } finally { await connection.end(); }
  35 | });
  36 | 
  37 | test("P45 compare editable seeded thresholds with code fallback", async () => {
  38 |   const connection = await db();
  39 |   try {
  40 |     const [rows] = await connection.execute<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key='member_indicators.fallback_thresholds'");
  41 |     const configured = configurationFromSettings(new Map([["member_indicators.fallback_thresholds", String(rows[0].setting_value)]]));
  42 |     const values = [0, 0.01, 1499.99, 1500, 2999.99, 3000, 14999.99, 15000];
  43 |     expect(values.map(v => scoreMinimum(v, fallbackRfmConfiguration.thresholds.contributionAmount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  44 |     expect(values.map(v => scoreMinimum(v, configured.thresholds.contributionAmount))).toEqual([1, 1, 2, 3, 3, 3, 5, 5]);
  45 |   } finally { await connection.end(); }
  46 | });
  47 | 
  48 | test("P13 classification decision boundaries preserve the configured rules", () => {
  49 |   const settings = { initialShareCapital: 1500, trueMemberRequiredCapital: 3000, maximumShareCapital: 15000 };
  50 |   const decide = (validatedCapitalAmount: number) => decideApprovalMembership({ requestedMembershipType: "True Member", validatedCapitalAmount, settings });
  51 |   expect(() => decide(1499.99)).toThrow(/initial share capital/i);
  52 |   expect(decide(1500)).toMatchObject({ membershipType: "Associate", trueMemberEligible: false });
  53 |   expect(decide(2999.99)).toMatchObject({ membershipType: "Associate", trueMemberEligible: false });
  54 |   expect(decide(3000)).toMatchObject({ membershipType: "True Member", trueMemberEligible: true });
  55 |   expect(decide(15000)).toMatchObject({ membershipType: "True Member", trueMemberEligible: true });
  56 |   expect(() => decide(15000.01)).toThrow(/exceed/i);
  57 |   expect(decideApprovalMembership({ requestedMembershipType: "Associate", validatedCapitalAmount: 3000, settings }).membershipType).toBe("Associate");
  58 | });
  59 | 
  60 | test("P52 investigate canonical and internal member share capital routes", async ({ context, page }, info) => {
  61 |   const login = await context.request.post(`${api}/api/auth/login`, { data: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" } });
  62 |   expect(login.status()).toBe(200);
  63 |   const canonical = await page.goto("/portal/member/share-capital");
  64 |   expect(canonical?.status()).toBe(404);
  65 |   await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  66 |   await page.screenshot({ path: info.outputPath("P52-canonical-404.png") });
  67 |   const internal = await page.goto("/member/share-capital");
  68 |   expect(internal?.status()).toBe(200);
  69 |   await expect(page.getByRole("heading", { name: "My Share Capital" })).toBeVisible();
  70 |   await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? "database-run"}/screenshots/P52-internal-share-capital.png`, fullPage: true });
  71 | });
  72 | 
```