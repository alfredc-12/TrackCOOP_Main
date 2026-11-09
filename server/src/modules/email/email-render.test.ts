import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { APPROVED_WITH_ACTIVATION_MESSAGE } from "../membership-applications/membership-outbox";
import { enqueueRentalPaymentConfirmed, enqueueRentalSchedule, scheduleVersion } from "../rental/rental-outbox";
import { formatClockTime, rentalPaymentContent, rentalScheduleContent, rentalStatusContent, rentalSubmittedContent, renderRentalEmail, type RentalEmailContent } from "../rental/rental-email";
import type { RentalInquiry, RentalSchedule } from "../rental/rental.types";
import type { EmailConfig } from "./email-config";
import { encryptSecret, signRentalStatusToken, verifyReceiptToken, verifyRentalStatusToken } from "./email-crypto";
import type { OutboxRow, SqlExecutor } from "./email-outbox.repository";
import { renderOutboxEmail } from "./email-render";

const secretKey = randomBytes(32);
const config: EmailConfig = {
  mode: "resend", stage: "general", allowlist: [], fromName: "TrackCOOP", fromAddress: "notifications@notify.example.test", replyTo: "support@example.test",
  resendApiKey: "re_x", secretKey, apiPublicUrl: "https://api.example.test", frontendUrl: "https://app.example.test",
};
const now = new Date("2026-11-03T04:00:00Z");

const row = (overrides: Partial<OutboxRow>): OutboxRow => ({
  id: "1", eventKey: "x", dedupeKey: "dedupe-1", coalesceKey: null, recipientEmail: "tester@example.test", recipientName: "Ana Reyes",
  payload: {}, secretEnc: null, attemptCount: 1, ambiguousSince: null, createdAt: now, relatedEntityType: null, relatedEntityId: null, ...overrides,
});

type Handler = { match: (sql: string) => boolean; rows: Array<Record<string, unknown>> };
function fakePool(handlers: Handler[] = []) {
  return { async execute(sql: string) { const found = handlers.find((handler) => handler.match(sql)); return [found?.rows ?? [], []]; } } as unknown as Pool;
}
const ctx = (pool = fakePool()) => ({ pool, config, now });

async function ok(result: ReturnType<typeof renderOutboxEmail>) {
  const rendered = await result;
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  return (rendered as Extract<typeof rendered, { ok: true }>).message;
}

// ------------------------------------------------------------------------------------------- membership 1-6

test("1. application received carries the code and a status link", async () => {
  const message = await ok(renderOutboxEmail(row({ eventKey: "membership.application.submitted", payload: { name: "Ana Reyes", applicationCode: "MEM-APP-000007" } }), ctx()));
  assert.equal(message.subject, "Membership application received: MEM-APP-000007");
  assert.match(message.text, /Hello Ana Reyes/);
  assert.match(message.text, /https:\/\/app\.example\.test\/membership\/application-status\?code=MEM-APP-000007/);
  assert.match(message.html ?? "", /Membership Application Received/);
});

const digestPool = (overrides: { status?: string; requirements?: Array<Record<string, unknown>>; message?: string | null } = {}) => fakePool([
  { match: (sql) => sql.includes("FROM membership_applications"), rows: [{ status: overrides.status ?? "Needs Information" }] },
  { match: (sql) => sql.includes("membership_application_requirements"), rows: overrides.requirements ?? [] },
  { match: (sql) => sql.includes("status_history"), rows: overrides.message === null ? [] : [{ message: overrides.message ?? "Please send clear photos." }] },
]);
const digestRow = row({ eventKey: "membership.application.information_required", payload: { name: "Ana Reyes", applicationCode: "MEM-APP-000007", applicationId: "7" } });

