# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-gateway.spec.ts >> P20 PayMongo Test Mode pending checkout makes no financial postings
- Location: tests\e2e\evidence-gateway.spec.ts:9:5

# Error details

```
Error: Test Mode checkout request failed; see sanitized API logs

expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 502
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
  9  | test("P20 PayMongo Test Mode pending checkout makes no financial postings", async ({ request }) => {
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
> 22 |     expect(checkout.status(), "Test Mode checkout request failed; see sanitized API logs").toBe(201);
     |                                                                                            ^ Error: Test Mode checkout request failed; see sanitized API logs
  23 |     const payload = (await checkout.json()).data;
  24 |     expect(payload.mode).toBe("test");
  25 |     const [refs] = await db.execute<RowDataPacket[]>("SELECT p.payment_reference_id,p.gateway_environment,p.validation_status,p.amount FROM payment_references p JOIN membership_applications a ON a.membership_application_id=p.related_entity_id WHERE p.related_entity_type='membership_application' AND a.application_code=?", [code]);
  26 |     expect(refs).toHaveLength(1); expect(refs[0]).toMatchObject({ gateway_environment: "Test", validation_status: "Pending" }); expect(Number(refs[0].amount)).toBe(200);
  27 |     const [counts] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial,(SELECT COUNT(*) FROM share_capital_payments WHERE payment_reference_id=?) AS capital,(SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts", [refs[0].payment_reference_id,refs[0].payment_reference_id,refs[0].payment_reference_id]);
  28 |     expect([Number(counts[0].financial),Number(counts[0].capital),Number(counts[0].receipts)]).toEqual([0,0,0]);
  29 |   } finally { await db.end(); }
  30 | });
  31 | 
```