# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-gateway.spec.ts >> P19 P21 authorized Test Mode payment and replayed simulated callback
- Location: tests\e2e\evidence-gateway.spec.ts:49:5

# Error details

```
Error: apiRequestContext.post: connect ECONNREFUSED 127.0.0.1:3219
Call log:
  - → POST http://127.0.0.1:3219/api/membership-applications/public
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 677

```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | import mysql, { type RowDataPacket } from "mysql2/promise";
  3   | import { randomUUID } from "node:crypto";
  4   | import { createHmac } from "node:crypto";
  5   | import { readFileSync } from "node:fs";
  6   | import dotenv from "dotenv";
  7   | 
  8   | // Explicit opt-in; the companion server only accepts a test-prefixed key and
  9   | // binds to the verified disposable database. Avoid storing checkout tokens.
  10  | test.use({ trace: "off", screenshot: "off" });
  11  | test.skip(process.env.PLAYWRIGHT_RUN_PAYMONGO_TEST !== "1", "Requires the explicitly authorized isolated PayMongo Test Mode server on port 3219");
  12  | test("P20 PayMongo Test Mode pending checkout makes no financial postings", async ({ request, page }) => {
  13  |   const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  14  |   try {
  15  |     const [identity] = await db.query<RowDataPacket[]>("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
  16  |     const dir = String(identity[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  17  |     if (Number(identity[0].port) !== 33327 || identity[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
  18  |     const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Gateway${token}`;
  19  |     const data = { firstName, lastName: "Fixture", email: `gateway-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  20  |     const submitted = await request.post("http://127.0.0.1:3219/api/membership-applications/public", { data });
  21  |     expect(submitted.status()).toBe(201);
  22  |     const code = (await submitted.json()).data.applicationCode;
  23  |     await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE application_code=?", [code]);
  24  |     const checkout = await request.post(`http://127.0.0.1:3219/api/paymongo/checkouts/membership-applications/${code}`, { headers: { "X-Application-Date-Of-Birth": "1991-01-02" }, data: { paymentPurpose: "Associate Membership Fee" } });
  25  |     expect(checkout.status(), "Test Mode checkout request failed; see sanitized API logs").toBe(201);
  26  |     const payload = (await checkout.json()).data;
  27  |     expect(payload.mode).toBe("test");
  28  |     if (process.env.PLAYWRIGHT_GATEWAY_INSPECT === "1") {
  29  |       const url = new URL(payload.checkoutUrl);
  30  |       expect(url.protocol).toBe("https:"); expect(url.hostname).toBe("checkout.paymongo.com");
  31  |       await page.goto(url.href, { waitUntil: "domcontentloaded" });
  32  |       console.log("Synthetic hosted-checkout controls", JSON.stringify({ headings: await page.getByRole("heading").allTextContents(), buttons: await page.getByRole("button").allTextContents(), radios: await page.getByRole("radio").count() }));
  33  |       await page.getByRole("button", { name: /Scan.*code to pay/i }).click();
  34  |       await expect(page.getByRole("link", { name: "Simulate Payment" })).toBeVisible();
  35  |       console.log("Synthetic QR test controls", JSON.stringify({ headings: await page.getByRole("heading").allTextContents(), buttons: await page.getByRole("button").allTextContents(), links: await page.getByRole("link").allTextContents() }));
  36  |       const [simulation] = await Promise.all([page.waitForEvent("popup"), page.getByRole("link", { name: "Simulate Payment" }).click()]);
  37  |       await simulation.waitForURL(url => url.hostname === "secure-authentication.paymongo.com");
  38  |       await simulation.waitForLoadState("domcontentloaded");
  39  |       await expect.poll(async () => (await simulation.locator("body").innerText()).trim().length, { timeout: 15_000 }).toBeGreaterThan(0);
  40  |       console.log("Synthetic simulation page", JSON.stringify({ headings: await simulation.getByRole("heading").allTextContents(), buttons: await simulation.getByRole("button").allTextContents(), links: await simulation.getByRole("link").allTextContents() }));
  41  |     }
  42  |     const [refs] = await db.execute<RowDataPacket[]>("SELECT p.payment_reference_id,p.gateway_environment,p.validation_status,p.amount FROM payment_references p JOIN membership_applications a ON a.membership_application_id=p.related_entity_id WHERE p.related_entity_type='membership_application' AND a.application_code=?", [code]);
  43  |     expect(refs).toHaveLength(1); expect(refs[0]).toMatchObject({ gateway_environment: "Test", validation_status: "Pending" }); expect(Number(refs[0].amount)).toBe(200);
  44  |     const [counts] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial,(SELECT COUNT(*) FROM share_capital_payments WHERE payment_reference_id=?) AS capital,(SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts", [refs[0].payment_reference_id,refs[0].payment_reference_id,refs[0].payment_reference_id]);
  45  |     expect([Number(counts[0].financial),Number(counts[0].capital),Number(counts[0].receipts)]).toEqual([0,0,0]);
  46  |   } finally { await db.end(); }
  47  | });
  48  | 
  49  | test("P19 P21 authorized Test Mode payment and replayed simulated callback", async ({ request, page }) => {
  50  |   test.skip(process.env.PLAYWRIGHT_GATEWAY_SIMULATE !== "1", "Requires explicit opt-in to a Test Mode simulation");
  51  |   test.setTimeout(90_000);
  52  |   const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  53  |   try {
  54  |     const [identity] = await db.query<RowDataPacket[]>("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
  55  |     const dir = String(identity[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  56  |     if (Number(identity[0].port) !== 33327 || identity[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
  57  |     const env = dotenv.parse(readFileSync("server/.env"));
  58  |     const key = env.PAYMONGO_TEST_SECRET_KEY || env.PAYMONGO_SECRET_KEY || "";
  59  |     const webhook = env.PAYMONGO_TEST_WEBHOOK_SECRET || env.PAYMONGO_WEBHOOK_SECRET || "";
  60  |     if (!key.startsWith("sk_test_") || !webhook) throw new Error("Test Mode credentials unavailable");
  61  |     for (const [requestedMembershipType, paymentPurpose, amount] of [["Associate","Associate Membership Fee",200],["True Member","Share Capital",1500]] as const) {
  62  |     const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Gateway${token}`;
  63  |     const data = { requestedMembershipType, firstName, lastName: "Fixture", email: `gateway-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
> 64  |     const submitted = await request.post("http://127.0.0.1:3219/api/membership-applications/public", { data }); expect(submitted.status()).toBe(201);
      |                                     ^ Error: apiRequestContext.post: connect ECONNREFUSED 127.0.0.1:3219
  65  |     const code = (await submitted.json()).data.applicationCode;
  66  |     await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE application_code=?", [code]);
  67  |     const checkout = await request.post(`http://127.0.0.1:3219/api/paymongo/checkouts/membership-applications/${code}`, { headers: { "X-Application-Date-Of-Birth": "1991-01-02" }, data: paymentPurpose === "Share Capital" ? { paymentPurpose,requestedAmount: amount } : { paymentPurpose } }); expect(checkout.status()).toBe(201);
  68  |     const checkoutData = (await checkout.json()).data; expect(checkoutData.mode).toBe("test");
  69  |     const [refs] = await db.execute<RowDataPacket[]>("SELECT p.payment_reference_id,p.reference_number,p.gateway_checkout_id,p.amount,a.membership_application_id FROM payment_references p JOIN membership_applications a ON a.membership_application_id=p.related_entity_id WHERE p.related_entity_type='membership_application' AND a.application_code=?", [code]);
  70  |     expect(refs).toHaveLength(1);
  71  |     const target = new URL(checkoutData.checkoutUrl); expect(target.hostname).toBe("checkout.paymongo.com"); expect(target.protocol).toBe("https:");
  72  |     await page.goto(target.href, { waitUntil: "domcontentloaded" }); await page.getByRole("button", { name: /Scan.*code to pay/i }).click();
  73  |     await expect(page.getByRole("link", { name: "Simulate Payment" })).toBeVisible();
  74  |     const [simulation] = await Promise.all([page.waitForEvent("popup"),page.getByRole("link", { name: "Simulate Payment" }).click()]);
  75  |     await simulation.waitForURL(url => url.hostname === "secure-authentication.paymongo.com");
  76  |     await expect(simulation.getByRole("heading", { name: "QRPH Test Payment Page" })).toBeVisible();
  77  |     await simulation.getByRole("button", { name: "Authorize Test Payment" }).click();
  78  |     let gateway: any;
  79  |     await expect.poll(async () => {
  80  |       const result = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${refs[0].gateway_checkout_id}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` } });
  81  |       if (!result.ok) return "unavailable";
  82  |       gateway = await result.json();
  83  |       return gateway?.data?.attributes?.payments?.some((p: any) => p.attributes?.status === "paid") ? "paid" : "pending";
  84  |     }, { timeout: 30_000, intervals: [500,1000,2000] }).toBe("paid");
  85  |     expect(gateway.data.attributes.livemode).toBe(false);
  86  |     // Forward the fetched Test Mode resource in a locally signed synthetic
  87  |     // envelope. This tests our callback handler, not PayMongo webhook delivery.
  88  |     const event = { data: { id: `evt_synthetic_${randomUUID()}`, type: "event", attributes: { type: "checkout_session.payment.paid", livemode: false, data: gateway.data } } };
  89  |     const raw = JSON.stringify(event), timestamp = Math.floor(Date.now()/1000), signature = createHmac("sha256",webhook).update(`${timestamp}.${raw}`).digest("hex");
  90  |     const deliver = () => request.post("http://127.0.0.1:3219/api/webhooks/paymongo", { headers: { "Content-Type": "application/json", "Paymongo-Signature": `t=${timestamp},te=${signature}` }, data: raw });
  91  |     const first = await deliver(); expect(first.status(), "Synthetic callback delivery failed").toBe(200);
  92  |     const second = await deliver(); expect(second.status(), "Synthetic duplicate callback failed").toBe(200);
  93  |     expect((await second.json()).data.status).toBe("duplicate");
  94  |     const [state] = await db.execute<RowDataPacket[]>("SELECT validation_status,gateway_environment,validation_source FROM payment_references WHERE payment_reference_id=?", [refs[0].payment_reference_id]);
  95  |     expect(state[0]).toMatchObject({ validation_status: "Validated",gateway_environment:"Test",validation_source:"PayMongo Webhook" });
  96  |     const [counts] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial,(SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts,(SELECT COUNT(*) FROM payment_gateway_events WHERE payment_reference_id=? AND processing_status='Processed') AS events", [refs[0].payment_reference_id,refs[0].payment_reference_id,refs[0].payment_reference_id]);
  97  |     expect([Number(counts[0].financial),Number(counts[0].receipts),Number(counts[0].events)]).toEqual([1,1,1]);
  98  |     const [requirements] = await db.execute<RowDataPacket[]>("SELECT requirement_status FROM membership_application_requirements WHERE membership_application_id=? AND requirement_type=?", [refs[0].membership_application_id,paymentPurpose === "Share Capital" ? "Initial Share Capital" : "Associate Membership Fee"]);
  99  |     expect(requirements[0].requirement_status).toBe("Verified");
  100 |     if (paymentPurpose === "Share Capital") {
  101 |       const [capital] = await db.execute<RowDataPacket[]>("SELECT e.amount FROM membership_capital_events e JOIN membership_capital_cases c ON c.capital_case_id=e.capital_case_id WHERE c.membership_application_id=?", [refs[0].membership_application_id]);
  102 |       expect(capital).toHaveLength(1); expect(Number(capital[0].amount)).toBe(1500);
  103 |     }
  104 |     }
  105 |   } finally { await db.end(); }
  106 | });
  107 | 
  108 | test("P20 Test Mode failed, expired and canceled checkouts create no successful postings", async ({ request, page }) => {
  109 |   test.skip(process.env.PLAYWRIGHT_GATEWAY_SIMULATE !== "1", "Requires explicit opt-in to Test Mode simulations");
  110 |   test.setTimeout(90_000);
  111 |   const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  112 |   try {
  113 |     const [identity] = await db.query<RowDataPacket[]>("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
  114 |     const dir = String(identity[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  115 |     if (Number(identity[0].port) !== 33327 || identity[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
  116 |     const env = dotenv.parse(readFileSync("server/.env")); const key = env.PAYMONGO_TEST_SECRET_KEY || env.PAYMONGO_SECRET_KEY || "";
  117 |     if (!key.startsWith("sk_test_")) throw new Error("Test Mode key unavailable");
  118 |     for (const action of ["Fail Test Payment", "Expire Test Payment", "Cancel Checkout"]) {
  119 |       const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Unpaid${token}`;
  120 |       const data = { firstName, lastName: "Fixture", email: `unpaid-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  121 |       const submitted = await request.post("http://127.0.0.1:3219/api/membership-applications/public", { data }); expect(submitted.status()).toBe(201);
  122 |       const code = (await submitted.json()).data.applicationCode;
  123 |       await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE application_code=?", [code]);
  124 |       const checkout = await request.post(`http://127.0.0.1:3219/api/paymongo/checkouts/membership-applications/${code}`, { headers: { "X-Application-Date-Of-Birth": "1991-01-02" }, data: { paymentPurpose: "Associate Membership Fee" } }); expect(checkout.status()).toBe(201);
  125 |       const checkoutData = (await checkout.json()).data; expect(checkoutData.mode).toBe("test");
  126 |       const [refs] = await db.execute<RowDataPacket[]>("SELECT p.payment_reference_id,p.gateway_checkout_id FROM payment_references p JOIN membership_applications a ON a.membership_application_id=p.related_entity_id WHERE p.related_entity_type='membership_application' AND a.application_code=?", [code]); expect(refs).toHaveLength(1);
  127 |       const target = new URL(checkoutData.checkoutUrl); expect(target.hostname).toBe("checkout.paymongo.com"); expect(target.protocol).toBe("https:");
  128 |       await page.goto(target.href, { waitUntil: "domcontentloaded" });
  129 |       if (action === "Cancel Checkout") {
  130 |         await page.locator('a[href="http://127.0.0.1:3217/payment/cancelled"]').click();
  131 |         await expect(page).toHaveURL(/\/payment\/cancelled/);
  132 |       } else {
  133 |         await page.getByRole("button", { name: /Scan.*code to pay/i }).click();
  134 |         const [simulation] = await Promise.all([page.waitForEvent("popup"),page.getByRole("link", { name: "Simulate Payment" }).click()]);
  135 |         await simulation.waitForURL(url => url.hostname === "secure-authentication.paymongo.com");
  136 |         await expect(simulation.getByRole("heading", { name: "QRPH Test Payment Page" })).toBeVisible();
  137 |         await simulation.getByRole("button", { name: action, exact: true }).click();
  138 |         await simulation.close().catch(() => {});
  139 |       }
  140 |       const result = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${refs[0].gateway_checkout_id}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` } });
  141 |       expect(result.status).toBe(200); const gateway = await result.json();
  142 |       expect(gateway.data.attributes.livemode).toBe(false);
  143 |       expect((gateway.data.attributes.payments ?? []).some((p: any) => p.attributes?.status === "paid")).toBe(false);
  144 |       const [state] = await db.execute<RowDataPacket[]>("SELECT validation_status FROM payment_references WHERE payment_reference_id=?", [refs[0].payment_reference_id]);
  145 |       expect(state[0].validation_status).not.toBe("Validated");
  146 |       const [counts] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial,(SELECT COUNT(*) FROM share_capital_payments WHERE payment_reference_id=?) AS capital,(SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts", [refs[0].payment_reference_id,refs[0].payment_reference_id,refs[0].payment_reference_id]);
  147 |       expect([Number(counts[0].financial),Number(counts[0].capital),Number(counts[0].receipts)]).toEqual([0,0,0]);
  148 |     }
  149 |   } finally { await db.end(); }
  150 | });
  151 | 
```