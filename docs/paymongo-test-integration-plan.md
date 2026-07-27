# PayMongo Test Integration Plan

Phase 0 audit and implementation plan for TrackCOOP PayMongo test-mode Hosted Checkout integration.

## Scope

This phase does not implement PayMongo code, schema changes, routes, or environment changes. It documents the current repository state, baseline check results, and the phased integration approach.

Future schema work must create a new SQL migration and update `server/database/TrackCOOP_MAIN_Database.sql` so fresh installs include the new tables. Future PayMongo environment variables must be added only to `server/.env.example`; real `server/.env` values stay local and are updated manually by the operator.

## Verified PayMongo References

Official PayMongo documentation was checked on 2026-07-26 for the required source-of-truth items:

- Hosted Checkout V2 endpoint: `https://docs.paymongo.com/reference/create_checkout_sessions_2`
- Webhook setup and `Paymongo-Signature`: `https://docs.paymongo.com/docs/developer-tools-webhook-setup-management`
- Webhook retries and delivery behavior: `https://docs.paymongo.com/docs/developer-tools-webhooks-key-concepts`
- Webhook resource and checkout event support: `https://docs.paymongo.com/reference/webhook-resource`
- Test mode keys and cards: `https://docs.paymongo.com/docs/payment-acceptance-testing`
- Idempotency and security best practices: `https://docs.paymongo.com/docs/development-best-practices`

Integration rules from those references:

- Checkout sessions use `/v2/checkout_sessions`.
- The backend must authenticate using the secret key with HTTP Basic Auth.
- Amounts are integer centavos and currency must be PHP.
- Browser success redirects are not proof of payment.
- `checkout_session.payment.paid` is the settlement source of truth.
- Webhook signature verification must use the unmodified raw request body.
- The `Paymongo-Signature` header contains `t`, `te`, and `li`; test mode compares `te`.
- Webhook processing must be idempotent because deliveries can retry.

## Current State

The application is a Next.js App Router frontend with an Express 5 TypeScript API under `server/`. It uses MySQL through `mysql2/promise`, Zod validation, opaque cookie sessions, RBAC, audit logs, and notifications.

The latest `main` branch schema currently has 40 expected tables in `server/src/db/expected-tables.ts`. `TrackCOOP_Table_Reference_Only.sql`, `server/database/TrackCOOP_MAIN_Database.sql`, `server/database/testing_data_and_admin_settings.sql`, database docs, and historical migrations are present.

`server/src/app.ts` currently mounts request IDs, request logging, security middleware, CORS/origin checks, JSON parsing, URL-encoded parsing, cookies, static uploads, and then API routes. A PayMongo webhook route that needs `express.raw({ type: "application/json" })` must be mounted before the global JSON parser and before browser-origin mutation checks that are not relevant to PayMongo webhooks.

`server/src/config/env.ts` validates API/server settings. `server/src/config/database.ts` validates database settings separately. Future PayMongo config should be validated in the server config layer, with keys optional while disabled and strict test-key enforcement when enabled.

`src/lib/api-client.ts` already provides typed frontend API calls with credentialed requests, JSON/FormData handling, success-envelope validation, and `ApiClientError`.

## Current Payment Model

`payment_references` is the shared payment record and already supports these purposes:

- Associate Membership Fee
- Share Capital
- Rental
- POS/Product
- Preorder
- Bulk Order
- Document/Certificate
- Other

Current validation statuses are `Pending`, `Validated`, `Rejected`, and `Needs Clarification`. Phase 1 must extend this with `Reversed` and add gateway fields without destructive SQL.

Payment references already link downstream through:

- `membership_application_requirements.payment_reference_id`
- `share_capital_payments.payment_reference_id`
- `financial_records.payment_reference_id`
- `pos_sales.payment_reference_id`
- `rental_bookings.payment_reference_id`
- `rental_pos_records.payment_reference_id`

