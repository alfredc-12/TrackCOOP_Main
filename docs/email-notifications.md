# Email notifications (Resend + outbox)

Automated emails are sent through the **Resend HTTP API** from a **database outbox**. Nothing here applies until
`EMAIL_DELIVERY=resend`; with any other value the previous SMTP/webhook behaviour is unchanged.

Sender `notifications@notify.nffac.trackcoop.online`, Reply-To `support@nffac.trackcoop.online`. Staff mailboxes and
forwarders on the main domain are not touched by this feature.

## How it works

1. A business action (application submitted, payment confirmed, schedule saved ...) writes an `email_outbox` row **inside
   the same database transaction**. If the transaction rolls back, no email exists. If it commits, the email is durable.
2. A short cron job runs the worker once a minute. It claims due rows, renders each message from current data, calls
   `POST https://api.resend.com/emails` with an `Idempotency-Key`, and records the outcome.
3. Resend webhooks (`POST <API_PUBLIC_URL>/api/webhooks/resend`, Svix-signed) update `delivery_status`
   (`sent`, `delayed`, `delivered`, `bounced`, `complained`, ...). Duplicates and out-of-order events are safe.

Sending never happens inside a request, so a Resend outage cannot slow or fail a payment, approval or booking.

### Reliability rules

| Concern | Behaviour |
| --- | --- |
| Duplicates | `dedupe_key` is unique per business event (for example `rental.payment:payref:77`). The same key is the Resend `Idempotency-Key`. |
| Overlap | `GET_LOCK('trackcoop_email_worker')` allows one run at a time; rows are also claimed atomically. |
| Crash mid-send | Rows left `Sending` are reclaimed and marked ambiguous; Resend de-duplicates with the same key. |
| Ambiguity window | Resend remembers a key for 24 h. If an unanswered attempt is older than 23 h the row is **held as `Failed / needs_review`** instead of risking a duplicate. |
| Retries | 60 s, 2 min, 4 min ... capped at 6 h, +/-20% jitter; honours `Retry-After`; daily quota waits for the next UTC day; max 10 attempts or 48 h. |
| Permanent errors | Validation/recipient errors are `Failed` immediately, no retry. |
| Account-level errors | 401/403/monthly quota stop the whole run and give the remaining rows back without spending attempts. |
| Timeout | 10 s per request. A timeout is treated as ambiguous, never as "not sent". |
| Missing/invalid address | Row is `Skipped` (reason recorded). The business workflow is never blocked. |
| Failed approval email | The Chairman gets an in-app notification (reference, status, safe reason; no link or credential). |

## The twelve notifications

| # | Event key | When | Recipient |
| --- | --- | --- | --- |
| 1 | `membership.application.submitted` | Application received | Applicant |
| 2 | `membership.application.information_required` | Information/documents required. **Digest**: requests within about 5 minutes become one email listing everything still outstanding, built from live data at send time; dropped if nothing is outstanding or the application closed | Applicant |
| 3 | `membership.application.ready_for_payment` | Status becomes Payment Required | Applicant |
| 4 | `membership.application.payment_confirmed` | Only when the settlement transaction marks the application payment confirmed (all conditions met) | Applicant |
| 5 | `membership.application.approved` | Approval, with the activation link (72 h, single use) | Applicant |
| 6 | `membership.application.rejected` | Rejection | Applicant |
| 7 | `rental.booking.submitted` | Rental request received | Requester only |
| 8 | `rental.status.updated` | Rental status changed | Requester only |
| 9 | `rental.schedule.updated` | Schedule created or changed: **actual confirmed** start/end date and time, equipment, operator, location, "Instructions for the customer", reference, status link. Re-saving an unchanged schedule sends nothing | Requester only |
| 10 | `rental.payment.confirmed` | Payment confirmed (PayMongo or manual); one email per payment whichever path confirms it | Requester only |
| 11 | `pos.cash.instructions` | Cash order placed; dropped if the order is no longer Pending Payment | Customer |
| 12 | `pos.payment.receipt` | Only after payment is confirmed **and** the official receipt is Generated; contains a secure link to the receipt PDF | Customer |