test("2. the information digest lists every outstanding item with the latest message and one status link", async () => {
  const pool = digestPool({ requirements: [
    { type: "Valid ID", status: "Pending", remarks: "Front and back" },
    { type: "Proof of Residency", status: "Rejected", remarks: null },
    { type: "Other", status: "Pending", remarks: null },
  ] });
  const message = await ok(renderOutboxEmail(digestRow, ctx(pool)));
  assert.equal(message.subject, "Membership application needs information: MEM-APP-000007");
  for (const expected of ["- Valid ID: Front and back", "- Proof of Residency (needs a replacement)", "- Other", "Please send clear photos."]) assert.ok(message.text.includes(expected), expected);
  assert.equal((message.text.match(/application-status\?code=/g) ?? []).length, 1);
});

test("2. the digest is dropped when nothing is outstanding or the application has moved on", async () => {
  assert.deepEqual(await renderOutboxEmail(digestRow, ctx(digestPool({ status: "Under Review", requirements: [], message: null }))), { ok: false, action: "cancel", reason: "nothing_outstanding" });
  for (const status of ["Approved", "Rejected", "Withdrawn"]) {
    assert.deepEqual(await renderOutboxEmail(digestRow, ctx(digestPool({ status, requirements: [{ type: "Valid ID", status: "Pending", remarks: null }] }))), { ok: false, action: "cancel", reason: "application_closed" });
  }
  assert.deepEqual(await renderOutboxEmail(digestRow, ctx(fakePool())), { ok: false, action: "cancel", reason: "application_missing" });
});

test("3, 4 and 6. ready for payment, payment confirmed and rejected render their own subject and message", async () => {
  const cases: Array<[string, string, string]> = [
    ["membership.application.ready_for_payment", "Membership payment is ready: MEM-APP-000007", "approved for payment"],
    ["membership.application.payment_confirmed", "Membership payment confirmed: MEM-APP-000007", "payment was confirmed"],
    ["membership.application.rejected", "Membership application update: MEM-APP-000007", "not approved"],
  ];
  for (const [eventKey, subject, phrase] of cases) {
    const message = await ok(renderOutboxEmail(row({ eventKey, payload: { name: "Ana Reyes", applicationCode: "MEM-APP-000007", status: "Payment Required", subject, message: `Your membership application was ${phrase}.` } }), ctx()));
    assert.equal(message.subject, subject);
    assert.ok(message.text.includes(phrase));
    assert.match(message.text, /application-status\?code=MEM-APP-000007/);
  }
});

const approved = (secret: object | null, expiresAt: string | null = "2026-11-06T04:00:00.000Z", message = APPROVED_WITH_ACTIVATION_MESSAGE) => row({
  eventKey: "membership.application.approved",
  dedupeKey: "membership.approved:app:7",
  payload: { name: "Ana Reyes", applicationCode: "MEM-APP-000007", status: "Approved", subject: "Membership approved: MEM-APP-000007", message, ...(expiresAt ? { activationExpiresAt: expiresAt } : {}) },
  secretEnc: secret ? encryptSecret(JSON.stringify(secret), secretKey, "membership.approved:app:7") : null,
});

test("5. the approval email puts the activation link and its expiry in, from the encrypted secret", async () => {
  const link = "https://app.example.test/membership/activate/TOKEN-abc123";
  const message = await ok(renderOutboxEmail(approved({ activationUrl: link }), ctx()));
  assert.ok(message.text.includes(link));
  assert.match(message.text, /can be used once and expires on/);
  assert.match(message.text, /November 6, 2026/);
  assert.ok((message.html ?? "").includes("TOKEN-abc123"));
  assert.equal(message.text.includes("{{"), false);
});

test("5. the approval HTML makes activation the main button instead of printing the address in the paragraph", async () => {
  const link = "https://app.example.test/membership/activate/TOKEN-abc123";
  const message = await ok(renderOutboxEmail(approved({ activationUrl: link }), ctx()));
  const html = message.html ?? "";
  assert.match(html, /Activate my account/);
  assert.equal(html.includes("Check Application Status"), false, "activation is the one button");
  assert.match(html, /<a href="https:\/\/app\.example\.test\/membership\/activate\/TOKEN-abc123"/, "the button goes to the activation link");
  assert.match(html, /Use the button below to activate your member portal account\./);
  assert.match(html, /can be used once and expires on/);
  assert.equal(html.includes("here: https://"), false, "no raw address in the sentence");
  assert.ok(message.text.includes(link), "the plain-text version still carries the link");
  assert.equal(message.text.includes("{{"), false);
  assert.equal(html.includes("{{"), false);
});

