# PayMongo Core Completion Plan

Branch: `fix/paymongo-core-completion`
Phase: A — Current-state audit and stabilization plan
Scope: Planning only. No functional PayMongo code, UI code, tests, or migrations are implemented in this phase.

## 1. Phase A baseline

- Repository: `alfredc-12/TrackCOOP_Main`
- Base branch: latest `main`
- Phase branch: `fix/paymongo-core-completion`
- Starting commit inspected for Phase A: `fdb8002b8abe09bfa23043349ae05e108e2eb093`
- Prior PayMongo Phase 5 commit inspected: `7dd7f9775912f94a517bbf9b9db564dd4f797439` (`feat: complete bookkeeper payment validation`)
- The earlier PayMongo implementation is treated as baseline work. This plan does not restart the original PayMongo phases.

## 2. Current implementation inventory

### Server application wiring

- The Express app mounts the PayMongo webhook route before the JSON body parser, which preserves the raw request body for signature verification.
- The API exposes PayMongo routes, payment-reference routes, share-capital routes, and finance routes under `/api`.

### Environment and configuration

- PayMongo is disabled by default.
- PayMongo mode defaults to `test`.
- The current environment schema validates `PAYMONGO_ENABLED`, `PAYMONGO_MODE`, `PAYMONGO_API_BASE_URL`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, webhook tolerance, configured payment methods, fee passing, and browser return URLs.
- Current supported PayMongo payment method configuration is limited to `card`.
- Live mode and live secret keys are rejected outside production.
- `server/.env.example` contains placeholder PayMongo variables and does not contain real keys.
- `PAYMONGO_CHECKOUT_REUSE_MINUTES` is not yet present.
- A configured PayMongo system actor variable is not yet present.

### PayMongo checkout client

- The backend creates V2 Hosted Checkout Sessions through `POST /v2/checkout_sessions`.
- The client uses HTTP Basic Authentication with the server-side secret key.
- Amounts are converted to integer centavos.
- Metadata is stringified before sending to PayMongo.
- Checkout Session creation uses an idempotency key.
- The checkout response currently maps the returned payment ID from `payments?.[0]` when present.

### Checkout routes

- Public membership application checkout route exists:
  - `POST /api/paymongo/checkouts/membership-applications/:applicationCode`
  - protected by `X-Application-Tracking-Token` at the service layer.
- Authenticated payment-reference checkout route exists:
  - `POST /api/paymongo/checkouts/payment-references/:paymentReferenceId`
  - currently available to Chairman, Bookkeeper, and Member roles if authorization to the payment reference passes.
- Authenticated status route exists:
  - `GET /api/paymongo/payments/:paymentReferenceId/status`
  - it returns saved TrackCOOP status rather than an upstream PayMongo inquiry.

### Public membership application checkout

- Public applicants can start an Associate Membership Fee checkout.
- Public True Member applicants can start a Share Capital checkout.
- The service checks the application tracking token.
- It checks the Associate fee against current system settings.
- It checks share-capital amount against the initial share-capital setting and maximum share-capital setting.
- It currently prepares one payment reference linked through the membership requirement row.

### Webhook verification and processing

- The webhook code parses `Paymongo-Signature` with timestamp `t`, test signature `te`, and live signature `li`.
- It validates timestamp tolerance.
- It signs `${timestamp}.${rawBodyUtf8}` with HMAC SHA-256.
- It uses timing-safe comparison.
- It parses JSON only after signature verification.
- It stores a payload SHA-256 hash, not the raw body.
- It currently parses the whole webhook against the paid Checkout Session schema before checking whether the event is supported.
- It currently selects `checkoutAttributes.payments[0]` as the payment.

### Gateway event storage

- `payment_gateway_events` stores the TrackCOOP payment reference, gateway name, event type, fingerprint, checkout ID, payment ID, payment intent ID, livemode flag, payload SHA-256, processing status, error code, and error message.
- Current processing states are `Received`, `Processed`, `Ignored`, and `Failed`.
- There is no `Processing` state yet.
- There is no retry count yet.
- There is no normalized safe event summary for unsupported events yet.
- There is no dedicated safe error field separate from internal error detail yet.

### Settlement foundation

