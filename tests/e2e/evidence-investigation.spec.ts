import { expect, test } from "@playwright/test";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { fallbackRfmConfiguration, configurationFromSettings } from "../../server/src/modules/member-indicators/member-indicator.policy";
import { scoreMinimum } from "../../server/src/modules/member-indicators/member-indicator.scoring";
import { capitalCompletion } from "../../server/src/modules/membership-policy/membership-policy";
import { decideApprovalMembership } from "../../server/src/modules/membership-applications/membership-application.capital.rules";

const api = "http://127.0.0.1:3218";
async function db() {
  const connection = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  const [rows] = await connection.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) {
    await connection.end(); throw new Error("Refusing unverified database");
  }
  return connection;
}
test.beforeAll(async () => { const connection = await db(); await connection.end(); });

test("P16 investigate new True Member application snapshot and six month deadline", async ({ request }) => {
  const connection = await db();
  try {
    const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Deadline${token}`;
    const data = { requestedMembershipType: "True Member", firstName, lastName: "Fixture", email: `deadline-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
    const response = await request.post(`${api}/api/membership-applications/public`, { data });
    expect(response.status()).toBe(201);
    const code = (await response.json()).data.applicationCode;
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT a.share_capital_deadline_months, DATE_FORMAT(c.started_on,'%Y-%m-%d') AS start_date, DATE_FORMAT(c.deadline,'%Y-%m-%d') AS deadline, DATE_FORMAT(DATE_ADD(c.started_on, INTERVAL 6 MONTH),'%Y-%m-%d') AS expected_deadline FROM membership_applications a JOIN membership_capital_cases c ON c.membership_application_id=a.membership_application_id WHERE a.application_code=?", [code]);
    expect(rows).toHaveLength(1); expect(Number(rows[0].share_capital_deadline_months)).toBe(6); expect(rows[0].deadline).toBe(rows[0].expected_deadline);
    expect(capitalCompletion({ startedOn: "2026-08-31", validated: 2999.99, asOf: "2027-02-28" }).status).toBe("Reminder");
    expect(capitalCompletion({ startedOn: "2026-08-31", validated: 2999.99, asOf: "2027-03-01" }).status).toBe("Overdue");
    expect(capitalCompletion({ startedOn: "2026-08-31", validated: 3000, asOf: "2027-03-01" }).status).toBe("Completed");
  } finally { await connection.end(); }
});

test("P45 compare editable seeded thresholds with code fallback", async () => {
  const connection = await db();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key='member_indicators.fallback_thresholds'");
    const configured = configurationFromSettings(new Map([["member_indicators.fallback_thresholds", String(rows[0].setting_value)]]));
    const values = [0, 0.01, 1499.99, 1500, 2999.99, 3000, 14999.99, 15000];
    expect(values.map(v => scoreMinimum(v, fallbackRfmConfiguration.thresholds.contributionAmount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
    expect(values.map(v => scoreMinimum(v, configured.thresholds.contributionAmount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  } finally { await connection.end(); }
});

test("P13 classification decision boundaries preserve the configured rules", () => {
  const settings = { initialShareCapital: 1500, trueMemberRequiredCapital: 3000, maximumShareCapital: 15000 };
  const decide = (validatedCapitalAmount: number) => decideApprovalMembership({ requestedMembershipType: "True Member", validatedCapitalAmount, settings });
  expect(() => decide(1499.99)).toThrow(/initial share capital/i);
  expect(decide(1500)).toMatchObject({ membershipType: "Associate", trueMemberEligible: false });
  expect(decide(2999.99)).toMatchObject({ membershipType: "Associate", trueMemberEligible: false });
  expect(decide(3000)).toMatchObject({ membershipType: "True Member", trueMemberEligible: true });
  expect(decide(15000)).toMatchObject({ membershipType: "True Member", trueMemberEligible: true });
  expect(() => decide(15000.01)).toThrow(/exceed/i);
  expect(decideApprovalMembership({ requestedMembershipType: "Associate", validatedCapitalAmount: 3000, settings }).membershipType).toBe("Associate");
});

test("P52 canonical member share capital route loads and survives refresh", async ({ browser, context, page }) => {
  const login = await context.request.post(`${api}/api/auth/login`, { data: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" } });
  expect(login.status()).toBe(200);
  const canonical = await page.goto("/portal/member/share-capital");
  expect(canonical?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "My Share Capital" })).toBeVisible();
  await expect(page.getByText("Member Portal", { exact: true })).toBeVisible();
  await expect(page.getByText("Maria Santos", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("₱1,500.00", { exact: true }).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Direction" }).click();
  await page.getByRole("option", { name: "Credits" }).click();
  await expect(page.getByRole("row", { name: /Initial Share Capital/ })).toBeVisible();
  await page.getByRole("combobox", { name: "Direction" }).click();
  await page.getByRole("option", { name: "All", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "My Share Capital" })).toBeVisible();
  await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? "database-run"}/screenshots/P52-share-capital.png`, fullPage: true });
  await page.goto("/portal/member/dashboard");
  await page.getByRole("button", { name: "Member & Share", exact: true }).click();
  await page.getByRole("link", { name: "Full history" }).click();
  await expect(page).toHaveURL(/\/portal\/member\/share-capital/);
  await expect(page.getByRole("heading", { name: "My Share Capital" })).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const anonymous=await browser.newContext();
  try {
    const visitor=await anonymous.newPage(); await visitor.goto("/portal/member/share-capital");
    await expect(visitor).toHaveURL(/\/login/);
    await expect(visitor.getByRole("heading", { name: "My Share Capital" })).toHaveCount(0);
  } finally { await anonymous.close(); }
});

test("P52 withdrawal provider control opens and selects with a synthetic dividend response", async ({ context, page }) => {
  expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" } })).status()).toBe(200);
  await page.route("**/api/members/me/dividends", route => route.fulfill({ json: { success:true, message:"", meta:{}, data:[{ id:"synthetic", declarationId:"1", declarationName:"Synthetic dividend", declarationStatus:"Published", coverageStart:"2025-01-01", coverageEnd:"2025-12-31", declaredAt:"2026-01-01", distributionDate:"2026-01-02", amount:100, status:"Available", decision:null, withdrawalMethod:null, withdrawalProvider:null, withdrawalAccountName:null, withdrawalAccountNumber:null, withdrawalQrCode:null, withdrawalReceipt:null, withdrawalReceiptName:null, decidedAt:null, processedAt:null, capitalTransactionId:null, withdrawalReference:null, createdAt:"2026-01-01" }] } }));
  await page.goto("/portal/member/share-capital"); await page.getByRole("button",{name:"Withdraw",exact:true}).click();
  await page.getByRole("button",{name:"Online Transfer"}).click();
  const provider=page.getByRole("combobox",{name:"Provider"}); await provider.click(); await page.getByRole("option",{name:"Maya"}).click();
  await expect(provider).toContainText("Maya");
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Withdraw this Annual Interest?"})).toHaveCount(0);
});