test("5. an approval without an account to activate is a plain welcome with no link", async () => {
  const message = await ok(renderOutboxEmail(approved(null, null, "Your membership was approved. Welcome to the cooperative."), ctx()));
  assert.match(message.text, /Welcome to the cooperative/);
  assert.equal(message.text.includes("activate"), false);
});

test("5. an expired link is never sent, and a lost secret fails (so the Chairman is told)", async () => {
  assert.deepEqual(await renderOutboxEmail(approved({ activationUrl: "x" }, "2026-11-02T04:00:00.000Z"), ctx()), { ok: false, action: "cancel", reason: "activation_expired" });
  assert.deepEqual(await renderOutboxEmail(approved(null), ctx()), { ok: false, action: "fail", reason: "secret_unavailable" });
  const wrongKey = row({ ...approved(null), secretEnc: encryptSecret("{}", randomBytes(32), "membership.approved:app:7") });
  assert.deepEqual(await renderOutboxEmail(wrongKey, ctx()), { ok: false, action: "fail", reason: "secret_unavailable" });
});

test("5. a replacement activation email carries only the new link and says it can be ignored", async () => {
  const replacement = row({
    eventKey: "membership.activation.replacement", dedupeKey: "membership.activation:user:5:token:9", payload: { name: "Ana Reyes", activationExpiresAt: "2026-11-06T04:00:00.000Z" },
    secretEnc: encryptSecret(JSON.stringify({ activationUrl: "https://app.example.test/membership/activate/NEWTOKEN" }), secretKey, "membership.activation:user:5:token:9"),
  });
  const message = await ok(renderOutboxEmail(replacement, ctx()));
  assert.equal(message.subject, "Your new TrackCOOP activation link");
  assert.ok(message.text.includes("NEWTOKEN"));
  assert.match(message.text, /you can ignore this email/);
});

// ------------------------------------------------------------------------------------------------ rental 7-10

const STATUS_URL = "https://app.example.test/rental?booking=RNT-0042&k=TESTTOKEN";
const rentalMessage = (content: RentalEmailContent) => renderRentalEmail(content, STATUS_URL);

const inquiry = {
  inquiryId: "RNT-0042", rentalId: "RNT-0042", requester: { fullName: "Juan Dela Cruz", email: "juan@example.test", requesterType: "Public or Non-member" },
  equipmentName: "Hand Tractor", preferredDate: "2026-11-01", preferredEndDate: "2026-11-01", preferredStartTime: "08:00", preferredEndTime: "17:00",
  status: "Approved for Scheduling", publicNote: "Your request is approved for scheduling.", estimatedFee: undefined,
} as unknown as RentalInquiry;

test("7. rental request received summarises the booking and links to status", () => {
  const message = rentalMessage(rentalSubmittedContent(inquiry));
  assert.equal(message.subject, "Rental booking received: RNT-0042");
  assert.match(message.text, /Equipment: Hand Tractor/);
  assert.match(message.text, /https:\/\/app\.example\.test\/rental\?booking=RNT-0042&k=TESTTOKEN/);
});

test("8. a status update says what the status now is", () => {
  const message = rentalMessage(rentalStatusContent(inquiry));
  assert.equal(message.subject, "Rental request RNT-0042: Approved for Scheduling");
  assert.match(message.text, /is now Approved for Scheduling/);
});

