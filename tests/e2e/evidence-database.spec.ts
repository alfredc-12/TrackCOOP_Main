import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { calculateMemberIndicator, scoreMinimum, scoreRecency } from "../../server/src/modules/member-indicators/member-indicator.scoring";
import { configurationFromSettings } from "../../server/src/modules/member-indicators/member-indicator.policy";

const api = "http://127.0.0.1:3218";
const accounts = {
  chairman: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" },
  bookkeeper: { identifier: "bookkeeper.test@trackcoop.local", password: "BookkeeperTest123!" },
  member: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" },
  associate: { identifier: "benito.member@trackcoop.local", password: "MemberTest123!" },
} as const;

async function login(context: BrowserContext, role: keyof typeof accounts) {
  const response = await context.request.post(`${api}/api/auth/login`, { data: accounts[role] });
  expect(response.status()).toBe(200);
  expect((await response.json()).data.role).toBe(role === "associate" ? "member" : role);
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? "database-run"}/screenshots/${name}.png` });
}

async function database() {
  const connection = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  const [rows] = await connection.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) {
    await connection.end();
    throw new Error("Refusing an unverified database target");
  }
  return connection;
}

test.beforeAll(async () => { const db = await database(); await db.end(); });

test("P01 Chairman login grants authenticated member directory access", async ({ context, page }) => {
  await login(context, "chairman");
  expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(200);
  expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(200);
  await page.goto("/portal/chairman/dashboard");
  await expect(page).toHaveURL(/\/portal\/chairman\/dashboard/);
  await expect(page.getByRole("heading", { name: "Member analytics", exact: true })).toBeVisible();
  await screenshot(page, "P01-chairman-dashboard");
});

test("P02 Bookkeeper login grants financial category access", async ({ context, page }) => {
  await login(context, "bookkeeper");
  expect((await context.request.get(`${api}/api/financial-categories`)).status()).toBe(200);
  await page.goto("/portal/bookkeeper/financial-dashboard");
  await expect(page).toHaveURL(/\/portal\/bookkeeper\/financial-dashboard/);
  await expect(page.locator("main")).toBeVisible();
  await screenshot(page, "P02-bookkeeper-dashboard");
});

test("P03 Member login grants access to own profile", async ({ context, page }) => {
  await login(context, "member");
  const profile = await context.request.get(`${api}/api/members/me/profile`);
  expect(profile.status()).toBe(200);
  expect((await profile.json()).email).toBe("maria.member@trackcoop.local");
  await page.goto("/portal/member/dashboard");
  await expect(page).toHaveURL(/\/portal\/member\/dashboard/);
  await expect(page.getByRole("heading", { name: /Welcome back, Maria/i })).toBeVisible();
  await screenshot(page, "P03-member-dashboard");
});

test("P04 Invalid credentials are rejected with feedback", async ({ context, page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or username", { exact: true }).fill("nobody.evidence@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword123!");
  await page.getByRole("button", { name: "Sign in to account" }).click();
  await expect(page.getByRole("region", { name: "Account sign in" }).getByRole("alert")).toContainText(/incorrect/i);
  expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  await screenshot(page, "P04-invalid-login");
});

test("P05 Logout revokes the existing server session", async ({ context, browser }) => {
  await login(context, "member");
  const cookie = (await context.cookies(api)).find(c => c.name === "trackcoop_session");
  expect(cookie).toBeTruthy();
  expect((await context.request.post(`${api}/api/auth/logout`)).status()).toBe(200);
  expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  const replay = await browser.newContext();
  await replay.addCookies([cookie!]);
  expect((await replay.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  await replay.close();
});

test("P06 Member and bookkeeper are denied restricted backend operations", async ({ browser }) => {
  const member = await browser.newContext();
  const bookkeeper = await browser.newContext();
  try {
    await login(member, "member");
    await login(bookkeeper, "bookkeeper");
    expect((await member.request.get(`${api}/api/members/summary`)).status()).toBe(403);
    expect((await member.request.post(`${api}/api/financial-records`, { data: {} })).status()).toBe(403);
    expect((await bookkeeper.request.get(`${api}/api/members/summary`)).status()).toBe(403);
    expect((await bookkeeper.request.post(`${api}/api/members`, { data: {} })).status()).toBe(403);
    const memberPage = await member.newPage();
    await memberPage.goto("/portal/chairman/dashboard");
    await expect(memberPage).toHaveURL(/\/portal\/member\/dashboard/);
    const bookkeeperPage = await bookkeeper.newPage();
    await bookkeeperPage.goto("/portal/chairman/dashboard");
    await expect(bookkeeperPage).toHaveURL(/\/portal\/bookkeeper\/financial-dashboard/);
  } finally { await member.close(); await bookkeeper.close(); }
});

test("P07 Member cannot read or alter another member through staff record routes", async ({ context }) => {
  const db = await database();
  try {
    const [before] = await db.query<RowDataPacket[]>("SELECT member_id,full_name FROM member_profiles WHERE member_code='NFFAC-SEED-0002'");
    const id = before[0].member_id;
    await login(context, "member");
    expect((await context.request.get(`${api}/api/members/${id}`)).status()).toBe(403);
    expect((await context.request.patch(`${api}/api/members/${id}`, { data: { fullName: "Synthetic forbidden update" } })).status()).toBe(403);
    const [after] = await db.execute<RowDataPacket[]>("SELECT member_id,full_name FROM member_profiles WHERE member_id=?", [id]);
    expect(after[0]).toEqual(before[0]);
  } finally { await db.end(); }
});

test("P07 other member cannot read a private document or alter owner records", async ({ browser }) => {
  const db=await database(), chairman=await browser.newContext(), owner=await browser.newContext(), other=await browser.newContext();
  try {
    await login(chairman,"chairman"); await login(owner,"member"); await login(other,"associate");
    const [members]=await db.query<RowDataPacket[]>("SELECT member_id,full_name FROM member_profiles WHERE member_code='NFFAC-SEED-0001'");
    const id=String(members[0].member_id), title=`Private fixture ${randomUUID()}`, bytes=Buffer.from("%PDF-1.4\n% synthetic private document\n%%EOF\n");
    const upload=await chairman.request.post(`${api}/api/documents`,{multipart:{title,category:"OTHER",documentType:"Other",accessLevel:"MEMBER_ONLY",file:{name:"fixture.pdf",mimeType:"application/pdf",buffer:bytes}}}); expect(upload.status()).toBe(201);
    const [documents]=await db.execute<RowDataPacket[]>("SELECT document_id FROM documents WHERE title=?",[title]); const documentId=String(documents[0].document_id);
    await db.execute("UPDATE documents SET member_id=? WHERE document_id=?",[id,documentId]);
    const own=await owner.request.get(`${api}/api/documents/${documentId}/file?action=download`); expect(own.status()).toBe(200); expect(await own.body()).toEqual(bytes);
    expect((await other.request.get(`${api}/api/documents/${documentId}/file?action=download`)).status()).toBe(404);
    expect((await other.request.get(`${api}/api/members/${id}`)).status()).toBe(403);
    expect((await other.request.patch(`${api}/api/members/${id}`,{data:{fullName:"Forbidden Synthetic Change"}})).status()).toBe(403);
    expect((await other.request.get(`${api}/api/share-capital/member/${id}`)).status()).toBe(403);
    const [after]=await db.execute<RowDataPacket[]>("SELECT member_id,full_name FROM member_profiles WHERE member_id=?",[id]); expect(after[0]).toEqual(members[0]);
  } finally { await chairman.close(); await owner.close(); await other.close(); await db.end(); }
});

test("P08 Public pages are reachable while a private backend route is denied", async ({ page, context }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  await page.goto("/membership/apply");
  await expect(page.getByRole("heading", { name: "Become a Member" })).toBeVisible();
  expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(401);
  await screenshot(page, "P08-public-application");
  const message = `Synthetic inquiry ${randomUUID()}`;
  const response = await context.request.post(`${api}/api/requests/public`, { data: { requesterName: "Synthetic Visitor", requestType: "General", message, consent: true } });
  expect(response.status()).toBe(201);
  const db = await database();
  try {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT message,request_source FROM requests_inquiries WHERE message=?", [message]);
    expect(rows).toHaveLength(1);
    expect(rows[0].request_source).toBe("Public Website");
  } finally { await db.end(); }
});

test("P09 Valid synthetic public application persists expected fields", async ({ request }) => {
  const email = `playwright-${randomUUID()}@example.invalid`;
  const data = { firstName: "Synthetic", lastName: "Applicant", email, contactNumber: "9171112222", dateOfBirth: "1990-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: "Synthetic Applicant", signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  const response = await request.post(`${api}/api/membership-applications/public`, { data });
  expect(response.status()).toBe(201);
  const code = (await response.json()).data.applicationCode;
  const db = await database();
  try {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT application_code, first_name, last_name, email, application_status FROM membership_applications WHERE application_code=?", [code]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ application_code: code, first_name: "Synthetic", last_name: "Applicant", email, application_status: "Submitted" });
  } finally { await db.end(); }
});

test("P10 Incomplete membership application is rejected without insertion", async ({ request }) => {
  const db = await database();
  try {
    const [before] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
    const response = await request.post(`${api}/api/membership-applications/public`, { data: { firstName: "Incomplete" } });
    expect(response.status()).toBe(400);
    expect((await response.json()).success).toBe(false);
    const [after] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
    expect(after[0].n).toBe(before[0].n);
  } finally { await db.end(); }
});

test("P12 Unauthorized roles cannot approve an application", async ({ browser }) => {
  const db = await database();
  const member = await browser.newContext();
  const bookkeeper = await browser.newContext();
  try {
    const [before] = await db.query<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications ORDER BY membership_application_id LIMIT 1");
    const id = before[0].membership_application_id;
    await login(member, "member"); await login(bookkeeper, "bookkeeper");
    for (const context of [member, bookkeeper]) {
      expect((await context.request.post(`${api}/api/membership-applications/${id}/approve`, { data: {} })).status()).toBe(403);
    }
    const [after] = await db.execute<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications WHERE membership_application_id=?", [id]);
    expect(after[0]).toEqual(before[0]);
  } finally { await member.close(); await bookkeeper.close(); await db.end(); }
});

async function rfmSettings() {
  const db = await database();
  try {
    const [rows] = await db.query<RowDataPacket[]>("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'member_indicators.%'");
    return configurationFromSettings(new Map(rows.map(row => [String(row.setting_key), String(row.setting_value)])));
  } finally { await db.end(); }
}

test("P43 configured recency scoring at requested boundaries", async () => {
  const { thresholds } = await rfmSettings();
  expect([0, 30, 31, 90, 91, 180, 181, 365, 366, null].map(v => scoreRecency(v, thresholds.recencyDays))).toEqual([5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
});

test("P44 configured frequency scoring at requested boundaries", async () => {
  const { thresholds } = await rfmSettings();
  expect([0, 1, 2, 3, 5, 6, 11, 12].map(v => scoreMinimum(v, thresholds.frequencyCount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
});

test("P45 configured contribution scoring at requested boundaries", async () => {
  const { thresholds } = await rfmSettings();
  expect([0, 0.01, 1499.99, 1500, 2999.99, 3000, 14999.99, 15000].map(v => scoreMinimum(v, thresholds.contributionAmount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
});

test("P46 configured combined labels respect score bands", async () => {
  const settings = await rfmSettings();
  for (const recencyDays of [null, 365, 180, 90, 30]) for (const frequencyCount of [0, 1, 3, 6, 12]) for (const validatedShareCapital of [0, 1, 1500, 5000, 10000]) {
    const result = calculateMemberIndicator({ recencyDays, frequencyCount, validatedShareCapital, ...settings });
    if (!result.inactiveForNoRecentParticipation) expect(result.statusLabel).toBe(result.totalScore >= 12 ? "Active" : result.totalScore >= 7 ? "Needs Monitoring" : "Inactive");
  }
});

test("P47 inactivity safeguard overrides a higher combined label", async () => {
  const settings = await rfmSettings();
  for (const recencyDays of [null, 366]) {
    const result = calculateMemberIndicator({ recencyDays, frequencyCount: 0, validatedShareCapital: 15000, ...settings });
    expect(result.totalScore).toBeGreaterThanOrEqual(7);
    expect(result.inactiveForNoRecentParticipation).toBe(true);
    expect(result.statusLabel).toBe("Inactive");
  }
});

test("P16 configured capital completion deadline matches six-month requirement", async () => {
  const db = await database();
  try {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key=?", ["membership.share_capital_deadline_months"]);
    expect(Number(rows[0].setting_value)).toBe(6);
  } finally { await db.end(); }
});

test("P48 RFM recalculation does not change official membership status", async ({ context }) => {
  const db = await database();
  try {
    const [before] = await db.query<RowDataPacket[]>("SELECT member_id,official_member_status FROM member_profiles WHERE member_code='NFFAC-SEED-0001'");
    const memberId = String(before[0].member_id);
    await login(context, "chairman");
    const data = { memberId, basisPeriodEnd: "2026-10-31" };
    const preview = await context.request.post(`${api}/api/member-indicators/workspace/preview`, { data });
    expect(preview.status()).toBe(200);
    const fingerprint = (await preview.json()).data.previewFingerprint;
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    const commit = await context.request.post(`${api}/api/member-indicators/workspace/recalculate`, { data: { ...data, confirmed: true, previewFingerprint: fingerprint } });
    expect(commit.status()).toBe(200);
    const [after] = await db.execute<RowDataPacket[]>("SELECT member_id,official_member_status FROM member_profiles WHERE member_id=?", [memberId]);
    expect(after[0]).toEqual(before[0]);
    const [indicators] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM member_status_indicators WHERE member_id=? AND basis_period_end=?", [memberId, data.basisPeriodEnd]);
    expect(Number(indicators[0].n)).toBeGreaterThan(0);
  } finally { await db.end(); }
});

test("P24 Bookkeeper saves classified income and expense records", async ({ context }) => {
  const db = await database();
  try {
    await login(context, "bookkeeper");
    const tag = `P24-${randomUUID().slice(0, 8)}`;
    const [cats] = await db.query<RowDataPacket[]>("SELECT financial_category_id,category_code FROM financial_categories WHERE category_code IN ('OTHER_INCOME','OFFICE_SUPPLIES')");
    for (const [suffix, type, code, amount] of [["I", "Income", "OTHER_INCOME", 5000], ["E", "Expense", "OFFICE_SUPPLIES", 1700]] as const) {
      const category = cats.find(row => row.category_code === code)!;
      const recordNumber = `${tag}-${suffix}`;
      const response = await context.request.post(`${api}/api/financial-records`, { data: { recordNumber, financialCategoryId: String(category.financial_category_id), recordType: type, sourceModule: "Manual", amount, recordDate: "2020-02-29" } });
      expect(response.status()).toBe(201);
      const [rows] = await db.execute<RowDataPacket[]>("SELECT record_type, financial_category_id, amount FROM financial_records WHERE record_number=?", [recordNumber]);
      expect(rows).toHaveLength(1);
      expect(rows[0].record_type).toBe(type);
      expect(String(rows[0].financial_category_id)).toBe(String(category.financial_category_id));
      expect(Number(rows[0].amount)).toBe(amount);
    }
  } finally { await db.end(); }
});

test("P25 P26 posted operating surplus excludes separately recorded share capital", async ({ context }) => {
  const db = await database();
  try {
    const tag = `P26-${randomUUID().slice(0, 8)}`;
    const [users] = await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='bookkeeper.test'");
    await db.query("INSERT IGNORE INTO financial_categories(category_code,category_name,category_type,is_system_category,is_active) VALUES('INTERNAL_TRANSFER','Synthetic Internal Transfer','Income',0,1),('CAPITAL_EXPENDITURE','Synthetic Capital Expenditure','Expense',0,1)");
    const [cats] = await db.query<RowDataPacket[]>("SELECT financial_category_id,category_code FROM financial_categories WHERE category_code IN ('OTHER_INCOME','OFFICE_SUPPLIES','SHARE_CAPITAL','INTERNAL_TRANSFER','CAPITAL_EXPENDITURE')");
    for (const [suffix, type, source, code, amount] of [["I", "Income", "Manual", "OTHER_INCOME", 5000], ["E", "Expense", "Manual", "OFFICE_SUPPLIES", 1700], ["C", "Income", "Share Capital", "SHARE_CAPITAL", 1000], ["T", "Income", "Manual", "INTERNAL_TRANSFER", 400], ["X", "Expense", "Manual", "CAPITAL_EXPENDITURE", 500]] as const) {
      const category = cats.find(row => row.category_code === code)!;
      await db.execute("INSERT INTO financial_records(record_number,financial_category_id,recorded_by,approved_by,record_type,source_module,amount,record_date,record_status) VALUES(?,?,?,?,?,?,?,'2020-02-29','Active')", [`${tag}-${suffix}`, category.financial_category_id, users[0].user_id, users[0].user_id, type, source, amount]);
    }
    const [rows] = await db.execute<RowDataPacket[]>("SELECT record_type,source_module,amount FROM financial_records WHERE record_number LIKE ?", [`${tag}%`]);
    expect(rows).toHaveLength(5);
    await login(context, "chairman");
    const query = new URLSearchParams({ period: "custom", start: "2020-02-29", end: "2020-02-29", compare: "none", reference: tag });
    const response = await context.request.get(`${api}/api/chairman/financial-analytics?${query}`);
    expect(response.status()).toBe(200);
    const overview = (await response.json()).data.overview;
    expect(overview).toMatchObject({ income: 5000, expenses: 1700, net: 3300 });
  } finally { await db.end(); }
});

test("P50 analytics endpoints use separate reports and deny member access", async ({ browser }) => {
  const chairman = await browser.newContext();
  const member = await browser.newContext();
  try {
    await login(chairman, "chairman"); await login(member, "member");
    const finance = `${api}/api/chairman/financial-analytics`;
    const membership = `${api}/api/chairman/member-analytics`;
    const financialReport = await chairman.request.get(finance);
    const memberReport = await chairman.request.get(membership);
    expect(financialReport.status()).toBe(200);
    expect(memberReport.status()).toBe(200);
    expect((await financialReport.json()).data).toHaveProperty("overview.income");
    expect((await memberReport.json()).data).not.toHaveProperty("overview.income");
    expect((await member.request.get(finance)).status()).toBe(403);
    expect((await member.request.get(membership)).status()).toBe(403);
  } finally { await chairman.close(); await member.close(); }
});

test("P54 repeated member login and logout consistently revoke sessions", async ({ browser }) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const context = await browser.newContext();
    try {
      await login(context, "member");
      expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(200);
      expect((await context.request.post(`${api}/api/auth/logout`)).status()).toBe(200);
      expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
    } finally { await context.close(); }
  }
});

test("P36 authorized document upload persists metadata and retrieves bytes", async ({ context }) => {
  const db = await database();
  try {
    await login(context, "chairman");
    const title = `Synthetic P36 ${randomUUID()}`;
    const bytes = Buffer.from("%PDF-1.4\n% synthetic document\n%%EOF\n");
    const upload = await context.request.post(`${api}/api/documents`, { multipart: { title, category: "OTHER", documentType: "Other", accessLevel: "ADMIN_ONLY", file: { name: "synthetic.pdf", mimeType: "application/pdf", buffer: bytes } } });
    expect(upload.status()).toBe(201);
    const [rows] = await db.execute<RowDataPacket[]>("SELECT document_id,title,access_level,mime_type,file_size_bytes FROM documents WHERE title=?", [title]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title, access_level: "Admin-only", mime_type: "application/pdf" });
    expect(Number(rows[0].file_size_bytes)).toBe(bytes.length);
    const file = await context.request.get(`${api}/api/documents/${rows[0].document_id}/file?action=download`);
    expect(file.status()).toBe(200);
    expect(await file.body()).toEqual(bytes);
  } finally { await db.end(); }
});

test("P37 invalid and missing document uploads are rejected without records", async ({ context }) => {
  const db = await database();
  try {
    await login(context, "chairman");
    const [before] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM documents");
    const metadata = { title: "Synthetic invalid upload", category: "OTHER", documentType: "Other", accessLevel: "ADMIN_ONLY" };
    const missing = await context.request.post(`${api}/api/documents`, { multipart: metadata });
    expect(missing.status()).toBe(422);
    const unsupported = await context.request.post(`${api}/api/documents`, { multipart: { ...metadata, file: { name: "synthetic.exe", mimeType: "application/octet-stream", buffer: Buffer.from("synthetic") } } });
    expect(unsupported.status()).toBe(422);
    const mismatch = await context.request.post(`${api}/api/documents`, { multipart: { ...metadata, file: { name: "synthetic.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf") } } });
    expect(mismatch.status()).toBe(422);
    const [after] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM documents");
    expect(after[0].n).toBe(before[0].n);
  } finally { await db.end(); }
});

test("P38 protected document downloads respect audience and member ownership", async ({ browser }) => {
  const db = await database();
  const chairman = await browser.newContext();
  const bookkeeper = await browser.newContext();
  const member = await browser.newContext();
  const visitor = await browser.newContext();
  try {
    await login(chairman, "chairman"); await login(bookkeeper, "bookkeeper"); await login(member, "member");
    const [owners] = await db.query<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code='NFFAC-SEED-0001'");
    const bytes = Buffer.from("%PDF-1.4\n% synthetic access fixture\n%%EOF\n");
    for (const [access, expected] of [["PUBLIC", [200, 200, 200, 200]], ["MEMBER_ONLY", [200, 404, 200, 404]], ["ADMIN_ONLY", [200, 404, 404, 404]], ["BOOKKEEPER_ONLY", [200, 200, 404, 404]]] as const) {
      const title = `Synthetic P38 ${access} ${randomUUID()}`;
      const upload = await chairman.request.post(`${api}/api/documents`, { multipart: { title, category: "OTHER", documentType: "Other", accessLevel: access, file: { name: "fixture.pdf", mimeType: "application/pdf", buffer: bytes } } });
      expect(upload.status()).toBe(201);
      const [rows] = await db.execute<RowDataPacket[]>("SELECT document_id FROM documents WHERE title=?", [title]);
      const id = rows[0].document_id;
      if (access === "MEMBER_ONLY") await db.execute("UPDATE documents SET member_id=? WHERE document_id=?", [owners[0].member_id, id]);
      for (const [index, context] of [chairman, bookkeeper, member, visitor].entries()) {
        const response = await context.request.get(`${api}/api/documents/${id}/file?action=download`);
        expect(response.status(), `${access} actor ${index}`).toBe(expected[index]);
        if (response.status() === 200) expect(await response.body()).toEqual(bytes);
      }
    }
  } finally { await chairman.close(); await bookkeeper.close(); await member.close(); await visitor.close(); await db.end(); }
});

test("P39 announcements appear only to their intended audiences", async ({ browser }) => {
  const db = await database();
  const chairman = await browser.newContext();
  const member = await browser.newContext();
  const other = await browser.newContext();
  const visitor = await browser.newContext();
  try {
    await login(chairman, "chairman"); await login(member, "member"); await login(other, "associate");
    const [users] = await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='maria.member'");
    const tag = `P39-${randomUUID().slice(0, 8)}`;
    for (const [suffix, audience, recipients] of [["Public", "Public", []], ["Members", "All Members", []], ["Target", "Selected Users", [String(users[0].user_id)]]] as const) {
      const response = await chairman.request.post(`${api}/api/announcements`, { data: { title: `${tag}-${suffix}`, message: "Synthetic notice", audienceType: audience, recipientUserIds: recipients, announcementStatus: "Published" } });
      expect(response.status()).toBe(201);
    }
    const get = async (context: BrowserContext) => {
      const response = await context.request.get(`${api}/api/announcements?search=${tag}`);
      expect(response.status()).toBe(200);
      return JSON.stringify(await response.json());
    };
    const publicList = await get(visitor), ownList = await get(member), otherList = await get(other);
    expect(publicList).toContain(`${tag}-Public`);
    expect(publicList).not.toContain(`${tag}-Members`);
    expect(publicList).not.toContain(`${tag}-Target`);
    expect(ownList).toContain(`${tag}-Public`);
    expect(ownList).toContain(`${tag}-Members`);
    expect(ownList).toContain(`${tag}-Target`);
    expect(otherList).toContain(`${tag}-Members`);
    expect(otherList).not.toContain(`${tag}-Target`);
  } finally { await chairman.close(); await member.close(); await other.close(); await visitor.close(); await db.end(); }
});

test("P18 P42 referral associates applicant and produces a member notification", async ({ context, request }) => {
  const db = await database();
  try {
    const token = randomUUID().replaceAll("-", "").slice(0, 8);
    const firstName = `Synthetic${token}`;
    const [before] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM member_profiles WHERE approval_status='Approved'");
    const data = { firstName, lastName: "Referral", email: `referral-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1990-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", referralCode: "REF-NFFAC-SEED-0001", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Referral`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
    const submitted = await request.post(`${api}/api/membership-applications/public`, { data });
    expect(submitted.status()).toBe(201);
    const code = (await submitted.json()).data.applicationCode;
    const [rows] = await db.execute<RowDataPacket[]>("SELECT r.referral_status,mp.member_code FROM member_referrals r JOIN member_profiles mp ON mp.member_id=r.referrer_member_id JOIN membership_applications a ON a.membership_application_id=r.membership_application_id WHERE a.application_code=?", [code]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ referral_status: "Pending", member_code: "NFFAC-SEED-0001" });
    const [after] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM member_profiles WHERE approval_status='Approved'");
    expect(after[0].n).toBe(before[0].n);
    const [notices] = await db.execute<RowDataPacket[]>("SELECT n.notification_id FROM notifications n JOIN users u ON u.user_id=n.user_id WHERE u.username='maria.member' AND n.message LIKE ?", [`%${code}%`]);
    expect(notices).toHaveLength(1);
    await login(context, "member");
    const visible = await context.request.get(`${api}/api/notifications?search=${code}`);
    expect(visible.status()).toBe(200);
    expect(JSON.stringify(await visible.json())).toContain(code);
    expect((await context.request.patch(`${api}/api/notifications/${notices[0].notification_id}/read`)).status()).toBe(200);
    const [read] = await db.execute<RowDataPacket[]>("SELECT is_read FROM notifications WHERE notification_id=?", [notices[0].notification_id]);
    expect(Number(read[0].is_read)).toBe(1);
  } finally { await db.end(); }
});