- A shared settlement repository exists and is already used by PayMongo webhook settlement and manual Bookkeeper validation.
- The current settlement flow locks the payment reference, validates source/channel compatibility, validates PayMongo amount and currency, records validation history, updates the payment reference, posts membership settlement side effects, writes an audit log, and marks the gateway event processed when present.
- Manual validation of manual channels is routed through the same settlement service.
- PayMongo settlement uses `actorUserId: null`, but the current settlement repository falls back to selecting an active Bookkeeper or Chairman when a non-null user is required by downstream finance records.

### Membership approval and conversion

- Public membership applications include Associate Membership Fee and Initial Share Capital requirements.
- Approval checks verified requirements, checks the Associate fee total, checks validated Initial Share Capital total, creates the member profile, and marks the application approved.
- Approval currently calculates fee and capital through the single requirement-linked payment reference.
- Approval does not yet backfill pre-approval Share Capital payment references into `share_capital_payments` after a member profile is created.

### Bookkeeper and Chairman UI

- The Bookkeeper payment-validation page uses `PaymentReferencesView`.
- Chairman uses the same view in read-only mode.
- Bookkeeper actions include validate, reject, request clarification, edit, reverse, and PayMongo status reload.
- The current UI has one detail dialog with direct action buttons, a reason field, and a reversal confirmation field.
- The PayMongo status action is labeled `Refresh Status`, but the backend route currently returns saved TrackCOOP status only.
- Filtering includes search, validation status, purpose, channel, source, gateway/manual, date range, and minimum amount.
- Maximum amount and explicit pagination controls are not yet visible in the inspected UI.

### Tests

- API tests currently cover PayMongo client basics, signature validation, basic paid-webhook settlement, ignored and duplicate events as current behavior, settlement failure marking, and manual validation through the shared settlement service.
- The current tests do not yet cover failed-event retry, paid payment not at index zero, no paid payment, ignored-event storage, concurrent processing, checkout-attempt reuse/renewal, multiple application capital installments, approval backfill, Member-owned share-capital checkout, receipt idempotency, or Bookkeeper retry controls.

## 3. Confirmed gaps and risk areas

1. Duplicate webhook handling is too coarse. The current insert returns duplicate and the service returns immediately without differentiating `Processed`, `Ignored`, `Received`, `Processing`, or `Failed` events. A `Failed` event cannot be safely retried from stored normalized details.
2. The webhook assumes the successful PayMongo payment is `payments[0]`. The client also maps returned payment ID from `payments?.[0]`.
3. Correctly signed unsupported events are not stored as `Ignored`. They are returned as ignored before a gateway event is inserted.
4. Generic signed events are parsed against the paid Checkout Session schema before event type branching, so unsupported but valid PayMongo events may fail validation instead of being stored safely as ignored.
5. Unknown internal error messages may be stored in `payment_gateway_events.error_message` because the safe error helper returns `error.message` for generic `Error` objects.
6. Unsupported payment purposes are not blocked consistently at both boundaries. Checkout eligibility does not explicitly restrict PayMongo checkout to Associate Membership Fee and Share Capital. Settlement updates a payment reference to `Validated` before conditionally posting membership side effects only for the two supported purposes.
7. Membership application Share Capital is limited by the single `membership_application_requirements.payment_reference_id` linkage. Once a requirement has a payment reference, the repository returns that existing reference instead of creating a new installment reference.
8. Application capital reference numbers and idempotency keys are stable per application/purpose rather than attempt/installment-specific.
9. Checkout attempts are not modeled separately. `payment_references` holds gateway checkout convenience fields and one idempotency key, but there is no attempt number, active attempt window, reusable-until timestamp, completed timestamp, or superseded timestamp.
10. Browser cancellation does not validate payment, which is correct, but there is no checkout-attempt lifecycle to safely renew abandoned local attempts.
11. Pre-approval Share Capital is not reliably posted to the member share-capital ledger. `share_capital_payments.member_id` is required, settlement creates capital rows only when `convertedMemberId` already exists, and approval does not backfill missing rows after member creation.
12. True Member approval totals are calculated through the requirement-linked payment reference instead of all validated application-related Share Capital payment references.
13. Receipt generation was not found as an idempotent shared settlement side effect for both manual and PayMongo validated payments.
14. Rejection and clarification transitions use the payment-reference repository transition path, but later phases must verify that every required transition records complete validation history with source, actor, reason, and gateway event when applicable.
15. Automated webhook settlement is attributed through an arbitrary staff fallback when a non-null finance actor is needed. This must be replaced with explicit system attribution.
16. The public application status response exposes requirement-level payment state but not safe aggregate payment information for membership fee, share capital, pending active checkouts, remaining target, remaining maximum, or installment count.
17. Authenticated Member Share Capital checkout is not implemented as a dedicated owner-only route. The generic payment-reference checkout route is not enough because Members should not pass arbitrary member IDs and need a server-created contribution reference.
18. Bookkeeper actions do not yet use separate confirmation dialogs for validate, reject, clarification, reversal, or failed gateway retry.
19. Failed gateway retry is not available as a Bookkeeper-only endpoint or UI action.
20. Chairman read-only behavior exists at the route level for payment references, but later UI/API tests should prove Chairman cannot mutate or retry gateway events.
21. The payment UI has no explicit `PayMongo Test Mode — No real money will be charged` badge in the inspected Bookkeeper payment validation area.
22. The current PayMongo status button should be relabeled `Reload TrackCOOP Status` unless a documented PayMongo inquiry endpoint is implemented later.