Internal notes never appear in customer emails. The Chairman rental schedule form has two separate fields:
**Instructions for the customer** (emailed) and **Internal schedule instructions** (staff only).

## Receipts

* Cash receipts use the shared payment-receipt mechanism: one official receipt per payment, new numbers `PAY-RCPT-...`;
  historical `POS-RCP-...` numbers are unchanged.
* The email link is `<API_PUBLIC_URL>/api/public/receipts/<token>`. The token is an HMAC-signed, 30-day link that carries
  only the receipt id and expiry. The API checks the receipt is Generated, not reversed and its document active, then
  **streams the PDF**; no storage URL is ever exposed. Responses are `no-store`, `no-referrer`, `noindex`; every failure
  returns the same generic 404; access is rate limited and audited without the token. Request logs redact the token.
* If receipt generation fails after the payment is confirmed, the API retries (15 s, 1 min, 5 min) and Bookkeepers get an
  in-app alert after 3 failed attempts. The email is queued in the same transaction that marks the receipt Generated, so a
  retry can never produce two receipts or two emails. The cron worker needs no storage (R2) keys.

## Activation links

* Stored only encrypted (AES-256-GCM, key derived from `EMAIL_SECRET_KEY`, bound to the row) and erased the moment the email
  is sent, fails permanently or is cancelled. Never logged, never in notifications or audit entries.
* `expires_at` (72 h) is **enforced at redemption** for both activation tables; links are single use.
* `POST /api/public/membership/activation/request-replacement` (rate limited, generic 202 answer) issues a fresh link to an
  eligible pending member (10-minute cool-down, earlier links stop working). The activation page offers it when a link is
  expired or used.

## Database

Migration: `server/database/migrations/20261104_email_outbox.sql` (additive, idempotent; creates `email_outbox`,
`email_outbox_attempts`, `email_webhook_events`; changes no existing table).

```
npm run db:migrate:email-outbox          # where tsx is available
node server/dist/scripts/migrate-email-outbox.js   # on the host, after build:api
```

or paste the SQL file into phpMyAdmin. Migrations never run at API startup. Take a database backup first.

## Environment variables