const schedule: RentalSchedule = {
  scheduleId: "SCH-0042", inquiryId: "RNT-0042", rentalId: "RNT-0042", serviceId: "PUMP-1", equipmentName: "Water Pump", requesterName: "Juan Dela Cruz",
  requesterType: "Public or Non-member", date: "2026-11-05", endDate: "2026-11-06", startTime: "08:30", endTime: "16:45", assignedOperator: "Pedro Santos",
  serviceLocation: "Sitio Uno farm", barangay: "Wawa", preparationMinutes: 0, travelMinutes: 0, bufferMinutes: 0,
  specialInstructions: "INTERNAL: customer owes a past balance, do not release without cash", customerInstructions: "Please have the field cleared and bring a valid ID.",
  status: "Confirmed", paymentStatus: "Pending",
};

test("9. the schedule email shows the confirmed dates and times, not the preferred ones", () => {
  const message = rentalMessage(rentalScheduleContent({ ...schedule, reference: "RNT-0042", requesterName: "Juan Dela Cruz", equipmentName: "Water Pump", confirmed: true }));
  assert.equal(message.subject, "Rental schedule confirmed: RNT-0042");
  assert.match(message.text, /Start: November 5, 2026, 8:30 AM/);
  assert.match(message.text, /End: November 6, 2026, 4:45 PM/);
  assert.equal(message.text.includes("November 1, 2026"), false, "the preferred date must not appear");
  for (const expected of ["Location: Sitio Uno farm, Wawa", "Assigned operator: Pedro Santos", "Please have the field cleared", "Reference: RNT-0042", "Water Pump", "Philippine time", "/rental?booking=RNT-0042"]) {
    assert.ok(message.text.includes(expected), expected);
  }
});

test("9. a proposed schedule is labelled as not final, and a schedule without an operator or instructions leaves those lines out", () => {
  const message = rentalMessage(rentalScheduleContent({ reference: "RNT-0042", requesterName: "Juan", equipmentName: "Hand Tractor", confirmed: false, date: "2026-11-05", endDate: "2026-11-05", startTime: "08:00", endTime: "12:00" }));
  assert.equal(message.subject, "Rental schedule proposed: RNT-0042");
  assert.match(message.text, /not final until it is confirmed/);
  assert.equal(message.text.includes("Assigned operator"), false);
  assert.equal(message.text.includes("Instructions for you"), false);
});

test("9. internal schedule notes can never reach the queued email", async () => {
  const captured: unknown[][] = [];
  const executor = { async execute(sql: string, values: unknown[]) { if (sql.includes("INSERT INTO email_outbox")) captured.push(values); return [{ insertId: 1 }, []]; } } as unknown as SqlExecutor;
  await enqueueRentalSchedule(executor, inquiry, schedule, 42, config);
  assert.equal(captured.length, 1);
  const stored = String(captured[0][5]);
  assert.equal(stored.includes("INTERNAL"), false);
  assert.equal(stored.includes("past balance"), false);
  assert.ok(stored.includes("Please have the field cleared"));
});

test("9. saving an unchanged schedule never re-sends, while any customer-visible change does", () => {
  assert.equal(scheduleVersion(schedule), scheduleVersion({ ...schedule, specialInstructions: "a different internal note", preparationMinutes: 99 }));
  for (const change of [{ startTime: "09:00" }, { date: "2026-11-07" }, { assignedOperator: "Someone Else" }, { serviceLocation: "Elsewhere" }, { customerInstructions: "New instructions" }, { status: "Proposed" as const }]) {
    assert.notEqual(scheduleVersion(schedule), scheduleVersion({ ...schedule, ...change }), JSON.stringify(change));
  }
});

test("9. clock times are shown as Philippine wall-clock values", () => {
  assert.equal(formatClockTime("00:15"), "12:15 AM");
  assert.equal(formatClockTime("12:00"), "12:00 PM");
  assert.equal(formatClockTime("17:05"), "5:05 PM");
});