test("P17 a member in two sectors contributes once to membership total", async ({ context }) => {
  const db = await database();
  try {
    await login(context, "chairman");
    const endpoint = `${api}/api/chairman/member-analytics`;
    const beforeResponse = await context.request.get(endpoint);
    expect(beforeResponse.status()).toBe(200);
    const before = (await beforeResponse.json()).data.kpis.total;
    const code = `P17-${randomUUID().slice(0, 8)}`;
    await db.execute("INSERT INTO member_profiles(member_code,full_name,barangay,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,'Synthetic multi-sector member','Lumbangan','Rice','Associate','Approved','Active','2026-01-01','2026-01-02 00:00:00')", [code]);
    const [members] = await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code=?", [code]);
    const id = members[0].member_id;
    await db.execute("INSERT INTO member_sectors(member_id,sector_id) SELECT ?,sector_id FROM cooperative_sectors WHERE sector_name IN ('Rice','Corn')", [id]);
    const [links] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM member_sectors WHERE member_id=?", [id]);
    expect(Number(links[0].n)).toBe(2);
    const afterResponse = await context.request.get(endpoint);
    expect(afterResponse.status()).toBe(200);
    expect((await afterResponse.json()).data.kpis.total).toBe(before + 1);
  } finally { await db.end(); }
});

