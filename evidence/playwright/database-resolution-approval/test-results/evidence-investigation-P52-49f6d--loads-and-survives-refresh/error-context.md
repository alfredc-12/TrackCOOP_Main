# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-investigation.spec.ts >> P52 canonical member share capital route loads and survives refresh
- Location: tests\e2e\evidence-investigation.spec.ts:60:5

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'Full history' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "TrackCOOP logo TrackCOOP True Member" [ref=e6] [cursor=pointer]:
          - /url: "#"
          - img "TrackCOOP logo" [ref=e8]
          - generic [ref=e9]:
            - generic [ref=e10]: TrackCOOP
            - generic [ref=e11]: True Member
        - navigation "Member navigation" [ref=e12]:
          - button "Dashboard" [ref=e13]
          - button "Member & Share" [ref=e14]
          - button "Financial" [ref=e15]
          - button "Equipment Rental" [ref=e16]
          - button "Coop Store" [ref=e17]
        - generic [ref=e19]:
          - button "Profile & Settings" [ref=e20]:
            - img [ref=e21]
          - button "Announcements" [ref=e24]:
            - img [ref=e25]
          - button "My Requests" [ref=e28]:
            - img [ref=e29]
          - button "Refer a Friend" [ref=e32]:
            - img [ref=e33]
            - text: Refer a Friend
          - button "Logout" [ref=e36]:
            - text: Logout
            - img [ref=e37]
    - main [ref=e40]:
      - generic [ref=e42]:
        - region "Welcome back, Maria" [ref=e43]:
          - generic [ref=e44]:
            - generic [ref=e45]:
              - paragraph [ref=e46]: My cooperative
              - heading "Welcome back, Maria" [level=1] [ref=e47]
              - generic [ref=e49]: True Member
              - paragraph [ref=e50]: Your activities and cooperative updates in one place.
              - generic "My occupations and livelihoods" [ref=e51]:
                - generic [ref=e52]: Rice Farmer
                - button "Season Guide" [ref=e53]:
                  - generic [ref=e54]: 🌱
                  - text: Season Guide
                  - img [ref=e55]
            - generic [ref=e57]:
              - generic [ref=e58]:
                - paragraph [ref=e59]: My Share Capital
                - img [ref=e60]
              - paragraph [ref=e63]: ₱1,500.00
              - button "View My Savings" [ref=e64]:
                - text: View My Savings
                - img [ref=e65]
        - generic [ref=e67]:
          - generic [ref=e69]:
            - heading "Personal share capital" [level=3] [ref=e70]
            - paragraph [ref=e71]: ₱1,500.00
            - group [ref=e72]:
              - generic "Recorded policy" [ref=e73] [cursor=pointer]
              - text: Your existing obligations and classification are preserved. Contact the cooperative for review of legacy inconsistencies.
          - generic [ref=e74]:
            - button "Contribute share capital" [ref=e75]:
              - img [ref=e76]
              - text: Contribute share capital
            - button "Refresh" [ref=e79]:
              - img [ref=e80]
              - text: Refresh
          - group [ref=e85]:
            - generic "Agricultural sectors" [ref=e86] [cursor=pointer]
          - group [ref=e87]:
            - generic "Personal payment history" [ref=e88] [cursor=pointer]
        - region "My activity summary" [ref=e89]:
          - button "0 Capital Deposits Recorded additions" [ref=e90]:
            - generic [ref=e91]:
              - paragraph [ref=e92]: "0"
              - heading "Capital Deposits" [level=2] [ref=e93]
              - paragraph [ref=e94]: Recorded additions
            - img [ref=e96]
          - button "7 Store Purchases Purchase records" [ref=e99]:
            - generic [ref=e100]:
              - paragraph [ref=e101]: "7"
              - heading "Store Purchases" [level=2] [ref=e102]
              - paragraph [ref=e103]: Purchase records
            - img [ref=e105]
          - button "1 Rental Bookings All bookings" [ref=e108]:
            - generic [ref=e109]:
              - paragraph [ref=e110]: "1"
              - heading "Rental Bookings" [level=2] [ref=e111]
              - paragraph [ref=e112]: All bookings
            - img [ref=e114]
          - button "15 Announcements Cooperative updates" [ref=e120]:
            - generic [ref=e121]:
              - paragraph [ref=e122]: "15"
              - heading "Announcements" [level=2] [ref=e123]
              - paragraph [ref=e124]: Cooperative updates
            - img [ref=e126]
        - generic [ref=e129]:
          - generic [ref=e130]:
            - generic [ref=e131]:
              - heading "Recent Activity" [level=2] [ref=e132]
              - generic [ref=e133]: Latest 5 records
            - region "Recent activity records" [ref=e134]:
              - table [ref=e135]:
                - rowgroup [ref=e136]:
                  - row "Transaction Date Amount Status" [ref=e137]:
                    - columnheader "Transaction" [ref=e138]
                    - columnheader "Date" [ref=e139]
                    - columnheader "Amount" [ref=e140]
                    - columnheader "Status" [ref=e141]
                - rowgroup [ref=e142]:
                  - row "Coop Store Purchase Nov 08, 2026 - ₱226.50 Paid" [ref=e143]:
                    - cell "Coop Store Purchase" [ref=e144]:
                      - generic [ref=e145]:
                        - img [ref=e147]
                        - generic [ref=e151]: Coop Store Purchase
                    - cell "Nov 08, 2026" [ref=e152]
                    - cell "- ₱226.50" [ref=e153]
                    - cell "Paid" [ref=e154]:
                      - generic [ref=e155]:
                        - img [ref=e156]
                        - text: Paid
                  - 'row "Announcement: P39-be37f660-Public Nov 08, 2026 — — Not Acknowledged" [ref=e159]':
                    - 'cell "Announcement: P39-be37f660-Public" [ref=e160]':
                      - generic [ref=e161]:
                        - img [ref=e163]
                        - generic [ref=e167]: "Announcement: P39-be37f660-Public"
                    - cell "Nov 08, 2026" [ref=e168]
                    - cell "— —" [ref=e169]
                    - cell "Not Acknowledged" [ref=e170]:
                      - generic [ref=e171]:
                        - img [ref=e172]
                        - text: Not Acknowledged
                  - 'row "Announcement: P39-be37f660-Members Nov 08, 2026 — — Not Acknowledged" [ref=e175]':
                    - 'cell "Announcement: P39-be37f660-Members" [ref=e176]':
                      - generic [ref=e177]:
                        - img [ref=e179]
                        - generic [ref=e183]: "Announcement: P39-be37f660-Members"
                    - cell "Nov 08, 2026" [ref=e184]
                    - cell "— —" [ref=e185]
                    - cell "Not Acknowledged" [ref=e186]:
                      - generic [ref=e187]:
                        - img [ref=e188]
                        - text: Not Acknowledged
                  - 'row "Announcement: P39-be37f660-Target Nov 08, 2026 — — Not Acknowledged" [ref=e191]':
                    - 'cell "Announcement: P39-be37f660-Target" [ref=e192]':
                      - generic [ref=e193]:
                        - img [ref=e195]
                        - generic [ref=e199]: "Announcement: P39-be37f660-Target"
                    - cell "Nov 08, 2026" [ref=e200]
                    - cell "— —" [ref=e201]
                    - cell "Not Acknowledged" [ref=e202]:
                      - generic [ref=e203]:
                        - img [ref=e204]
                        - text: Not Acknowledged
                  - row "Coop Store Purchase Nov 08, 2026 - ₱226.50 Paid" [ref=e207]:
                    - cell "Coop Store Purchase" [ref=e208]:
                      - generic [ref=e209]:
                        - img [ref=e211]
                        - generic [ref=e215]: Coop Store Purchase
                    - cell "Nov 08, 2026" [ref=e216]
                    - cell "- ₱226.50" [ref=e217]
                    - cell "Paid" [ref=e218]:
                      - generic [ref=e219]:
                        - img [ref=e220]
                        - text: Paid
          - region "Quick Actions" [ref=e223]:
            - heading "Quick Actions" [level=2] [ref=e224]
            - generic [ref=e225]:
              - button "View My Savings Share Capital and earnings" [ref=e226]:
                - img [ref=e228]
                - generic [ref=e231]:
                  - generic [ref=e232]: View My Savings
                  - generic [ref=e233]: Share Capital and earnings
                - img [ref=e234]
              - button "Rent Equipment Find equipment for your farm" [ref=e236]:
                - img [ref=e238]
                - generic [ref=e244]:
                  - generic [ref=e245]: Rent Equipment
                  - generic [ref=e246]: Find equipment for your farm
                - img [ref=e247]
              - button "Visit Coop Store Browse farm supplies" [ref=e249]:
                - img [ref=e251]
                - generic [ref=e254]:
                  - generic [ref=e255]: Visit Coop Store
                  - generic [ref=e256]: Browse farm supplies
                - img [ref=e257]
              - button "My Requests Ask for help and check replies" [ref=e259]:
                - img [ref=e261]
                - generic [ref=e264]:
                  - generic [ref=e265]: My Requests
                  - generic [ref=e266]: Ask for help and check replies
                - img [ref=e267]
              - button "Refer a Friend Invite someone to join" [ref=e269]:
                - img [ref=e271]
                - generic [ref=e274]:
                  - generic [ref=e275]: Refer a Friend
                  - generic [ref=e276]: Invite someone to join
                - img [ref=e277]
        - generic [ref=e279]:
          - paragraph [ref=e280]: Need help with your account? Send a request to the cooperative.
          - button "Get Help" [ref=e281]:
            - text: Get Help
            - img [ref=e282]
    - contentinfo [ref=e285]:
      - generic [ref=e286]:
        - generic [ref=e287]:
          - paragraph [ref=e288]: NASUGBU FARMERS AND FISHERFOLKS AGRICULTURE COOPERATIVE
          - paragraph [ref=e289]: Agriculture and fisherfolk cooperative landing portal.
        - paragraph [ref=e290]: Copyright 2026. All rights reserved.
  - button "Add Share Capital" [ref=e291]:
    - img [ref=e292]
    - text: Add Share Capital
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e300] [cursor=pointer]:
    - img [ref=e301]
  - alert [ref=e304]
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
  27 |     expect(response.status()).toBe(201);
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
  44 |     expect(values.map(v => scoreMinimum(v, configured.thresholds.contributionAmount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
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
  60 | test("P52 canonical member share capital route loads and survives refresh", async ({ browser, context, page }) => {
  61 |   const login = await context.request.post(`${api}/api/auth/login`, { data: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" } });
  62 |   expect(login.status()).toBe(200);
  63 |   const canonical = await page.goto("/portal/member/share-capital");
  64 |   expect(canonical?.status()).toBe(200);
  65 |   await expect(page.getByRole("heading", { name: "My Share Capital" })).toBeVisible();
  66 |   await page.reload();
  67 |   await expect(page.getByRole("heading", { name: "My Share Capital" })).toBeVisible();
  68 |   await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? "database-run"}/screenshots/P52-share-capital.png`, fullPage: true });
  69 |   await page.goto("/portal/member/dashboard");
> 70 |   await page.getByRole("link", { name: "Full history" }).click();
     |                                                          ^ Error: locator.click: Test timeout of 45000ms exceeded.
  71 |   await expect(page).toHaveURL(/\/portal\/member\/share-capital/);
  72 |   await expect(page.getByRole("heading", { name: "My Share Capital" })).toBeVisible();
  73 |   await page.setViewportSize({width:390,height:844});
  74 |   await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  75 |   const anonymous=await browser.newContext();
  76 |   try {
  77 |     const visitor=await anonymous.newPage(); await visitor.goto("/portal/member/share-capital");
  78 |     await expect(visitor).toHaveURL(/\/login/);
  79 |     await expect(visitor.getByRole("heading", { name: "My Share Capital" })).toHaveCount(0);
  80 |   } finally { await anonymous.close(); }
  81 | });
  82 | 
```