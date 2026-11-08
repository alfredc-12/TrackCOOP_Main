# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-payments.spec.ts >> P14 membership fee and initial capital accept only the required amounts
- Location: tests\e2e\evidence-payments.spec.ts:85:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1   | import { expect, test, type BrowserContext } from "@playwright/test";
  2   | import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
  3   | import { randomUUID } from "node:crypto";
  4   | 
  5   | const api = "http://127.0.0.1:3218";
  6   | async function database() {
  7   |   const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  8   |   const [rows] = await db.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  9   |   const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  10  |   if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) { await db.end(); throw new Error("Refusing unverified database"); }
  11  |   return db;
  12  | }
  13  | async function login(context: BrowserContext) {
> 14  |   expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: "bookkeeper.test@trackcoop.local", password: "BookkeeperTest123!" } })).status()).toBe(200);
      |                                                                                                                                                                       ^ Error: expect(received).toBe(expected) // Object.is equality
  15  | }
  16  | async function member(db: Connection) {
  17  |   const code = `PAY-${randomUUID().slice(0, 8)}`;
  18  |   await db.execute("INSERT INTO member_profiles(member_code,full_name,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,'Synthetic Payment Member','Rice','Associate','Approved','Active','2026-01-01','2026-01-02 00:00:00')", [code]);
  19  |   const [rows] = await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code=?", [code]);
  20  |   return String(rows[0].member_id);
  21  | }
  22  | async function createReference(context: BrowserContext, memberId: string, amount: number, proofFilePath?: string) {
  23  |   const ref = `SYN-${randomUUID()}`;
  24  |   const response = await context.request.post(`${api}/api/payment-references`, { data: { memberId, payerName: "Synthetic Member", provider: "Synthetic Cash", paymentChannel: "Cash", referenceNumber: ref, paymentPurpose: "Share Capital", relatedEntityType: "member_profile", relatedEntityId: memberId, amount, ...(proofFilePath ? { proofFilePath } : {}) } });
  25  |   expect(response.status()).toBe(201);
  26  |   return String((await response.json()).data.id);
  27  | }
  28  | async function counts(db: Connection, id: string) {
  29  |   const [rows] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM share_capital_payments WHERE payment_reference_id=?) AS capital, (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial, (SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts", [id,id,id]);
  30  |   return { capital: Number(rows[0].capital), financial: Number(rows[0].financial), receipts: Number(rows[0].receipts) };
  31  | }
  32  | test.beforeAll(async () => { const db = await database(); await db.end(); });
  33  | 
  34  | test("P21 P22 manual proof review and duplicate validation do not duplicate postings", async ({ context }) => {
  35  |   const db = await database();
  36  |   try {
  37  |     await login(context); const memberId = await member(db);
  38  |     const title = `Proof ${randomUUID()}`, bytes = Buffer.from("%PDF-1.4\n% synthetic proof\n%%EOF\n");
  39  |     const upload = await context.request.post(`${api}/api/documents`, { multipart: { title, category: "FINANCIAL", documentType: "Financial Document", accessLevel: "BOOKKEEPER_ONLY", file: { name: "proof.pdf", mimeType: "application/pdf", buffer: bytes } } });
  40  |     expect(upload.status()).toBe(201);
  41  |     const [docs] = await db.execute<RowDataPacket[]>("SELECT file_path FROM documents WHERE title=?", [title]);
  42  |     const id = await createReference(context, memberId, 100, String(docs[0].file_path));
  43  |     const proof = await context.request.get(`${api}/api/payment-references/${id}/proof`);
  44  |     expect(proof.status()).toBe(200); expect(await proof.body()).toEqual(bytes);
  45  |     expect(await counts(db, id)).toEqual({ capital: 0, financial: 0, receipts: 0 });
  46  |     const result = await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} });
  47  |     expect(result.status()).toBe(200);
  48  |     const [rows] = await db.execute<RowDataPacket[]>("SELECT validation_status,validation_source,amount FROM payment_references WHERE payment_reference_id=?", [id]);
  49  |     expect(rows[0]).toMatchObject({ validation_status: "Validated", validation_source: "Manual Bookkeeper" }); expect(Number(rows[0].amount)).toBe(100);
  50  |     expect(await counts(db, id)).toEqual({ capital: 1, financial: 1, receipts: 1 });
  51  |     expect((await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} })).status()).toBe(400);
  52  |     expect(await counts(db, id)).toEqual({ capital: 1, financial: 1, receipts: 1 });
  53  |   } finally { await db.end(); }
  54  | });
  55  | 
  56  | test("P23 pending and rejected payments do not create financial receipts", async ({ context }) => {
  57  |   const db = await database();
  58  |   try {
  59  |     await login(context); const memberId = await member(db); const id = await createReference(context, memberId, 123);
  60  |     expect(await counts(db, id)).toEqual({ capital: 0, financial: 0, receipts: 0 });
  61  |     expect((await context.request.post(`${api}/api/payment-references/${id}/reject`, { data: { reason: "Synthetic proof rejected" } })).status()).toBe(200);
  62  |     expect((await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} })).status()).toBe(409);
  63  |     const [rows] = await db.execute<RowDataPacket[]>("SELECT validation_status FROM payment_references WHERE payment_reference_id=?", [id]);
  64  |     expect(rows[0].validation_status).toBe("Rejected"); expect(await counts(db, id)).toEqual({ capital: 0, financial: 0, receipts: 0 });
  65  |   } finally { await db.end(); }
  66  | });
  67  | 
  68  | test("P15 share capital accepts maximum and rejects a cent above without posting", async ({ context }) => {
  69  |   const db = await database();
  70  |   try {
  71  |     await login(context); const memberId = await member(db);
  72  |     for (const amount of [14999.99, 0.01]) {
  73  |       const id = await createReference(context, memberId, amount);
  74  |       expect((await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} })).status()).toBe(200);
  75  |       expect(await counts(db, id)).toEqual({ capital: 1, financial: 1, receipts: 1 });
  76  |     }
  77  |     const over = await createReference(context, memberId, 0.01);
  78  |     expect((await context.request.post(`${api}/api/payment-references/${over}/validate`, { data: {} })).status()).toBe(409);
  79  |     expect(await counts(db, over)).toEqual({ capital: 0, financial: 0, receipts: 0 });
  80  |     const [rows] = await db.execute<RowDataPacket[]>("SELECT SUM(amount) AS total FROM share_capital_payments WHERE member_id=? AND payment_status='Validated'", [memberId]);
  81  |     expect(Number(rows[0].total)).toBe(15000);
  82  |   } finally { await db.end(); }
  83  | });
  84  | 
  85  | test("P14 membership fee and initial capital accept only the required amounts", async ({ context, request }) => {
  86  |   const db = await database();
  87  |   try {
  88  |     await login(context);
  89  |     for (const [requestedMembershipType, purpose, amount] of [["Associate", "Associate Membership Fee", 200], ["True Member", "Share Capital", 1500]] as const) {
  90  |       const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Payment${token}`;
  91  |       const applicant = { requestedMembershipType, firstName, lastName: "Fixture", email: `payment-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  92  |       const submission = await request.post(`${api}/api/membership-applications/public`, { data: applicant });
  93  |       expect(submission.status()).toBe(201);
  94  |       const code = (await submission.json()).data.applicationCode;
  95  |       const [apps] = await db.execute<RowDataPacket[]>("SELECT membership_application_id,membership_fee_amount,initial_share_capital_amount,target_share_capital_amount FROM membership_applications WHERE application_code=?", [code]);
  96  |       expect(Number(apps[0].membership_fee_amount)).toBe(200); expect(Number(apps[0].initial_share_capital_amount)).toBe(1500); expect(Number(apps[0].target_share_capital_amount)).toBe(3000);
  97  |       const applicationId = String(apps[0].membership_application_id);
  98  |       const make = (value: number, paymentPurpose: string = purpose) => context.request.post(`${api}/api/payment-references`, { data: { payerName: "Synthetic Applicant", provider: "Synthetic Cash", paymentChannel: "Cash", referenceNumber: `SYN-${randomUUID()}`, paymentPurpose, relatedEntityType: "membership_application", relatedEntityId: applicationId, amount: value } });
  99  |       expect((await make(amount - 0.01)).status()).toBe(422);
  100 |       expect((await make(amount + 0.01)).status()).toBe(422);
  101 |       const exact = await make(amount);
  102 |       expect(exact.status()).toBe(201);
  103 |       if (requestedMembershipType === "True Member") {
  104 |         // The persisted policy includes a separate fee, and settlement requires it.
  105 |         expect((await make(200, "Associate Membership Fee")).status()).toBe(201);
  106 |       }
  107 |     }
  108 |   } finally { await db.end(); }
  109 | });
  110 | 
```