test("10. the payment email states the amount, method, reference and receipt number", () => {
  const message = rentalMessage(rentalPaymentContent({ reference: "RNT-0042", requesterName: "Juan Dela Cruz", equipmentName: "Hand Tractor", amount: 1500, paymentMethod: "QRPH", paymentReference: "RNT-PAY-42", receiptNumber: "PAY-RCPT-2026-000042", paidOn: "2026-11-03" }));
  assert.equal(message.subject, "Rental payment confirmed: RNT-0042");
  for (const expected of ["₱1,500.00", "Payment method: QRPH", "Payment reference: RNT-PAY-42", "Receipt number: PAY-RCPT-2026-000042", "November 3, 2026"]) assert.ok(message.text.includes(expected), expected);
});

test("10. one rental payment queues one email whichever path confirmed it", async () => {
  const keys: string[] = [];
  const executor = {
    async execute(sql: string, values: unknown[]) {
      if (sql.includes("FROM rental_bookings")) return [[{ reference: "RNT-0042", requesterName: "Juan", purpose: JSON.stringify({ email: "juan@example.test" }), equipmentName: "Hand Tractor", memberEmail: null, memberName: null }], []];
      if (sql.includes("INSERT INTO email_outbox")) { keys.push(String(values[1])); return [{ insertId: 1 }, []]; }
      return [[], []];
    },
  } as unknown as SqlExecutor;
  const payment = { bookingId: 5, paymentReferenceId: 77, amount: 1500 };
  await enqueueRentalPaymentConfirmed(executor, payment, config);
  await enqueueRentalPaymentConfirmed(executor, { ...payment, paymentMethod: "Cash" }, config);
  assert.deepEqual(keys, ["rental.payment:payref:77", "rental.payment:payref:77"], "identical keys, so the unique index keeps only one row");
});

const rentalRow = (eventKey: string, content: RentalEmailContent, reference = "RNT-0042") => row({ eventKey, payload: { reference, content } });

test("7-10. a queued rental email renders as both text and HTML, with a status link that signs in by itself", async () => {
  const cases: Array<[string, RentalEmailContent]> = [
    ["rental.booking.submitted", rentalSubmittedContent(inquiry)],
    ["rental.status.updated", rentalStatusContent(inquiry)],
    ["rental.schedule.updated", rentalScheduleContent({ ...schedule, reference: "RNT-0042", requesterName: "Juan Dela Cruz", equipmentName: "Water Pump", confirmed: true })],
    ["rental.payment.confirmed", rentalPaymentContent({ reference: "RNT-0042", requesterName: "Juan Dela Cruz", equipmentName: "Hand Tractor", amount: 1500 })],
  ];
  for (const [eventKey, content] of cases) {
    const message = await ok(renderOutboxEmail(rentalRow(eventKey, content), ctx()));
    assert.equal(message.subject, content.subject, eventKey);
    assert.ok(message.html && message.html.startsWith("<!doctype html>"), `${eventKey} has an HTML version`);
    assert.ok(message.html.includes(content.title), eventKey);
    const link = /https:\/\/app\.example\.test\/rental\?booking=RNT-0042&k=(\S+)/.exec(message.text);
    assert.ok(link, `${eventKey} links to the status dialog`);
    assert.equal(verifyRentalStatusToken(decodeURIComponent(link![1]), "RNT-0042", secretKey, Math.floor(now.getTime() / 1000)), true);
    assert.ok(message.html.includes("Check booking status"), eventKey);
  }
});

test("7-10. the status link is bound to its booking and expires", async () => {
  const message = await ok(renderOutboxEmail(rentalRow("rental.status.updated", rentalStatusContent(inquiry)), ctx()));
  const token = decodeURIComponent(/&k=(\S+)/.exec(message.text)![1]);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  assert.equal(verifyRentalStatusToken(token, "RNT-0042", secretKey, nowSeconds), true);
  assert.equal(verifyRentalStatusToken(token, "rnt-0042", secretKey, nowSeconds), true, "reference case does not matter");
  assert.equal(verifyRentalStatusToken(token, "RNT-0043", secretKey, nowSeconds), false, "another booking");
  assert.equal(verifyRentalStatusToken(token, "RNT-0042", randomBytes(32), nowSeconds), false, "another key");
  assert.equal(verifyRentalStatusToken(token, "RNT-0042", secretKey, nowSeconds + 61 * 86_400), false, "after 60 days");
  assert.equal(verifyRentalStatusToken(`${token}x`, "RNT-0042", secretKey, nowSeconds), false, "altered");
  assert.equal(verifyRentalStatusToken("garbage", "RNT-0042", secretKey, nowSeconds), false);
  assert.equal(verifyRentalStatusToken(signRentalStatusToken("RNT-0042", nowSeconds - 1, secretKey), "RNT-0042", secretKey, nowSeconds), false, "already expired");
});

