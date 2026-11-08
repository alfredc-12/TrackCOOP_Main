# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-operations.spec.ts >> P31 P32 P35 rental inquiry, review, payment and schedule persist once
- Location: tests\e2e\evidence-operations.spec.ts:50:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1  | import { expect, test, type BrowserContext } from "@playwright/test";
  2  | import mysql, { type RowDataPacket } from "mysql2/promise";
  3  | import { randomUUID } from "node:crypto";
  4  | const api = "http://127.0.0.1:3218";
  5  | async function database() {
  6  |   const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  7  |   const [rows] = await db.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  8  |   const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  9  |   if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) { await db.end(); throw new Error("Refusing unverified database"); }
  10 |   return db;
  11 | }
  12 | async function login(context: BrowserContext, role: "member" | "bookkeeper" | "chairman") {
  13 |   const credentials = { member: ["maria.member@trackcoop.local", "MemberTest123!"], bookkeeper: ["bookkeeper.test@trackcoop.local", "BookkeeperTest123!"], chairman: ["chairman.test@trackcoop.local", "ChairmanTest123!"] }[role];
> 14 |   expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: credentials[0], password: credentials[1] } })).status()).toBe(200);
     |                                                                                                                                              ^ Error: expect(received).toBe(expected) // Object.is equality
  15 | }
  16 | test.beforeAll(async () => { const db = await database(); await db.end(); });
  17 | 
  18 | test("P33 P34 P35 synthetic cash order preserves prices, payment, pickup and one POS posting", async ({ browser }) => {
  19 |   const db = await database(), member = await browser.newContext(), bookkeeper = await browser.newContext(), chairman = await browser.newContext();
  20 |   try {
  21 |     await login(member, "member"); await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
  22 |     const [staff] = await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='bookkeeper.test'");
  23 |     const sku = `E2E-${randomUUID().slice(0, 8)}`;
  24 |     await db.execute("INSERT INTO products(sku,product_name,category,unit,selling_price,product_status,created_by) VALUES(?,'Synthetic Seed','Synthetic','piece',75.50,'Active',?)", [sku,staff[0].user_id]);
  25 |     const [products] = await db.execute<RowDataPacket[]>("SELECT product_id FROM products WHERE sku=?", [sku]);
  26 |     const productId = Number(products[0].product_id);
  27 |     await db.execute("INSERT INTO inventory_movements(product_id,movement_type,quantity_change,recorded_by) VALUES(?,'Opening Stock',20,?)", [productId,staff[0].user_id]);
  28 |     const order = await member.request.post(`${api}/api/pos/checkout`, { data: { items: [{ id: productId, quantity: 3 }], paymentName: "Synthetic Customer", paymentEmail: "customer@example.invalid", paymentContact: "09171112222", paymentMethod: "Cash" } });
  29 |     expect(order.status()).toBe(200);
  30 |     const created = await order.json(); expect(Number(created.totalAmount)).toBe(226.5);
  31 |     const saleId = String(created.saleId), referenceId = String(created.paymentReferenceId);
  32 |     const [items] = await db.execute<RowDataPacket[]>("SELECT quantity,unit_price,line_total FROM pos_sale_items WHERE pos_sale_id=?", [saleId]);
  33 |     expect(items).toHaveLength(1); expect(Number(items[0].quantity)).toBe(3); expect(Number(items[0].unit_price)).toBe(75.5); expect(Number(items[0].line_total)).toBe(226.5);
  34 |     const [pending] = await db.execute<RowDataPacket[]>("SELECT sale_status,payment_status FROM pos_sales WHERE pos_sale_id=?", [saleId]);
  35 |     expect(pending[0]).toMatchObject({ sale_status: "Pending Payment", payment_status: "Unpaid" });
  36 |     expect((await chairman.request.put(`${api}/api/pos/orders/${saleId}/complete`, { data: {} })).status()).toBe(400);
  37 |     expect((await bookkeeper.request.put(`${api}/api/pos/orders/${saleId}/confirm`, { data: {} })).status()).toBe(200);
  38 |     expect((await bookkeeper.request.put(`${api}/api/pos/orders/${saleId}/confirm`, { data: {} })).status()).toBe(400);
  39 |     const [paid] = await db.execute<RowDataPacket[]>("SELECT sale_status,payment_status,total_amount FROM pos_sales WHERE pos_sale_id=?", [saleId]);
  40 |     expect(paid[0]).toMatchObject({ sale_status: "Paid", payment_status: "Paid" }); expect(Number(paid[0].total_amount)).toBe(226.5);
  41 |     const [financial] = await db.execute<RowDataPacket[]>("SELECT amount,record_type,source_module FROM financial_records WHERE payment_reference_id=?", [referenceId]);
  42 |     expect(financial).toHaveLength(1); expect(financial[0]).toMatchObject({ record_type: "Income", source_module: "POS" }); expect(Number(financial[0].amount)).toBe(226.5);
  43 |     const [stock] = await db.execute<RowDataPacket[]>("SELECT SUM(quantity_change) AS n FROM inventory_movements WHERE product_id=?", [productId]); expect(Number(stock[0].n)).toBe(17);
  44 |     expect((await chairman.request.put(`${api}/api/pos/orders/${saleId}/complete`, { data: { note: "Synthetic pickup" } })).status()).toBe(200);
  45 |     const [completed] = await db.execute<RowDataPacket[]>("SELECT sale_status,fulfilled_at FROM pos_sales WHERE pos_sale_id=?", [saleId]);
  46 |     expect(completed[0].sale_status).toBe("Completed"); expect(completed[0].fulfilled_at).toBeTruthy();
  47 |   } finally { await member.close(); await bookkeeper.close(); await chairman.close(); await db.end(); }
  48 | });
  49 | 
  50 | test("P31 P32 P35 rental inquiry, review, payment and schedule persist once", async ({ browser }) => {
  51 |   const db = await database(), visitor = await browser.newContext(), bookkeeper = await browser.newContext(), chairman = await browser.newContext();
  52 |   try {
  53 |     await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
  54 |     const code = `E2E-RNT-${randomUUID().slice(0, 8).toUpperCase()}`;
  55 |     await db.execute("INSERT INTO rental_assets(asset_code,asset_name,asset_type,category,description,rate_amount,rate_unit,deposit_amount,asset_status,public_visibility,created_by) SELECT ?,'Synthetic Rental Pump',asset_type,category,description,1000,'Per Day',0,'Available',1,created_by FROM rental_assets WHERE asset_code='RNT-PUMP-001'", [code]);
  56 |     const draft = { clientRequestId: randomUUID(), fullName: "Synthetic Visitor", requesterType: "Public or Non-member", contactNumber: "09171112222", email: "rental@example.invalid", completeAddress: "Synthetic address Nasugbu", barangay: "Lumbangan", municipality: "Nasugbu", serviceId: code, intendedUse: "Synthetic farm work", preferredDate: "2031-06-03", preferredEndDate: "2031-06-03", preferredStartTime: "08:00", preferredEndTime: "12:00", requestDescription: "Synthetic farm work request", notes: "", validIdType: "Passport", attachmentName: "", membershipProofName: "", dataPrivacyConsent: true, accuracyConfirmation: true, contactConsent: true, preferredPaymentMethod: "Cash" };
  57 |     const submission = () => visitor.request.post(`${api}/api/rental/inquiries/public`, { multipart: { draft: JSON.stringify(draft), validId: { name: "synthetic-id.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% synthetic id\n%%EOF\n") } } });
  58 |     const first = await submission(); expect(first.status(), await first.text()).toBe(201); const inquiry = await first.json();
  59 |     const repeat = await submission(); expect(repeat.status()).toBe(201); expect((await repeat.json()).rentalId).toBe(inquiry.rentalId);
  60 |     const rentalId = String(inquiry.rentalId);
  61 |     expect(inquiry.status).toBe("Under Review"); expect(inquiry.preferredDate).toBe(draft.preferredDate);
  62 |     const [bookings] = await db.execute<RowDataPacket[]>("SELECT rb.rental_booking_id,rb.booking_status,rb.total_amount FROM rental_bookings rb JOIN rental_assets a ON a.rental_asset_id=rb.rental_asset_id WHERE a.asset_code=?", [code]);
  63 |     expect(bookings).toHaveLength(1); expect(bookings[0].booking_status).toBe("Pending");
  64 |     for (const decision of ["Approved for Scheduling"]) {
  65 |       const review = await chairman.request.post(`${api}/api/rental/inquiries/${rentalId}/review`, { data: { decision, publicNote: "Synthetic review decision for testing." } });
  66 |       expect(review.status()).toBe(200);
  67 |     }
  68 |     const [approved] = await db.execute<RowDataPacket[]>("SELECT booking_status,total_amount FROM rental_bookings WHERE rental_booking_id=?", [bookings[0].rental_booking_id]);
  69 |     expect(approved[0].booking_status).toBe("Approved"); expect(Number(approved[0].total_amount)).toBe(1000);
  70 |     const payment = await bookkeeper.request.post(`${api}/api/rental/payments`, { data: { rentalId, requesterName: draft.fullName, equipmentName: "Synthetic Rental Pump", scheduleDate: draft.preferredDate, amount: 1000, paymentDate: "2026-11-08", paymentMethod: "Cash", status: "Paid", recordedBy: "Test Bookkeeper" } });
  71 |     expect(payment.status()).toBe(201);
  72 |     const [finance] = await db.execute<RowDataPacket[]>("SELECT amount,source_module,record_type FROM financial_records WHERE source_module='Rental' AND source_record_id=? AND record_type='Income'", [bookings[0].rental_booking_id]);
  73 |     expect(finance).toHaveLength(1); expect(Number(finance[0].amount)).toBe(1000);
  74 |     const schedule = await chairman.request.post(`${api}/api/rental/schedules`, { data: { rentalId, inquiryId: rentalId, serviceId: code, equipmentName: "Synthetic Rental Pump", requesterName: draft.fullName, requesterType: draft.requesterType, date: draft.preferredDate, endDate: draft.preferredEndDate, startTime: draft.preferredStartTime, endTime: draft.preferredEndTime, assignedOperator: `Synthetic Operator ${code}`, serviceLocation: draft.completeAddress, barangay: draft.barangay, preparationMinutes: 0, travelMinutes: 0, bufferMinutes: 0, status: "Confirmed", paymentStatus: "Paid" } });
  75 |     expect(schedule.status(), await schedule.text()).toBe(201);
  76 |     const [after] = await db.execute<RowDataPacket[]>("SELECT booking_status,payment_status FROM rental_bookings WHERE rental_booking_id=?", [bookings[0].rental_booking_id]);
  77 |     expect(after[0]).toMatchObject({ booking_status: "Scheduled", payment_status: "Paid" });
  78 |     const [stillOne] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM financial_records WHERE source_module='Rental' AND source_record_id=? AND record_type='Income'", [bookings[0].rental_booking_id]);
  79 |     expect(Number(stillOne[0].n)).toBe(1);
  80 |   } finally { await visitor.close(); await bookkeeper.close(); await chairman.close(); await db.end(); }
  81 | });
  82 | 
  83 | test("P30 restricted allocation and payout operations reject unauthorized roles", async ({ browser }) => {
  84 |   const db = await database(), member = await browser.newContext(), bookkeeper = await browser.newContext(), chairman = await browser.newContext();
  85 |   try {
  86 |     await login(member, "member"); await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
  87 |     const [before] = await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records) AS records, (SELECT COUNT(*) FROM patronage_allocations) AS allocations");
  88 |     expect((await member.request.post(`${api}/api/dividends/declarations`, { data: {} })).status()).toBe(403);
  89 |     expect((await bookkeeper.request.post(`${api}/api/dividends/declarations/1/approve`, { data: {} })).status()).toBe(403);
  90 |     expect((await chairman.request.post(`${api}/api/dividends/withdrawals/1/complete`, { data: {} })).status()).toBe(403);
  91 |     expect((await member.request.post(`${api}/api/patronage/periods/1/finalize`, { data: {} })).status()).toBe(403);
  92 |     const [after] = await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records) AS records, (SELECT COUNT(*) FROM patronage_allocations) AS allocations");
  93 |     expect(after[0]).toEqual(before[0]);
  94 |   } finally { await member.close(); await bookkeeper.close(); await chairman.close(); await db.end(); }
  95 | });
  96 | 
```