The current generic payment reference module supports list, create, update, validate, reject, and clarification. It uses parameterized SQL and transactions for write operations, and it inserts audit logs. Its validation service currently changes payment status only; it does not consistently post downstream business effects.

Bookkeeper routes can validate/reject/request clarification. Chairman routes expose payment oversight, but current payment-reference routes also allow chairman create/update through shared staff route permissions; future work should preserve Chairman read-only payment oversight for the completed PayMongo/payment-validation workflow.

## Membership Applications And Requirements

Public membership applications are protected by application code plus tracking token. The public status/payment flow already avoids exposing the tracking token in URLs by using local verification state.

Membership approval checks already require validated payment references linked through `membership_application_requirements`:

- Associate Membership Fee uses the configured fee amount, currently PHP 200 in settings/test data.
- True Member share capital checks initial, required, and maximum capital settings.

The current membership payment flow creates a `payment_references` row and a `membership_application_payments` row for manual proof submission, then Bookkeeper validation updates the payment reference, application payment status, application status, financial records, audit logs, and notifications. This overlaps with the generic payment-reference validation module and must be consolidated into a shared settlement engine in later phases.

## Share Capital And Finance

`share_capital_payments` already links to `payment_references` and supports `Pending`, `Validated`, and `Reversed` payment states. The service enforces the PHP 15,000 maximum only against validated totals, allowing pending records above the cap until validation.

`financial_records` already links to `payment_references` and supports posting, voiding, correction, reversal references, audit logs, and source module/source record tracking. Existing finance repository conventions should be reused for PayMongo and manual settlement posting rather than inserting ledger rows ad hoc from multiple modules.

## POS And Inventory

Member POS checkout can create online payment references and pending POS sales. Staff confirmation currently validates the related payment reference, marks the sale paid, creates a financial income record, and deducts inventory through `inventory_movements`.

Product stock is calculated from inventory balances and pending payment reservations. PayMongo settlement must not deduct inventory twice. Later POS work should either route settlement through one central service or make existing confirm endpoints call the same settlement path.

## Rental

Rental payment proof submission creates `payment_references`, updates `rental_bookings.payment_reference_id`, and stores payment metadata. Rental validation updates payment reference status, booking payment status, rental purpose/status metadata, finance records, notifications, and audit logs.

Rental payment state uses booking payment statuses such as `Unpaid`, `Partially Paid`, `Paid`, and `Refunded`. Later PayMongo settlement must lock the booking/payment rows, calculate outstanding balance from trusted database data, and post exactly once.

## Communication And Audit

Notifications are stored in `notifications` and exposed through `server/src/modules/communication`. Several modules also insert notifications directly with role/user targeting. Payment settlement should queue safe notifications for applicants, members, Bookkeepers, and Chairmen where appropriate.

Audit logs are already inserted throughout membership, payment-reference, finance, rental, POS, and communication flows. Future PayMongo work must audit only safe identifiers and must not log raw webhook bodies, signatures, secrets, cookies, tracking tokens, or API keys.

## Architecture Plan

Add a dedicated `server/src/modules/paymongo/` module in later phases with:

- `paymongo.types.ts`
- `paymongo.schema.ts`
- `paymongo.client.ts`
- `paymongo.repository.ts`
- `paymongo.service.ts`
- `paymongo.controller.ts`
- `paymongo.routes.ts`
- focused API tests

Use native `fetch` from Node instead of adding an HTTP dependency unless the project introduces a standard HTTP client before implementation.

Add one reusable payment settlement service used by both:

- PayMongo verified webhooks
- Bookkeeper manual validation

Suggested interface:

```ts
settlePaymentReference({
  paymentReferenceId,
  validationSource,
  actorUserId,
  gatewayEventId,
  gatewayDetails,
})
```

The service must own row locks, idempotency, downstream posting, validation history, audit logs, notifications, rollback handling, and duplicate prevention.