test("P11 Chairman approves a prepared synthetic associate application", async ({ context, request }) => {
  const db = await database();
  try {
    const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Approval${token}`;
    const data = { firstName, lastName: "Fixture", email: `approval-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
    const submitted = await request.post(`${api}/api/membership-applications/public`, { data });
    expect(submitted.status()).toBe(201);
    const code = (await submitted.json()).data.applicationCode;
    const [applications] = await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?", [code]);
    const id = applications[0].membership_application_id;
    // Prepare an eligible test-only application with explicitly waived requirements.
    await db.execute("UPDATE membership_applications SET application_status='Payment Confirmed' WHERE membership_application_id=?", [id]);
    await db.execute("UPDATE membership_application_requirements SET requirement_status='Waived' WHERE membership_application_id=? AND requirement_type IN ('Signed Application','Associate Membership Fee')", [id]);
    await login(context, "chairman");
    const approved = await context.request.post(`${api}/api/membership-applications/${id}/approve`, { data: { boardMeetingDate: "2026-10-01", secretaryName: "Synthetic Secretary", decisionReason: "Synthetic approval test", createMemberPortalAccount: false } });
    expect(approved.status()).toBe(200);
    const [rows] = await db.execute<RowDataPacket[]>("SELECT a.application_status,a.converted_member_id,m.full_name,m.membership_type,m.official_member_status FROM membership_applications a JOIN member_profiles m ON m.member_id=a.converted_member_id WHERE a.membership_application_id=?", [id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ application_status: "Approved", full_name: `${firstName} Fixture`, membership_type: "Associate", official_member_status: "Active" });
  } finally { await db.end(); }
});