## 4. Affected files and areas

### Server core

- `server/src/app.ts`
- `server/src/config/env.ts`
- `server/.env.example`

### PayMongo module

- `server/src/modules/paymongo/paymongo.client.ts`
- `server/src/modules/paymongo/paymongo.controller.ts`
- `server/src/modules/paymongo/paymongo.repository.ts`
- `server/src/modules/paymongo/paymongo.routes.ts`
- `server/src/modules/paymongo/paymongo.schema.ts`
- `server/src/modules/paymongo/paymongo.service.ts`
- `server/src/modules/paymongo/paymongo.settlement.ts`
- `server/src/modules/paymongo/paymongo.types.ts`
- `server/src/modules/paymongo/paymongo.webhook.ts`
- `server/src/modules/paymongo/paymongo.webhook.routes.ts`
- `server/src/modules/paymongo/paymongo.webhook.service.ts`
- `server/src/modules/paymongo/*.test.ts`

### Payment references

- `server/src/modules/payment-references/payment-reference.controller.ts`
- `server/src/modules/payment-references/payment-reference.repository.ts`
- `server/src/modules/payment-references/payment-reference.routes.ts`
- `server/src/modules/payment-references/payment-reference.schema.ts`
- `server/src/modules/payment-references/payment-reference.service.ts`
- `server/src/modules/payment-references/payment-reference.types.ts`

### Membership applications and approval

- `server/src/modules/membership-applications/membership-application.repository.ts`
- `server/src/modules/membership-applications/membership-application.service.ts`
- `server/src/modules/membership-applications/membership-application.types.ts`
- `server/src/modules/membership-applications/membership-application.routes.ts`
- `server/src/modules/membership/membership.repository.ts`

### Share capital, finance, and receipts

- `server/src/modules/share-capital/**`
- `server/src/modules/finance/**`
- Generated receipt/document helpers, where maintained
- Protected document storage code, if receipts are generated through the documents module

### Web UI

- `src/features/finance/FinanceViews.tsx`
- `src/features/finance/finance-api.ts`
- Public application status/payment components
- Member portal share-capital pages/components
- Payment return pages

### Database and checks

- Forward-only migrations under `server/database/migrations/**`
- `server/database/TrackCOOP_MAIN_Database.sql`
- `server/src/db/expected-tables.ts`
- Migration documentation and database setup documentation

## 5. Proposed schema changes

All schema changes must be forward-only, non-destructive, manually applied, and compatible with databases that already applied the earlier PayMongo migration.

### 5.1 `payment_gateway_events`

Add safe normalized fields when not already present:

- `gateway_event_object_id`
- `gateway_reference_number`
- `gateway_amount`
- `gateway_currency`
- `gateway_payment_status`
- `gateway_payment_method`
- `gateway_fee_amount`
- `gateway_net_amount`
- `gateway_paid_at`
- `retry_count`
- `processing_started_at`
- `last_attempt_at`
- `safe_error_message`

