# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-operations.spec.ts >> P33 P34 P35 synthetic cash order preserves prices, payment, pickup and one POS posting
- Location: tests\e2e\evidence-operations.spec.ts:19:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1   | import { expect, test, type BrowserContext } from "@playwright/test";
  2   | import mysql, { type RowDataPacket } from "mysql2/promise";
  3   | import { randomUUID } from "node:crypto";
  4   | import { hash } from "bcryptjs";
  5   | const api = "http://127.0.0.1:3218";
  6   | async function database() {
  7   |   const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  8   |   const [rows] = await db.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  9   |   const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  10  |   if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) { await db.end(); throw new Error("Refusing unverified database"); }
  11  |   return db;
  12  | }
  13  | async function login(context: BrowserContext, role: "member" | "bookkeeper" | "chairman") {
  14  |   const credentials = { member: ["maria.member@trackcoop.local", "MemberTest123!"], bookkeeper: ["bookkeeper.test@trackcoop.local", "BookkeeperTest123!"], chairman: ["chairman.test@trackcoop.local", "ChairmanTest123!"] }[role];
> 15  |   expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: credentials[0], password: credentials[1] } })).status()).toBe(200);
      |                                                                                                                                              ^ Error: expect(received).toBe(expected) // Object.is equality
  16  | }
  17  | test.beforeAll(async () => { const db = await database(); await db.end(); });
  18  | 
  19  | test("P33 P34 P35 synthetic cash order preserves prices, payment, pickup and one POS posting", async ({ browser }) => {
  20  |   const db = await database(), member = await browser.newContext(), bookkeeper = await browser.newContext(), chairman = await browser.newContext();
  21  |   try {
  22  |     await login(member, "member"); await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
  23  |     const [staff] = await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='bookkeeper.test'");
  24  |     const sku = `E2E-${randomUUID().slice(0, 8)}`;
  25  |     await db.execute("INSERT INTO products(sku,product_name,category,unit,selling_price,product_status,created_by) VALUES(?,'Synthetic Seed','Synthetic','piece',75.50,'Active',?)", [sku,staff[0].user_id]);
  26  |     const [products] = await db.execute<RowDataPacket[]>("SELECT product_id FROM products WHERE sku=?", [sku]);
  27  |     const productId = Number(products[0].product_id);
  28  |     await db.execute("INSERT INTO inventory_movements(product_id,movement_type,quantity_change,recorded_by) VALUES(?,'Opening Stock',20,?)", [productId,staff[0].user_id]);
  29  |     const order = await member.request.post(`${api}/api/pos/checkout`, { data: { items: [{ id: productId, quantity: 3 }], paymentName: "Synthetic Customer", paymentEmail: "customer@example.invalid", paymentContact: "09171112222", paymentMethod: "Cash" } });
  30  |     expect(order.status()).toBe(200);
  31  |     const created = await order.json(); expect(Number(created.totalAmount)).toBe(226.5);
  32  |     const saleId = String(created.saleId), referenceId = String(created.paymentReferenceId);
  33  |     const [items] = await db.execute<RowDataPacket[]>("SELECT quantity,unit_price,line_total FROM pos_sale_items WHERE pos_sale_id=?", [saleId]);
  34  |     expect(items).toHaveLength(1); expect(Number(items[0].quantity)).toBe(3); expect(Number(items[0].unit_price)).toBe(75.5); expect(Number(items[0].line_total)).toBe(226.5);
  35  |     const [pending] = await db.execute<RowDataPacket[]>("SELECT sale_status,payment_status FROM pos_sales WHERE pos_sale_id=?", [saleId]);
  36  |     expect(pending[0]).toMatchObject({ sale_status: "Pending Payment", payment_status: "Unpaid" });
  37  |     expect((await chairman.request.put(`${api}/api/pos/orders/${saleId}/complete`, { data: {} })).status()).toBe(400);
  38  |     expect((await bookkeeper.request.put(`${api}/api/pos/orders/${saleId}/confirm`, { data: {} })).status()).toBe(200);
  39  |     expect((await bookkeeper.request.put(`${api}/api/pos/orders/${saleId}/confirm`, { data: {} })).status()).toBe(400);
  40  |     const [paid] = await db.execute<RowDataPacket[]>("SELECT sale_status,payment_status,total_amount FROM pos_sales WHERE pos_sale_id=?", [saleId]);
  41  |     expect(paid[0]).toMatchObject({ sale_status: "Paid", payment_status: "Paid" }); expect(Number(paid[0].total_amount)).toBe(226.5);
  42  |     const [financial] = await db.execute<RowDataPacket[]>("SELECT amount,record_type,source_module FROM financial_records WHERE payment_reference_id=?", [referenceId]);
  43  |     expect(financial).toHaveLength(1); expect(financial[0]).toMatchObject({ record_type: "Income", source_module: "POS" }); expect(Number(financial[0].amount)).toBe(226.5);
  44  |     const [stock] = await db.execute<RowDataPacket[]>("SELECT SUM(quantity_change) AS n FROM inventory_movements WHERE product_id=?", [productId]); expect(Number(stock[0].n)).toBe(17);
  45  |     expect((await chairman.request.put(`${api}/api/pos/orders/${saleId}/complete`, { data: { note: "Synthetic pickup" } })).status()).toBe(200);
  46  |     const [completed] = await db.execute<RowDataPacket[]>("SELECT sale_status,fulfilled_at FROM pos_sales WHERE pos_sale_id=?", [saleId]);
  47  |     expect(completed[0].sale_status).toBe("Completed"); expect(completed[0].fulfilled_at).toBeTruthy();
  48  |   } finally { await member.close(); await bookkeeper.close(); await chairman.close(); await db.end(); }
  49  | });
  50  | 
  51  | test("P31 P32 P35 rental inquiry, review, payment and schedule persist once", async ({ browser }) => {
  52  |   const db = await database(), visitor = await browser.newContext(), bookkeeper = await browser.newContext(), chairman = await browser.newContext();
  53  |   try {
  54  |     await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
  55  |     const code = `E2E-RNT-${randomUUID().slice(0, 8).toUpperCase()}`;
  56  |     await db.execute("INSERT INTO rental_assets(asset_code,asset_name,asset_type,category,description,rate_amount,rate_unit,deposit_amount,asset_status,public_visibility,created_by) SELECT ?,'Synthetic Rental Pump',asset_type,category,description,1000,'Per Day',0,'Available',1,created_by FROM rental_assets WHERE asset_code='RNT-PUMP-001'", [code]);
  57  |     const draft = { clientRequestId: randomUUID(), fullName: "Synthetic Visitor", requesterType: "Public or Non-member", contactNumber: "09171112222", email: "rental@example.invalid", completeAddress: "Synthetic address Nasugbu", barangay: "Lumbangan", municipality: "Nasugbu", serviceId: code, intendedUse: "Synthetic farm work", preferredDate: "2031-06-03", preferredEndDate: "2031-06-03", preferredStartTime: "08:00", preferredEndTime: "12:00", requestDescription: "Synthetic farm work request", notes: "", validIdType: "Passport", attachmentName: "", membershipProofName: "", dataPrivacyConsent: true, accuracyConfirmation: true, contactConsent: true, preferredPaymentMethod: "Cash" };
  58  |     const submission = () => visitor.request.post(`${api}/api/rental/inquiries/public`, { multipart: { draft: JSON.stringify(draft), validId: { name: "synthetic-id.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% synthetic id\n%%EOF\n") } } });
  59  |     const first = await submission(); expect(first.status(), await first.text()).toBe(201); const inquiry = await first.json();
  60  |     const repeat = await submission(); expect(repeat.status()).toBe(201); expect((await repeat.json()).rentalId).toBe(inquiry.rentalId);
  61  |     const rentalId = String(inquiry.rentalId);
  62  |     expect(inquiry.status).toBe("Under Review"); expect(inquiry.preferredDate).toBe(draft.preferredDate);
  63  |     const [bookings] = await db.execute<RowDataPacket[]>("SELECT rb.rental_booking_id,rb.booking_status,rb.total_amount FROM rental_bookings rb JOIN rental_assets a ON a.rental_asset_id=rb.rental_asset_id WHERE a.asset_code=?", [code]);
  64  |     expect(bookings).toHaveLength(1); expect(bookings[0].booking_status).toBe("Pending");
  65  |     for (const decision of ["Approved for Scheduling"]) {
  66  |       const review = await chairman.request.post(`${api}/api/rental/inquiries/${rentalId}/review`, { data: { decision, publicNote: "Synthetic review decision for testing." } });
  67  |       expect(review.status()).toBe(200);
  68  |     }
  69  |     const [approved] = await db.execute<RowDataPacket[]>("SELECT booking_status,total_amount FROM rental_bookings WHERE rental_booking_id=?", [bookings[0].rental_booking_id]);
  70  |     expect(approved[0].booking_status).toBe("Approved"); expect(Number(approved[0].total_amount)).toBe(1000);
  71  |     const payment = await bookkeeper.request.post(`${api}/api/rental/payments`, { data: { rentalId, requesterName: draft.fullName, equipmentName: "Synthetic Rental Pump", scheduleDate: draft.preferredDate, amount: 1000, paymentDate: "2026-11-08", paymentMethod: "Cash", status: "Paid", recordedBy: "Test Bookkeeper" } });
  72  |     expect(payment.status()).toBe(201);
  73  |     const paymentId = String((await payment.json()).paymentId);
  74  |     for (let replay = 0; replay < 2; replay++) {
  75  |       const result = await bookkeeper.request.post(`${api}/api/rental/payments/${paymentId}/validate`, { data: { status: "Paid", note: "Synthetic duplicate validation" } });
  76  |       expect(result.status()).toBe(200);
  77  |     }
  78  |     const [finance] = await db.execute<RowDataPacket[]>("SELECT amount,source_module,record_type FROM financial_records WHERE source_module='Rental' AND source_record_id=? AND record_type='Income'", [bookings[0].rental_booking_id]);
  79  |     expect(finance).toHaveLength(1); expect(Number(finance[0].amount)).toBe(1000);
  80  |     const schedule = await chairman.request.post(`${api}/api/rental/schedules`, { data: { rentalId, inquiryId: rentalId, serviceId: code, equipmentName: "Synthetic Rental Pump", requesterName: draft.fullName, requesterType: draft.requesterType, date: draft.preferredDate, endDate: draft.preferredEndDate, startTime: draft.preferredStartTime, endTime: draft.preferredEndTime, assignedOperator: `Synthetic Operator ${code}`, serviceLocation: draft.completeAddress, barangay: draft.barangay, preparationMinutes: 0, travelMinutes: 0, bufferMinutes: 0, status: "Confirmed", paymentStatus: "Paid" } });
  81  |     expect(schedule.status(), await schedule.text()).toBe(201);
  82  |     const [after] = await db.execute<RowDataPacket[]>("SELECT booking_status,payment_status FROM rental_bookings WHERE rental_booking_id=?", [bookings[0].rental_booking_id]);
  83  |     expect(after[0]).toMatchObject({ booking_status: "Scheduled", payment_status: "Paid" });
  84  |     const [stillOne] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM financial_records WHERE source_module='Rental' AND source_record_id=? AND record_type='Income'", [bookings[0].rental_booking_id]);
  85  |     expect(Number(stillOne[0].n)).toBe(1);
  86  |   } finally { await visitor.close(); await bookkeeper.close(); await chairman.close(); await db.end(); }
  87  | });
  88  | 
  89  | test("P30 restricted allocation and payout operations reject unauthorized roles", async ({ browser }) => {
  90  |   const db = await database(), member = await browser.newContext(), bookkeeper = await browser.newContext(), chairman = await browser.newContext();
  91  |   try {
  92  |     await login(member, "member"); await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
  93  |     const [before] = await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records) AS records, (SELECT COUNT(*) FROM patronage_allocations) AS allocations");
  94  |     expect((await member.request.post(`${api}/api/dividends/declarations`, { data: {} })).status()).toBe(403);
  95  |     expect((await bookkeeper.request.post(`${api}/api/dividends/declarations/1/approve`, { data: {} })).status()).toBe(403);
  96  |     expect((await chairman.request.post(`${api}/api/dividends/withdrawals/1/complete`, { data: {} })).status()).toBe(403);
  97  |     expect((await member.request.post(`${api}/api/patronage/periods/1/finalize`, { data: {} })).status()).toBe(403);
  98  |     const [after] = await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records) AS records, (SELECT COUNT(*) FROM patronage_allocations) AS allocations");
  99  |     expect(after[0]).toEqual(before[0]);
  100 |   } finally { await member.close(); await bookkeeper.close(); await chairman.close(); await db.end(); }
  101 | });
  102 | 
  103 | test("P30 synthetic dividend withdrawal and patronage-capital transfer enforce roles and post once", async ({ browser }) => {
  104 |   const db=await database(), member=await browser.newContext(), bookkeeper=await browser.newContext(), chairman=await browser.newContext(), other=await browser.newContext();
  105 |   try {
  106 |     await login(bookkeeper,"bookkeeper"); await login(chairman,"chairman"); await login(other,"member");
  107 |     const token=randomUUID().replaceAll("-","").slice(0,8), username=`benefit-${token}`, email=`${username}@example.invalid`, password="SyntheticBenefit123!";
  108 |     const [roles]=await db.query<RowDataPacket[]>("SELECT role_id FROM roles WHERE role_slug='member'");
  109 |     const [staff]=await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='chairman.test'");
  110 |     await db.execute("INSERT INTO users(role_id,username,email,password_hash,display_name,account_status) VALUES(?,?,?,?,?,'Active')",[roles[0].role_id,username,email,await hash(password,10),"Synthetic Benefit Member"]);
  111 |     const [users]=await db.execute<RowDataPacket[]>("SELECT user_id FROM users WHERE username=?",[username]); const userId=String(users[0].user_id);
  112 |     await db.execute("INSERT INTO member_profiles(user_id,member_code,full_name,sector,membership_type,approval_status,official_member_status,application_date,approved_at,true_member_since) VALUES(?,?,'Synthetic Benefit Member','Rice','True Member','Approved','Active','2000-01-01','2000-01-02','2000-01-02')",[userId,`BEN-${token}`]);
  113 |     const [members]=await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE user_id=?",[userId]);const memberId=String(members[0].member_id);
  114 |     await db.execute("INSERT INTO share_capital_accounts(member_id,current_balance) VALUES(?,0)",[memberId]);
  115 |     expect((await member.request.post(`${api}/api/auth/login`,{data:{identifier:email,password}})).status()).toBe(200);
```