test("P27 Bookkeeper edits a category while Chairman cannot edit it", async ({ browser }) => {
  const db = await database();
  const bookkeeper = await browser.newContext();
  const chairman = await browser.newContext();
  try {
    await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
    const code = `P27_${randomUUID().slice(0, 8).toUpperCase()}`;
    const initialName = `Synthetic category ${code}`;
    const updatedName = `Synthetic updated ${code}`;
    const created = await bookkeeper.request.post(`${api}/api/financial-categories`, { data: { categoryCode: code, categoryName: initialName, categoryType: "Expense", isActive: true } });
    expect(created.status()).toBe(201);
    const [rows] = await db.execute<RowDataPacket[]>("SELECT financial_category_id FROM financial_categories WHERE category_code=?", [code]);
    const id = rows[0].financial_category_id;
    expect((await chairman.request.patch(`${api}/api/financial-categories/${id}`, { data: { categoryName: "Forbidden" } })).status()).toBe(403);
    expect((await bookkeeper.request.patch(`${api}/api/financial-categories/${id}`, { data: { categoryName: updatedName } })).status()).toBe(200);
    const [after] = await db.execute<RowDataPacket[]>("SELECT category_name,category_type FROM financial_categories WHERE financial_category_id=?", [id]);
    expect(after[0]).toMatchObject({ category_name: updatedName, category_type: "Expense" });
  } finally { await bookkeeper.close(); await chairman.close(); await db.end(); }
});