Extend event state handling with `Processing` if compatible with the existing enum strategy.

Use a unique PayMongo event object ID when PayMongo supplies one. Keep the current deterministic fingerprint fallback for events without a usable event ID, but include enough safe envelope information to prevent collision surprises.

### 5.2 `payment_gateway_checkout_attempts`

Create a new table to store Checkout Session attempts instead of overloading `payment_references` with the active session lifecycle.

Recommended fields:

- `payment_gateway_checkout_attempt_id`
- `payment_reference_id`
- `gateway_name`
- `attempt_number`
- `idempotency_key`
- `gateway_checkout_id`
- `checkout_url`
- `gateway_status`
- `gateway_environment`
- `amount`
- `currency`
- `created_at`
- `updated_at`
- `last_checked_at`
- `reusable_until`
- `superseded_at`
- `completed_at`

Required constraints:

- unique idempotency key
- unique gateway checkout ID when not null
- unique payment reference plus attempt number
- foreign key to payment reference
- indexes for active-attempt lookup and retry/reload screens

### 5.3 Application share-capital installment sequencing

Use either row locks on application payment-reference rows or a dedicated sequence table to create unique application capital references safely under concurrency.

Target reference shape:

```text
MEM-APP-2026-000001-CAP-001
MEM-APP-2026-000001-CAP-002
MEM-APP-2026-000001-CAP-003
```

Do not use an unlocked `COUNT(*) + 1` pattern.

### 5.4 Receipt status and protected receipt linkage

If the current receipt/document architecture does not already support one protected receipt per validated payment reference, add the smallest compatible receipt-processing status and linkage needed to support:

- one receipt per payment reference
- protected storage
- idempotent generation retry
- safe Bookkeeper visibility when PDF generation fails

Avoid rolling back a real validated payment because of filesystem or PDF generation failure.

### 5.5 System actor support

Because `financial_records.recorded_by` is currently non-null, automated webhook settlement needs an explicit compatible actor design.

Preferred decision for later implementation:

1. If finance/audit code can safely support null human actor fields, use nullable actor fields plus explicit source `PayMongo Webhook`.
2. If non-null actor fields remain required, add `PAYMONGO_SYSTEM_ACTOR_USER_ID` and validate that it points to a noninteractive service account.
3. Do not silently fall back to the first active Bookkeeper or Chairman.

## 6. Event lifecycle design

1. Receive raw webhook request.
2. Verify `Paymongo-Signature` using raw body, timestamp tolerance, mode-specific signature key, and timing-safe comparison.
3. Parse a generic trusted envelope first:
   - event object ID
   - event type
   - event livemode
   - event data object type
   - event data object ID
4. Store a safe gateway event summary and payload hash.
5. If event type is unsupported, mark `Ignored`, return HTTP 200, and do not settle.
6. If event type is `checkout_session.payment.paid`, parse the detailed Checkout Session payload.
7. Select the actual paid payment by normalized `status = paid`; do not rely on index zero.
8. Validate mode, currency, amount, reference number, metadata, checkout ID, payment ID, and supported purpose.
9. Transition event to `Processing` while settlement is in progress.
10. Use the central settlement workflow.
11. Mark event `Processed` on success.
12. Mark event `Failed` with a safe code/message on recoverable failure.
13. Allow Bookkeeper retry only for previously verified, stored `Failed` events.

Duplicate behavior:

- `Processed`: return success duplicate; do not post again.
- `Ignored`: return success ignored; do not post.
- `Received` or `Processing`: prevent concurrent settlement; return a safe retry-later or accepted response according to implementation design.
- `Failed`: lock event, increment retry count, revalidate stored normalized fields, and retry settlement idempotently.

## 7. Checkout-attempt lifecycle design

1. User requests checkout.
2. Backend loads and locks the payment obligation or attempt sequence.
3. Backend verifies the payment is eligible:
   - pending or otherwise eligible
   - not Validated
   - not Reversed
   - supported purpose only
   - server-controlled amount
   - owner/tracking token authorization