test("7-10. without a key the link still opens the dialog, just without signing in", async () => {
  const message = await ok(renderOutboxEmail(rentalRow("rental.status.updated", rentalStatusContent(inquiry)), { pool: fakePool(), config: { ...config, secretKey: undefined }, now }));
  assert.match(message.text, /https:\/\/app\.example\.test\/rental\?booking=RNT-0042(\s|$)/);
  assert.equal(message.text.includes("&k="), false);
});

test("7-10. rows queued before the HTML version existed still send their finished text", async () => {
  const message = await ok(renderOutboxEmail(row({ eventKey: "rental.status.updated", payload: { subject: "Old subject", text: "Old body" } }), ctx()));
  assert.deepEqual(message, { subject: "Old subject", text: "Old body" });
});

test("9. the schedule HTML shows the confirmed times, the customer instructions, and nothing internal", async () => {
  const content = rentalScheduleContent({ ...schedule, reference: "RNT-0042", requesterName: "Juan Dela Cruz", equipmentName: "Water Pump", confirmed: true });
  const message = rentalMessage(content);
  for (const expected of ["Rental schedule confirmed", "November 5, 2026, 8:30 AM", "November 6, 2026, 4:45 PM", "Pedro Santos", "Sitio Uno farm, Wawa", "Please have the field cleared"]) {
    assert.ok(message.html.includes(expected), expected);
  }
  assert.equal(message.html.includes("INTERNAL"), false);
  assert.equal(message.html.includes("past balance"), false);
});

test("rental HTML escapes whatever a customer or staff member typed", () => {
  const content = rentalScheduleContent({
    ...schedule, reference: "RNT-0042", requesterName: "<b>Juan</b>", equipmentName: "Tractor \"X\" & Co", confirmed: true,
    customerInstructions: "<script>alert(1)</script>\nBring ID",
  });
  const { html } = rentalMessage(content);
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<b>Juan</b>"), false);
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;<br>Bring ID"));
  assert.ok(html.includes("Tractor &quot;X&quot; &amp; Co"));
});

test("the email layout is email-safe: no external resources, a solid button, and a plain link fallback", () => {
  const { html } = rentalMessage(rentalStatusContent(inquiry));
  assert.equal(/<script|<link |@import|url\(|<img /i.test(html), false);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<a href="https:\/\/app\.example\.test\/rental\?booking=RNT-0042&amp;k=TESTTOKEN"/);
  assert.ok((html.match(/https:\/\/app\.example\.test\/rental\?booking=RNT-0042&amp;k=TESTTOKEN/g) ?? []).length >= 2, "button and copy-and-paste fallback");
});

// -------------------------------------------------------------------------------------------------- POS 11-12

const orderRow = (overrides: Record<string, unknown> = {}) => ({ saleId: "9", saleNumber: "SALE-0009", customerName: "Maria Clara", customerEmail: "maria@example.test", totalAmount: "250.00", paymentChannel: "Cash", receiptNumber: null, receiptStatus: null, receiptReversedAt: null, ...overrides });
const posPool = (order: Record<string, unknown> | null, saleStatus = "Pending Payment") => fakePool([
  { match: (sql) => sql.includes("sale_status AS status"), rows: [{ status: saleStatus }] },
  { match: (sql) => sql.includes("r.receipt_number"), rows: order ? [order] : [] },
  { match: (sql) => sql.includes("FROM pos_sale_items"), rows: [{ name: "Fertilizer 50kg", quantity: 1, unitPrice: "250.00", lineTotal: "250.00" }] },
]);