**Main API app** (`server/.env` locally; the cPanel Node.js app's environment in production):

| Variable | Notes |
| --- | --- |
| `EMAIL_DELIVERY` | `resend` to enable. Leave `smtp` until the rollout reaches that step. |
| `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS` | `TrackCOOP`, `notifications@notify.nffac.trackcoop.online` |
| `EMAIL_REPLY_TO` | `support@nffac.trackcoop.online` |
| `RESEND_API_KEY` | Sending-access key for the notify domain. **Secret.** |
| `RESEND_WEBHOOK_SECRET` | Resend webhook signing secret (`whsec_...`). **Secret.** API only. |
| `EMAIL_SECRET_KEY` | 32 random bytes, base64. **Secret.** Must be identical in the API and the worker file. |
| `API_PUBLIC_URL` | Public https URL of the API (receipt links, webhook). |
| `EMAIL_RELEASE_STAGE` | `restricted` (default) or `general`. |
| `EMAIL_RECIPIENT_ALLOWLIST` | Test addresses for the restricted stage. |

**Worker env file** (path in `TRACKCOOP_WORKER_ENV_FILE`; cPanel cron does not inherit the Node.js app's variables). Only
these names are read from it; anything else in the file is ignored: `NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `DB_SSL`, `DB_SSL_CA_PATH`, `DB_CONNECTION_LIMIT`, `EMAIL_DELIVERY`, `EMAIL_FROM_NAME`,
`EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO`, `RESEND_API_KEY`, `EMAIL_SECRET_KEY`, `EMAIL_RELEASE_STAGE`,
`EMAIL_RECIPIENT_ALLOWLIST`, `FRONTEND_URL`, `API_PUBLIC_URL`. It does **not** need `RESEND_WEBHOOK_SECRET`, PayMongo or
storage credentials. The file must be mode `600` and owned by the cron user, or the worker refuses to start. Real
process variables always win over the file. Never put these values in the cron command, a GitHub workflow or a public path.

Check a configuration without sending anything (prints booleans only):

```
TRACKCOOP_WORKER_ENV_FILE=/home/ACCOUNT/trackcoop-worker.env \
  /home/trackcoo/nodevenv/trackcoop-api-production/24/bin/node ~/trackcoop-api-production/server/dist/scripts/run-email-outbox.js --check-config
```

## Release stages (testing without emailing real people)

1. **restricted** (default): only addresses in `EMAIL_RECIPIENT_ALLOWLIST` are queued. Everyone else's email is stored as
   `Blocked` and is never retried. Each row is stamped with its stage.
2. Moving to **general** cancels still-pending rows queued under the old stage and does **not** release `Blocked` rows, so
   the test-stage backlog can never leak out. Releasing is an explicit action and refuses rows older than 24 h:
   `... run-email-outbox.js --release-blocked=12,13`.

Suggested rollout: migrate -> deploy API with `EMAIL_DELIVERY=smtp` (no behaviour change) -> set worker file + Resend
webhook -> `EMAIL_DELIVERY=resend` with `restricted` and your own addresses -> exercise all 12 scenarios -> `general`
-> later, remove legacy SMTP in a separate change.

## Cron (Verpex / cPanel) - proposed, not yet created

```
* * * * * TRACKCOOP_WORKER_ENV_FILE=/home/ACCOUNT/trackcoop-worker.env /home/trackcoo/nodevenv/trackcoop-api-production/24/bin/node /home/ACCOUNT/trackcoop-api-production/server/dist/scripts/run-email-outbox.js >> /home/ACCOUNT/logs/email-worker.log 2>&1
```

Each run is short (about 45 s budget), prevents overlap with a database lock, recovers rows left by a crash, and prints
counts only (`claimed`, `sent`, `retried`, `failed`, ...). Exit code 2 means the provider rejected the key/account.
If the host does not allow a one-minute cron, use every 2 to 5 minutes; delivery is simply later.
An HTTPS-triggered worker endpoint is a documented fallback only and is **not** implemented.

## Operating it

Useful read-only queries:

```sql
SELECT status, COUNT(*) FROM email_outbox GROUP BY status;
SELECT email_outbox_id, event_key, status, attempt_count, last_error_code, next_attempt_at FROM email_outbox
 WHERE status IN ('Pending','Failed') ORDER BY email_outbox_id DESC LIMIT 50;
SELECT delivery_status, COUNT(*) FROM email_outbox WHERE status = 'Sent' GROUP BY delivery_status;
```

* `Failed / needs_review`: check the message in the Resend dashboard; if it was not sent, re-queue it by hand.
* `Failed / retries_exhausted` or `Failed` with a recipient error: fix the address and re-trigger the business action.
* `bounced` / `complained`: the address is bad or opted out; do not resend.

### Rollback

Set `EMAIL_DELIVERY=smtp` (or `disabled`) and restart the API; remove the cron line. Queued rows stay in the table and are
simply not sent. The migration is additive and can stay in place.

## Credentials

Resend and webhook secrets are entered by the owner in Resend and in the cPanel Node.js settings; they are never committed,
printed or logged. `npm run security:scan` now also flags Resend key patterns. Rotation of any previously exposed
credential is a separate decision and is not performed by this change.

## Tests

* `server/src/modules/email/*.test.ts`: Resend client and error classification, signature verification, crypto, enqueue
  decisions (allowlist, blocked, skipped, duplicate, secrets), rendering of all twelve messages, public receipt endpoint.
* `email-outbox.integration.test.ts` and `membership-activation.integration.test.ts` run against a **throwaway local MySQL
  only** (they refuse any database not named `*_test`): transaction commit/rollback, duplicate suppression, concurrent
  workers, crash recovery, retry/backoff, ambiguity window, stages and `Blocked`, digest coalescing, delivery-status
  ordering, secrets at rest, activation expiry/single use/replacement. Enable with
  `EMAIL_TEST_DB_NAME=trackcoop_email_test EMAIL_TEST_DB_PORT=<port> npm run test:api` (load the base schema and the
  outbox migration first). Without those variables they are skipped.
* Not covered automatically: real Resend delivery, real webhook delivery, and the production cron environment. Verify these
  in the restricted stage.