4. If a reusable active attempt exists, return its saved checkout URL and do not call PayMongo again.
5. If no reusable attempt exists, create a new attempt number and new idempotency key.
6. Call PayMongo Hosted Checkout V2.
7. Store the attempt and copy safe convenience fields to `payment_references`.
8. Browser success/cancel pages must not validate payment.
9. Webhook remains the payment source of truth.
10. Attempts expire locally based on `PAYMONGO_CHECKOUT_REUSE_MINUTES` unless current PayMongo documentation supplies a definitive Checkout Session expiration model.

## 8. Installment model

### Associate Membership Fee

- One obligation per application.
- Amount is PHP 200 unless the existing system settings are the established source of truth.
- Once validated, do not create another fee payment reference.
- Abandoned or expired checkouts may create a new checkout attempt for the same fee payment reference.

### Application Share Capital

- A True Member application may create multiple Share Capital payment references.
- Each installment must have a unique reference number.
- The first contribution must meet the configured initial requirement of PHP 1,500.
- Later installments may be positive amounts consistent with cooperative rules and must not force PHP 1,500 unless a setting explicitly requires it.
- Aggregate validated application-related Share Capital references as the authoritative pre-approval capital total.
- Do not rely on the single `membership_application_requirements.payment_reference_id` field for totals.
- Prevent overpayment by considering validated capital, reusable active attempts, and the new amount.
- Do not let abandoned attempts permanently reserve capital capacity.

## 9. Pre-approval capital model

Before member approval:

- `payment_references` is the authoritative payment record.
- Application-linked validated Share Capital references represent applicant contributions.
- No fake member ID should be created.
- `share_capital_payments` should not be required until a legitimate member profile exists, unless a later schema change safely supports application-linked capital rows.

During approval:

1. Lock the application.
2. Confirm it has not already been converted.
3. Create or identify the member profile through existing approval logic.
4. Load all validated, non-reversed application-linked Share Capital payment references.
5. Insert missing `share_capital_payments` rows for the new member.
6. Use `payment_reference_id` for idempotency.
7. Do not duplicate rows on approval retry.
8. Preserve original application/payment linkage.
9. Do not create capital from Pending, Rejected, Needs Clarification, or Reversed payments.
10. Do not auto-approve or auto-promote from webhook settlement.

## 10. Member share-capital model

Add a dedicated authenticated Member flow in a later phase:

- Route shape may follow `POST /api/paymongo/checkouts/members/me/share-capital`.
- Do not accept a member ID from the browser.
- Resolve the authenticated user’s member profile server-side.
- Validate role, ownership, positive amount, maximum PHP 15,000, no conflicting active attempt, purpose Share Capital, eligibility, and idempotency.
- Create a new payment reference per contribution.
- On verified webhook settlement, create exactly one member capital row, one finance record, one receipt, one history entry, one notification, and one audit event.
- Do not automatically change membership type.

## 11. Central settlement design

Both verified PayMongo webhook settlement and manual Bookkeeper validation must call one central settlement workflow.

The transaction should:

1. Lock payment reference.
2. Confirm source/channel compatibility.
3. Confirm supported purpose.
4. Validate amount and PHP currency.
5. Validate related entity.
6. Detect prior settlement.
7. Return idempotently for the same already-settled payment.
8. Reject conflicting gateway identifiers.
9. Update payment reference.
10. Insert validation history.
11. Update membership requirement where relevant.
12. Create finance record exactly once.
13. Create share-capital row exactly once when member exists, or defer/backfill safely for pre-approval application capital.
14. Add applicant/member status history.
15. Add notifications exactly once.
16. Add audit log exactly once.
17. Mark gateway event processed when applicable.
18. Commit.

Unsupported purposes must be rejected before validation and before side effects using `PAYMENT_PURPOSE_GATEWAY_NOT_IMPLEMENTED`.

## 12. Receipt design

Receipts should be generated for:

- manual validated membership fee
- manual validated share capital
- PayMongo membership fee
- PayMongo share capital

Design requirements:

- one receipt per payment reference
- protected storage, not static public exposure
- Member-only access when linked to a member
- Bookkeeper-only access for unapproved public applicants
- safe retry when PDF generation fails
- no duplicate receipt on retry
- no rollback of real payment settlement when filesystem/PDF generation fails after database settlement

Required receipt content:

- receipt/reference number
- payer
- member or application reference
- purpose
- amount
- channel
- provider
- validation source
- payment date
- validation date
- TrackCOOP payment reference