test("11. cash instructions give the store address, the order, the items and the total due", async () => {
  const message = await ok(renderOutboxEmail(row({ eventKey: "pos.cash.instructions", payload: { paymentReferenceId: "41" } }), ctx(posPool(orderRow()))));
  assert.equal(message.subject, "Cash payment instructions for SALE-0009");
  for (const expected of ["Barangay 11, Nasugbu", "Order reference: SALE-0009", "1 x Fertilizer 50kg", "Total due: PHP 250.00"]) assert.ok(message.text.includes(expected), expected);
  assert.match(message.html ?? "", /Cash payment instructions/);
});

test("11. cash instructions are dropped if the order was paid, cancelled or is not a cash order", async () => {
  for (const status of ["Paid", "Cancelled", "Refunded"]) {
    assert.deepEqual(await renderOutboxEmail(row({ eventKey: "pos.cash.instructions", payload: { paymentReferenceId: "41" } }), ctx(posPool(orderRow(), status))), { ok: false, action: "cancel", reason: "order_no_longer_pending" });
  }
  assert.equal((await renderOutboxEmail(row({ eventKey: "pos.cash.instructions", payload: { paymentReferenceId: "41" } }), ctx(posPool(orderRow({ paymentChannel: "PayMongo" }))))).ok, false);
  assert.equal((await renderOutboxEmail(row({ eventKey: "pos.cash.instructions", payload: { paymentReferenceId: "41" } }), ctx(posPool(null)))).ok, false);
});

const receiptRow = (expiresAt = Math.floor(now.getTime() / 1000) + 86_400) => row({ eventKey: "pos.payment.receipt", payload: { paymentReferenceId: "41", receiptId: "88", linkExpiresAt: expiresAt } });

test("12. the receipt email carries the official number and a protected, expiring link, never a storage address", async () => {
  const message = await ok(renderOutboxEmail(receiptRow(), ctx(posPool(orderRow({ receiptNumber: "PAY-RCPT-2026-000041", receiptStatus: "Generated" })))));
  assert.equal(message.subject, "Payment receipt for SALE-0009");
  assert.match(message.text, /Receipt reference: PAY-RCPT-2026-000041/);
  const url = /https:\/\/api\.example\.test\/api\/public\/receipts\/(\S+)/.exec(message.text);
  assert.ok(url, "a receipt link is present");
  assert.deepEqual(verifyReceiptToken(url![1], secretKey, Math.floor(now.getTime() / 1000)), { receiptId: "88" });
  assert.equal(/r2\.|cloudflarestorage|amazonaws|\.s3\./i.test(message.text + (message.html ?? "")), false);
  assert.match(message.text, /This link works until/);
});

test("12. no receipt email without a generated receipt; a reversed or long-expired one is dropped", async () => {
  for (const status of ["Pending", "Processing", "Failed", null]) {
    assert.deepEqual(await renderOutboxEmail(receiptRow(), ctx(posPool(orderRow({ receiptNumber: "PAY-RCPT-1", receiptStatus: status })))), { ok: false, action: "retry", reason: "receipt_not_ready" }, String(status));
  }
  assert.deepEqual(await renderOutboxEmail(receiptRow(), ctx(posPool(orderRow({ receiptStatus: "Generated", receiptReversedAt: new Date() })))), { ok: false, action: "cancel", reason: "receipt_reversed" });
  assert.deepEqual(await renderOutboxEmail(receiptRow(Math.floor(now.getTime() / 1000) - 10), ctx(posPool(orderRow({ receiptStatus: "Generated" })))), { ok: false, action: "cancel", reason: "receipt_link_expired" });
});

test("an unknown event is a failure, never a silent send", async () => {
  assert.deepEqual(await renderOutboxEmail(row({ eventKey: "something.else" }), ctx()), { ok: false, action: "fail", reason: "unknown_event" });
});