## Checkout Flow

1. Frontend requests checkout for a known application/member/payment reference.
2. Backend authenticates the user or public tracking token.
3. Backend loads trusted amount, purpose, payer/member/application/entity from the database.
4. Backend rejects paid, reversed, conflicting, or ineligible obligations.
5. Backend creates or reuses a pending `payment_references` row.
6. Backend creates or reuses an active PayMongo Hosted Checkout session.
7. Backend stores safe gateway fields and idempotency key.
8. Backend returns only the checkout URL and safe TrackCOOP reference.
9. Browser redirects to PayMongo.
10. Success/cancel pages show status only; they never validate payment.

## Webhook Flow

1. PayMongo posts to `POST /api/webhooks/paymongo`.
2. Express uses raw body middleware for that route before JSON parsing.
3. Verify `Paymongo-Signature`, timestamp tolerance, and test-mode signature.
4. Reject invalid signatures with 401.
5. Parse JSON only after signature verification.
6. Accept only `checkout_session.payment.paid` test-mode events.
7. Hash the raw payload and insert a safe event summary into `payment_gateway_events`.
8. Return 200 for duplicate fingerprints without posting again.
9. Lock and settle the linked TrackCOOP payment reference transactionally.
10. Mark event processed, ignored, or failed with sanitized status.

## Settlement Matrix

| Purpose | Related entity | Required posting |
| --- | --- | --- |
| Associate Membership Fee | Membership application | Validate reference, verify fee requirement, create finance income, notify, audit; do not approve automatically |
| Share Capital | Application/member | Validate reference, create one share-capital payment, enforce max, verify capital requirement where applicable, create finance entry, notify, audit |
| Rental | Booking | Update paid amount/status from trusted balance, create rental/finance income once, notify, audit |
| POS/Product | Sale | Update payment/sale status, create finance income, deduct inventory exactly once, notify, audit |
| Preorder | Sale/order | Update payment/status while preserving fulfillment policy, inventory once, notify, audit |
| Bulk Order | Sale/order | Update payment/status while preserving approval/fulfillment policy, inventory once, notify, audit |
| Document/Certificate | Request/document | Mark fee paid only where an existing module supports it |
| Other | Explicit relation | No automatic posting without a known rule; leave for Bookkeeper review |

## Permissions

- Public membership checkout requires application code plus `X-Application-Tracking-Token`.
- Authenticated checkout requires payment owner, Bookkeeper, or Chairman support access.
- Bookkeeper validates, rejects, requests clarification, and reverses.
- Chairman payment pages remain read-only oversight.
- Members can pay only their own eligible obligations.
- Webhooks are authenticated by PayMongo signature, not browser sessions.

## Migration Plan

Phase 1 should create `server/database/migrations/20260726_add_paymongo_test_gateway.sql` with non-destructive changes only. It should also update:

- `server/database/TrackCOOP_MAIN_Database.sql`
- `TrackCOOP_Table_Reference_Only.sql`
- `server/src/db/expected-tables.ts`
- `server/database/README.md`
- other database documentation as needed

Expected table count becomes 42 after adding:

- `payment_gateway_events`
- `payment_validation_history`

Phase 1 should extend `payment_references` with gateway channel/environment/status fields, checkout/payment IDs, paid/webhook timestamps, fee/net amounts, idempotency key, validation source, and unique constraints. It should extend `validation_status` to include `Reversed`.

No `DROP`, `TRUNCATE`, triggers, stored procedures, production migration auto-run, or destructive updates.

## Environment Plan

Phase 1 should add the PayMongo variables from the master prompt to `server/.env.example` only. Real secrets must never be committed and must not be added to root `.env`, root `.env.example`, or `server/.env` by Codex.

Rules to enforce in server validation:

