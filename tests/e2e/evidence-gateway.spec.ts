import { expect, test } from "@playwright/test";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
type GatewayCheckout = { data: { attributes: { livemode: boolean; payments?: Array<{ attributes?: { status?: string } }> }; [key: string]: unknown } };

// Explicit opt-in; the companion server only accepts a test-prefixed key and
// binds to the verified disposable database. Avoid storing checkout tokens.
test.use({ trace: "off", screenshot: "off" });
test.skip(process.env.PLAYWRIGHT_RUN_PAYMONGO_TEST !== "1", "Requires the explicitly authorized isolated PayMongo Test Mode server on port 3219");
test("P20 PayMongo Test Mode pending checkout makes no financial postings", async ({ request, page }) => {
  const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  try {
    const [identity] = await db.query<RowDataPacket[]>("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
    const dir = String(identity[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
    if (Number(identity[0].port) !== 33327 || identity[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
    const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Gateway${token}`;
    const data = { firstName, lastName: "Fixture", email: `gateway-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
    const submitted = await request.post("http://127.0.0.1:3219/api/membership-applications/public", { data });
    expect(submitted.status()).toBe(201);
    const code = (await submitted.json()).data.applicationCode;
    await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE application_code=?", [code]);
    const checkout = await request.post(`http://127.0.0.1:3219/api/paymongo/checkouts/membership-applications/${code}`, { headers: { "X-Application-Date-Of-Birth": "1991-01-02" }, data: { paymentPurpose: "Associate Membership Fee" } });
    expect(checkout.status(), "Test Mode checkout request failed; see sanitized API logs").toBe(201);
    const payload = (await checkout.json()).data;
    expect(payload.mode).toBe("test");
    if (process.env.PLAYWRIGHT_GATEWAY_INSPECT === "1") {
      const url = new URL(payload.checkoutUrl);
      expect(url.protocol).toBe("https:"); expect(url.hostname).toBe("checkout.paymongo.com");
      await page.goto(url.href, { waitUntil: "domcontentloaded" });
      console.log("Synthetic hosted-checkout controls", JSON.stringify({ headings: await page.getByRole("heading").allTextContents(), buttons: await page.getByRole("button").allTextContents(), radios: await page.getByRole("radio").count() }));
      await page.getByRole("button", { name: /Scan.*code to pay/i }).click();
      await expect(page.getByRole("link", { name: "Simulate Payment" })).toBeVisible();
      console.log("Synthetic QR test controls", JSON.stringify({ headings: await page.getByRole("heading").allTextContents(), buttons: await page.getByRole("button").allTextContents(), links: await page.getByRole("link").allTextContents() }));
      const [simulation] = await Promise.all([page.waitForEvent("popup"), page.getByRole("link", { name: "Simulate Payment" }).click()]);
      await simulation.waitForURL(url => url.hostname === "secure-authentication.paymongo.com");
      await simulation.waitForLoadState("domcontentloaded");
      await expect.poll(async () => (await simulation.locator("body").innerText()).trim().length, { timeout: 15_000 }).toBeGreaterThan(0);
      console.log("Synthetic simulation page", JSON.stringify({ headings: await simulation.getByRole("heading").allTextContents(), buttons: await simulation.getByRole("button").allTextContents(), links: await simulation.getByRole("link").allTextContents() }));
    }
    const [refs] = await db.execute<RowDataPacket[]>("SELECT p.payment_reference_id,p.gateway_environment,p.validation_status,p.amount FROM payment_references p JOIN membership_applications a ON a.membership_application_id=p.related_entity_id WHERE p.related_entity_type='membership_application' AND a.application_code=?", [code]);
    expect(refs).toHaveLength(1); expect(refs[0]).toMatchObject({ gateway_environment: "Test", validation_status: "Pending" }); expect(Number(refs[0].amount)).toBe(200);
    const [counts] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial,(SELECT COUNT(*) FROM share_capital_payments WHERE payment_reference_id=?) AS capital,(SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts", [refs[0].payment_reference_id,refs[0].payment_reference_id,refs[0].payment_reference_id]);
    expect([Number(counts[0].financial),Number(counts[0].capital),Number(counts[0].receipts)]).toEqual([0,0,0]);
  } finally { await db.end(); }
});

test("P19 P21 authorized Test Mode payment and replayed simulated callback", async ({ request, page }) => {
  test.skip(process.env.PLAYWRIGHT_GATEWAY_SIMULATE !== "1", "Requires explicit opt-in to a Test Mode simulation");
  test.setTimeout(90_000);
  const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  try {
    const [identity] = await db.query<RowDataPacket[]>("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
    const dir = String(identity[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
    if (Number(identity[0].port) !== 33327 || identity[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
    const env = dotenv.parse(readFileSync("server/.env"));
    const key = env.PAYMONGO_TEST_SECRET_KEY || env.PAYMONGO_SECRET_KEY || "";
    const webhook = env.PAYMONGO_TEST_WEBHOOK_SECRET || env.PAYMONGO_WEBHOOK_SECRET || "";
    if (!key.startsWith("sk_test_") || !webhook) throw new Error("Test Mode credentials unavailable");
    for (const [requestedMembershipType, paymentPurpose, amount] of [["Associate","Associate Membership Fee",200],["True Member","Share Capital",1500]] as const) {
    const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Gateway${token}`;
    const data = { requestedMembershipType, firstName, lastName: "Fixture", email: `gateway-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
    const submitted = await request.post("http://127.0.0.1:3219/api/membership-applications/public", { data }); expect(submitted.status()).toBe(201);
    const code = (await submitted.json()).data.applicationCode;
    await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE application_code=?", [code]);
    const checkout = await request.post(`http://127.0.0.1:3219/api/paymongo/checkouts/membership-applications/${code}`, { headers: { "X-Application-Date-Of-Birth": "1991-01-02" }, data: paymentPurpose === "Share Capital" ? { paymentPurpose,requestedAmount: amount } : { paymentPurpose } }); expect(checkout.status()).toBe(201);
    const checkoutData = (await checkout.json()).data; expect(checkoutData.mode).toBe("test");
    const [refs] = await db.execute<RowDataPacket[]>("SELECT p.payment_reference_id,p.reference_number,p.gateway_checkout_id,p.amount,a.membership_application_id FROM payment_references p JOIN membership_applications a ON a.membership_application_id=p.related_entity_id WHERE p.related_entity_type='membership_application' AND a.application_code=?", [code]);
    expect(refs).toHaveLength(1);
    const target = new URL(checkoutData.checkoutUrl); expect(target.hostname).toBe("checkout.paymongo.com"); expect(target.protocol).toBe("https:");
    await page.goto(target.href, { waitUntil: "domcontentloaded" }); await page.getByRole("button", { name: /Scan.*code to pay/i }).click();
    await expect(page.getByRole("link", { name: "Simulate Payment" })).toBeVisible();
    const [simulation] = await Promise.all([page.waitForEvent("popup"),page.getByRole("link", { name: "Simulate Payment" }).click()]);
    await simulation.waitForURL(url => url.hostname === "secure-authentication.paymongo.com");
    await expect(simulation.getByRole("heading", { name: "QRPH Test Payment Page" })).toBeVisible();
    await simulation.getByRole("button", { name: "Authorize Test Payment" }).click();
    const gatewayHolder: { value?: GatewayCheckout } = {};
    await expect.poll(async () => {
      const result = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${refs[0].gateway_checkout_id}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` } });
      if (!result.ok) return "unavailable";
      gatewayHolder.value = await result.json() as GatewayCheckout;
      return gatewayHolder.value?.data?.attributes?.payments?.some(p => p.attributes?.status === "paid") ? "paid" : "pending";
    }, { timeout: 30_000, intervals: [500,1000,2000] }).toBe("paid");
    if (!gatewayHolder.value) throw new Error("Test checkout was not retrieved");
    expect(gatewayHolder.value.data.attributes.livemode).toBe(false);
    // Forward the fetched Test Mode resource in a locally signed synthetic
    // envelope. This tests our callback handler, not PayMongo webhook delivery.
    const event = { data: { id: `evt_synthetic_${randomUUID()}`, type: "event", attributes: { type: "checkout_session.payment.paid", livemode: false, data: gatewayHolder.value.data } } };
    const raw = JSON.stringify(event), timestamp = Math.floor(Date.now()/1000), signature = createHmac("sha256",webhook).update(`${timestamp}.${raw}`).digest("hex");
    const deliver = () => request.post("http://127.0.0.1:3219/api/webhooks/paymongo", { headers: { "Content-Type": "application/json", "Paymongo-Signature": `t=${timestamp},te=${signature}` }, data: raw });
    const first = await deliver(); expect(first.status(), "Synthetic callback delivery failed").toBe(200);
    const second = await deliver(); expect(second.status(), "Synthetic duplicate callback failed").toBe(200);
    expect((await second.json()).data.status).toBe("duplicate");
    const [state] = await db.execute<RowDataPacket[]>("SELECT validation_status,gateway_environment,validation_source FROM payment_references WHERE payment_reference_id=?", [refs[0].payment_reference_id]);
    expect(state[0]).toMatchObject({ validation_status: "Validated",gateway_environment:"Test",validation_source:"PayMongo Webhook" });
    const [counts] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial,(SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts,(SELECT COUNT(*) FROM payment_gateway_events WHERE payment_reference_id=? AND processing_status='Processed') AS events", [refs[0].payment_reference_id,refs[0].payment_reference_id,refs[0].payment_reference_id]);
    expect([Number(counts[0].financial),Number(counts[0].receipts),Number(counts[0].events)]).toEqual([1,1,1]);
    const [requirements] = await db.execute<RowDataPacket[]>("SELECT requirement_status FROM membership_application_requirements WHERE membership_application_id=? AND requirement_type=?", [refs[0].membership_application_id,paymentPurpose === "Share Capital" ? "Initial Share Capital" : "Associate Membership Fee"]);
    expect(requirements[0].requirement_status).toBe("Verified");
    if (paymentPurpose === "Share Capital") {
      const [capital] = await db.execute<RowDataPacket[]>("SELECT e.amount FROM membership_capital_events e JOIN membership_capital_cases c ON c.capital_case_id=e.capital_case_id WHERE c.membership_application_id=?", [refs[0].membership_application_id]);
      expect(capital).toHaveLength(1); expect(Number(capital[0].amount)).toBe(1500);
    }
    }
  } finally { await db.end(); }
});

test("P20 Test Mode failed, expired and canceled checkouts create no successful postings", async ({ request, page }) => {
  test.skip(process.env.PLAYWRIGHT_GATEWAY_SIMULATE !== "1", "Requires explicit opt-in to Test Mode simulations");
  test.setTimeout(90_000);
  const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  try {
    const [identity] = await db.query<RowDataPacket[]>("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
    const dir = String(identity[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
    if (Number(identity[0].port) !== 33327 || identity[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
    const env = dotenv.parse(readFileSync("server/.env")); const key = env.PAYMONGO_TEST_SECRET_KEY || env.PAYMONGO_SECRET_KEY || "";
    if (!key.startsWith("sk_test_")) throw new Error("Test Mode key unavailable");
    for (const action of ["Fail Test Payment", "Expire Test Payment", "Cancel Checkout"]) {
      const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Unpaid${token}`;
      const data = { firstName, lastName: "Fixture", email: `unpaid-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
      const submitted = await request.post("http://127.0.0.1:3219/api/membership-applications/public", { data }); expect(submitted.status()).toBe(201);
      const code = (await submitted.json()).data.applicationCode;
      await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE application_code=?", [code]);
      const checkout = await request.post(`http://127.0.0.1:3219/api/paymongo/checkouts/membership-applications/${code}`, { headers: { "X-Application-Date-Of-Birth": "1991-01-02" }, data: { paymentPurpose: "Associate Membership Fee" } }); expect(checkout.status()).toBe(201);
      const checkoutData = (await checkout.json()).data; expect(checkoutData.mode).toBe("test");
      const [refs] = await db.execute<RowDataPacket[]>("SELECT p.payment_reference_id,p.gateway_checkout_id FROM payment_references p JOIN membership_applications a ON a.membership_application_id=p.related_entity_id WHERE p.related_entity_type='membership_application' AND a.application_code=?", [code]); expect(refs).toHaveLength(1);
      const target = new URL(checkoutData.checkoutUrl); expect(target.hostname).toBe("checkout.paymongo.com"); expect(target.protocol).toBe("https:");
      await page.goto(target.href, { waitUntil: "domcontentloaded" });
      if (action === "Cancel Checkout") {
        await page.locator('a[href="http://127.0.0.1:3217/payment/cancelled"]').click();
        await expect(page).toHaveURL(/\/payment\/cancelled/);
      } else {
        await page.getByRole("button", { name: /Scan.*code to pay/i }).click();
        const [simulation] = await Promise.all([page.waitForEvent("popup"),page.getByRole("link", { name: "Simulate Payment" }).click()]);
        await simulation.waitForURL(url => url.hostname === "secure-authentication.paymongo.com");
        await expect(simulation.getByRole("heading", { name: "QRPH Test Payment Page" })).toBeVisible();
        await simulation.getByRole("button", { name: action, exact: true }).click();
        await simulation.close().catch(() => {});
      }
      const result = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${refs[0].gateway_checkout_id}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` } });
      expect(result.status).toBe(200); const gateway = await result.json();
      expect(gateway.data.attributes.livemode).toBe(false);
      expect((gateway.data.attributes.payments ?? []).some((p: { attributes?: { status?: string } }) => p.attributes?.status === "paid")).toBe(false);
      const [state] = await db.execute<RowDataPacket[]>("SELECT validation_status FROM payment_references WHERE payment_reference_id=?", [refs[0].payment_reference_id]);
      expect(state[0].validation_status).not.toBe("Validated");
      const [counts] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial,(SELECT COUNT(*) FROM share_capital_payments WHERE payment_reference_id=?) AS capital,(SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts", [refs[0].payment_reference_id,refs[0].payment_reference_id,refs[0].payment_reference_id]);
      expect([Number(counts[0].financial),Number(counts[0].capital),Number(counts[0].receipts)]).toEqual([0,0,0]);
    }
  } finally { await db.end(); }
});