## 13. System actor design

Automated settlement must not select a normal staff account silently.

Recommended implementation path:

- First verify whether nullable `recorded_by`, `approved_by`, `validated_by`, and audit fields can safely represent system automation with explicit `validation_source = 'PayMongo Webhook'`.
- If current non-null finance constraints prevent null actors, introduce `PAYMONGO_SYSTEM_ACTOR_USER_ID`.
- Validate that the configured user exists, is active for system use, is noninteractive, and cannot log into the normal portal when applicable.
- Manual Bookkeeper actions must continue to show the authenticated Bookkeeper.
- Webhook actions must show `PayMongo Webhook` and either a null actor or clearly named system service actor.

## 14. UI plan

### Public application status

Show safe aggregate payment data:

- Test Mode badge
- membership fee required, validated, pending, remaining, and status
- share-capital validated, pending, target, maximum, remaining to target, remaining to maximum, and installment count
- latest local checkout state
- ability to start another eligible installment
- clear loading, error, empty, and retry states
- no `Confirmed` label unless webhook/manual validation has actually validated the payment

### Member portal

Add `Pay Share Capital with PayMongo`:

- current validated capital
- active pending PayMongo capital
- amount remaining to PHP 3,000
- maximum PHP 15,000
- chosen amount
- Test Mode notice
- safe checkout state
- payment history or receipt link when supported

### Bookkeeper

Add application dialogs for:

- validate manual payment
- reject payment
- request clarification
- reverse payment
- retry failed gateway settlement

Each dialog should show reference, payer, amount, purpose, channel, current status, and action effect. Rejection, clarification, and reversal require reasons. Reversal requires reference-number confirmation.

Add detail display for checkout attempts, active attempt, gateway event state, retry count, safe error, gateway IDs, paid time, finance posting, receipt state, membership requirement, share-capital posting, validation history, warnings, and Test Mode badge.

Use the exact visible wording:

```text
PayMongo Test Mode — No real money will be charged
```

Use `Reload TrackCOOP Status` unless the backend actually calls a documented PayMongo inquiry endpoint.

### Chairman

Chairman may list, filter, open details, view history, and view safe gateway status. Chairman may not validate, reject, clarify, edit, reverse, or retry gateway settlement.

## 15. Tests to add in later phases

### Webhook and event lifecycle

- valid signature
- missing signature
- invalid signature
- stale signature
- live event in test mode
- generic signed ignored event
- ignored event stored
- paid payment not at index zero
- no paid payment
- duplicate Processed
- duplicate Ignored
- concurrent Processing event
- Failed event retry succeeds
- Failed event retry fails safely
- amount mismatch
- currency mismatch
- reference mismatch
- checkout conflict
- payment conflict
- unknown errors sanitized
- raw payload not stored
- unsupported purpose blocked

### Checkout attempts

- first checkout creates attempt 1
- duplicate click reuses attempt 1
- reusable checkout does not call PayMongo again
- expired attempt creates attempt 2
- new attempt has a new idempotency key
- cancelled page does not mutate payment
- Validated payment cannot create checkout
- Reversed payment cannot create checkout
- unsupported purpose cannot create checkout
- concurrent attempt creation produces one active attempt
- checkout URL is not exposed to unauthorized users

### Application installments and approval

- initial PHP 1,500 installment
- second PHP 1,500 installment
- aggregate PHP 3,000
- unique installment references
- no duplicate reference under concurrency
- Associate application cannot pay capital
- fee is not duplicated after validation
- PHP 15,000 maximum enforced
- abandoned attempt does not permanently block later contribution
- public aggregates safe and correct
- approval creates missing member capital rows idempotently
- reversed payment excluded
- webhook does not approve or promote automatically

### Member checkout

- authenticated Member owner
- no member profile
- Chairman and Bookkeeper denied unless explicitly allowed by a recovery endpoint
- member cannot pay for another member
- positive amount
- PHP 15,000 maximum
- duplicate active checkout
- new contribution after prior validated contribution
- webhook settlement exactly once
- receipt exactly once
- no automatic promotion

### Central settlement, receipts, UI, and authorization