- PayMongo remains disabled by default.
- Keys are optional while disabled.
- Enabled test mode requires an `sk_test_` secret key.
- Development/test must reject `sk_live_`.
- Webhook secret is required when webhooks are enabled.
- Configured payment method types must come from documented/enabled PayMongo methods.
- No secret values are logged or returned to the client.

The current `server/.env.example` should also be reviewed in a later housekeeping step because it appears to contain non-placeholder-looking database values. Do not repeat those values in documentation or reports.

## Tests Plan

Future phases should add API unit/integration coverage for:

- centavo conversion
- Basic Auth header creation without leaking the secret
- V2 checkout URL and response validation
- timeout and PayMongo API errors
- idempotency and duplicate checkout clicks
- disabled gateway and live-key rejection
- public tracking-token authorization
- ownership and RBAC
- raw webhook body signature verification
- missing/invalid/stale signatures
- test/live mode rejection
- malformed/unsupported webhook payloads
- amount/currency mismatch
- duplicate webhook event fingerprint
- rollback and failed-event marking
- one requirement, finance record, share-capital row, audit log, notification, rental/POS/inventory posting
- manual validation using the same settlement service
- Bookkeeper reversal and no deletion of validated payment records

UI coverage should include accessible dialogs, loading/error/retry states, no `alert()`/`confirm()`, no overflow, and no display of secrets or raw gateway payloads.

## Rollback Plan

The migration should be forward-only and non-destructive. Operational rollback for test mode should disable PayMongo through `PAYMONGO_ENABLED=false`, stop creating checkouts, and leave existing payment references/events for reconciliation.

Business rollback after validation should use payment reversal records and finance/share-capital/rental/POS reversal logic. Validated payments must not be deleted.

## Security Risks

- Raw webhook body must be preserved for signature verification.
- Success redirect must never mutate payment state.
- Metadata must contain strings only and must not include sessions, passwords, tracking tokens, cookies, or unnecessary personal data.
- PayMongo secrets must remain backend-only and must not use `NEXT_PUBLIC_`.
- Webhook event storage must keep hashes and safe summaries only, not raw payloads.
- All settlement writes must use transactions, row locks, parameterized SQL, and idempotent checks.
- POS inventory and financial postings need explicit duplicate prevention.
- Manual validation and PayMongo validation must converge on the same settlement service.

## Conflicts And Risks Found

- Baseline checks are not clean on latest `main`.
- `npm install` reports 12 high-severity dependency audit findings.
- `npm run typecheck` currently fails because user-service test doubles are missing current interface methods.
- `npm run lint` currently fails with 37 errors and 33 warnings unrelated to PayMongo.
- `npm run test:api` currently fails three test files because app imports require database env variables in this clean worktree.
- `npm run build` compiles but fails during route data collection because database env variables are missing.
- Payment validation logic is duplicated across generic payment references, membership payments, POS confirmation, and rental payment validation.
- Some current UI paths use browser `confirm()`, which the master prompt forbids for future PayMongo/payment-validation actions.
- Current manual validation status changes do not consistently drive downstream posting through one transaction.
- The future webhook route needs middleware ordering changes in `server/src/app.ts`.

## Phase 0 Baseline Results

- `npm install`: completed; added 558 packages, audited 559 packages, reported 12 high-severity vulnerabilities.
- `npm run typecheck`: failed in `typecheck:web`; TypeScript errors in user module tests where mocks are missing `exportUsersCsv`, `bulkAction`, and `getAuditLogs`.
- `npm run lint`: failed with 70 problems: 37 errors and 33 warnings.
- `npm run test:api`: failed with 65 tests total, 62 passing, 3 failing due missing database env variables during app import.
- `npm run build`: failed after successful Next compilation because route data collection imported database config without required database env variables.

## Phase 0 Decision

Proceed to Phase 1 only after accepting that the branch baseline currently has unrelated failures on latest `main`. Phase 1 should limit itself to schema and environment planning/implementation and must not start checkout or webhook logic.
