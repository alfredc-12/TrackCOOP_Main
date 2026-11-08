# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-gateway.spec.ts >> P20 PayMongo Test Mode pending checkout makes no financial postings
- Location: tests\e2e\evidence-gateway.spec.ts:9:5

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Scancode to pay/i })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - link [ref=e6] [cursor=pointer]:
            - /url: http://127.0.0.1:3217/payment/cancelled
            - img [ref=e7]
          - paragraph [ref=e10]: DA
          - paragraph [ref=e11]: DAVID ALFRED CABALI GLUDO
        - generic [ref=e13]:
          - paragraph [ref=e14]: Reference Number
          - paragraph [ref=e15]: MEM-APP-2026-000024-FEE
    - main [ref=e16]:
      - generic [ref=e18]:
        - heading "Associate Membership Fee" [level=1] [ref=e19]
        - paragraph [ref=e20]: TrackCOOP Associate Membership Fee (MEM-APP-2026-000024-FEE)
        - paragraph [ref=e21]: ₱ 200.00
        - paragraph [ref=e22]: Billed to Gatewaydf43e97e Fixture, gateway-df43e97e@example.invalid
        - paragraph [ref=e24]: TrackCOOP Associate Membership Fee (MEM-APP-2026-000024-FEE)
        - generic [ref=e26]:
          - paragraph [ref=e27]: Subtotal
          - paragraph [ref=e28]: ₱ 200.00
          - paragraph [ref=e29]: Fees
          - generic [ref=e30]: Free
        - generic [ref=e32]:
          - paragraph [ref=e33]: Total Due
          - paragraph [ref=e34]: ₱ 200.00
      - generic [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e38]:
            - heading "Payment Method" [level=2] [ref=e39]
            - button "Scan QRPH code to pay" [ref=e40]:
              - paragraph [ref=e41]: Scan
              - img "QRPH" [ref=e43]
              - paragraph [ref=e44]: code to pay
            - button "Continue" [disabled]
          - paragraph [ref=e45]:
            - text: By completing your purchase, you agree to PayMongo's
            - link "Privacy Policy" [ref=e46] [cursor=pointer]:
              - /url: https://www.paymongo.com/privacy
            - text: .
        - generic [ref=e47]:
          - paragraph [ref=e48]: Powered by
          - img [ref=e49]
  - alert [ref=e59]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import mysql, { type RowDataPacket } from "mysql2/promise";
  3  | import { randomUUID } from "node:crypto";
  4  | 
  5  | // Explicit opt-in; the companion server only accepts a test-prefixed key and
  6  | // binds to the verified disposable database. Avoid storing checkout tokens.
  7  | test.use({ trace: "off", screenshot: "off" });
  8  | test.skip(process.env.PLAYWRIGHT_RUN_PAYMONGO_TEST !== "1", "Requires the explicitly authorized isolated PayMongo Test Mode server on port 3219");
  9  | test("P20 PayMongo Test Mode pending checkout makes no financial postings", async ({ request, page }) => {
  10 |   const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  11 |   try {
  12 |     const [identity] = await db.query<RowDataPacket[]>("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
  13 |     const dir = String(identity[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  14 |     if (Number(identity[0].port) !== 33327 || identity[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
  15 |     const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Gateway${token}`;
  16 |     const data = { firstName, lastName: "Fixture", email: `gateway-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  17 |     const submitted = await request.post("http://127.0.0.1:3219/api/membership-applications/public", { data });
  18 |     expect(submitted.status()).toBe(201);
  19 |     const code = (await submitted.json()).data.applicationCode;
  20 |     await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE application_code=?", [code]);
  21 |     const checkout = await request.post(`http://127.0.0.1:3219/api/paymongo/checkouts/membership-applications/${code}`, { headers: { "X-Application-Date-Of-Birth": "1991-01-02" }, data: { paymentPurpose: "Associate Membership Fee" } });
  22 |     expect(checkout.status(), "Test Mode checkout request failed; see sanitized API logs").toBe(201);
  23 |     const payload = (await checkout.json()).data;
  24 |     expect(payload.mode).toBe("test");
  25 |     if (process.env.PLAYWRIGHT_GATEWAY_INSPECT === "1") {
  26 |       const url = new URL(payload.checkoutUrl);
  27 |       expect(url.protocol).toBe("https:"); expect(url.hostname).toBe("checkout.paymongo.com");
  28 |       await page.goto(url.href, { waitUntil: "domcontentloaded" });
  29 |       console.log("Synthetic hosted-checkout controls", JSON.stringify({ headings: await page.getByRole("heading").allTextContents(), buttons: await page.getByRole("button").allTextContents(), radios: await page.getByRole("radio").count() }));
> 30 |       await page.getByRole("button", { name: /Scancode to pay/i }).click();
     |                                                                    ^ Error: locator.click: Test timeout of 45000ms exceeded.
  31 |       await page.getByRole("button", { name: "Continue", exact: true }).click();
  32 |       await expect(page.getByText(/QR Ph|QRPH|Scan/i).first()).toBeVisible();
  33 |       console.log("Synthetic QR test controls", JSON.stringify({ headings: await page.getByRole("heading").allTextContents(), buttons: await page.getByRole("button").allTextContents(), links: await page.getByRole("link").allTextContents() }));
  34 |     }
  35 |     const [refs] = await db.execute<RowDataPacket[]>("SELECT p.payment_reference_id,p.gateway_environment,p.validation_status,p.amount FROM payment_references p JOIN membership_applications a ON a.membership_application_id=p.related_entity_id WHERE p.related_entity_type='membership_application' AND a.application_code=?", [code]);
  36 |     expect(refs).toHaveLength(1); expect(refs[0]).toMatchObject({ gateway_environment: "Test", validation_status: "Pending" }); expect(Number(refs[0].amount)).toBe(200);
  37 |     const [counts] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial,(SELECT COUNT(*) FROM share_capital_payments WHERE payment_reference_id=?) AS capital,(SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts", [refs[0].payment_reference_id,refs[0].payment_reference_id,refs[0].payment_reference_id]);
  38 |     expect([Number(counts[0].financial),Number(counts[0].capital),Number(counts[0].receipts)]).toEqual([0,0,0]);
  39 |   } finally { await db.end(); }
  40 | });
  41 | 
```