- manual and PayMongo paths use shared settlement
- channel/source mismatch rejected
- one finance row
- one capital row
- one receipt
- one notification
- one audit event
- retry creates no duplicate
- receipt failure does not undo payment
- receipt retry succeeds
- rejection history
- clarification history
- returned-to-pending history
- reversal history and financial adjustment
- confirmation dialog behavior
- duplicate-submission prevention
- Bookkeeper mutation allowed
- Chairman mutation denied
- Member mutation denied
- retry button eligibility
- retry endpoint authorization
- safe error display
- pagination
- amount maximum filter
- application/member search

## 16. Baseline checks

The repository exposes these relevant scripts:

```powershell
npm install
npm run typecheck:api
npm run build:api
npm run typecheck:web
npm run lint
npm run test:api
npm run test:e2e
npm run build
npm run db:check
git diff --check
```

Phase A was completed through the GitHub connector, so these commands were not executed in this environment. They must be run locally or in CI before functional phases are considered verified.

## 17. Migration compatibility plan

- Every migration must be forward-only and non-destructive.
- Do not drop, truncate, or reset payment tables.
- Do not silently run migrations at startup.
- Use idempotent `ALTER TABLE` guards where compatible with the repository’s MySQL/MariaDB target.
- Test migrations against:
  1. a clean database built from the authoritative SQL, and
  2. a database that already applied the earlier PayMongo migration.
- Update `TrackCOOP_MAIN_Database.sql`, migration documentation, and expected-table checks only in the final documentation/database phase after the final schema is known.
- Do not force the old table count if new PayMongo tables are introduced.

## 18. Rollback strategy

- Because migrations are forward-only, rollback should be operational rather than destructive.
- Keep new columns nullable or defaulted until code uses them.
- Preserve old payment-reference convenience fields while introducing checkout-attempt storage.
- If a later phase fails, disable PayMongo by setting `PAYMONGO_ENABLED=false` rather than deleting data.
- Keep failed gateway events retryable instead of deleting them.
- Use reversal records for payment corrections; do not delete validated payments.
- Avoid modifying unrelated modules in this branch.

## 19. Manual PayMongo sandbox verification plan

Final documentation should guide the operator to:

1. Switch PayMongo dashboard to Test Mode.
2. Obtain an `sk_test_` secret key.
3. Store it only in `server/.env`.
4. Configure the test webhook secret.
5. Configure supported test payment methods.
6. Configure the system actor if the final implementation requires it.
7. Apply migrations manually.
8. Start the database.
9. Start the Express API.
10. Start the Next.js web app.
11. Expose the API port through an HTTPS development tunnel.
12. Register `/api/webhooks/paymongo`.
13. Subscribe to `checkout_session.payment.paid`.
14. Submit a membership application.
15. Start the PHP 200 fee checkout.
16. Cancel it and confirm the payment remains unpaid.
17. Start a new eligible checkout attempt.
18. Complete a PayMongo test payment.
19. Confirm the webhook is processed.
20. Confirm the payment is validated.
21. Confirm the requirement is verified.
22. Confirm one finance record.
23. Confirm one protected receipt.
24. Replay the same webhook and confirm no duplicate records.
25. Simulate a temporary settlement failure.
26. Retry it as Bookkeeper.
27. Confirm it settles exactly once.
28. Test a PHP 1,500 capital installment.
29. Test a second PHP 1,500 capital installment.
30. Confirm PHP 3,000 aggregate.
31. Approve the application.
32. Confirm member capital ledger records.
33. Test an approved Member contribution.
34. Confirm Rental/POS checkout is blocked.

Do not claim manual sandbox tests passed unless they were actually performed.

## 20. Phase sequencing

After this Phase A plan is committed, continue with one phase per run:

- Phase B: webhook lifecycle, event recovery, and safe errors
- Phase C: checkout-attempt lifecycle and idempotency
- Phase D: multiple application share-capital installments
- Phase E: pre-approval capital and membership conversion
- Phase F: authenticated Member share-capital checkout
- Phase G: central settlement, receipt generation, and full history
- Phase H: explicit system actor and safe automation attribution
- Phase I: Bookkeeper UI completion and recovery controls
- Phase J: final security, automated tests, and documentation

Do not start Phase B until explicitly instructed.
