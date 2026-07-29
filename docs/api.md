# API

The Express API defaults to port 5000. Browser requests use credentialed CORS and origin validation.

## PayMongo webhook

`POST /api/webhooks/paymongo` is mounted before JSON parsing and uses raw `application/json` bytes. It verifies `Paymongo-Signature`, timestamp tolerance, and HMAC before parsing. Only paid checkout events settle payments; ignored and failed events store safe normalized metadata, not raw bodies or signatures. Duplicate events are idempotent.

## Public applicant

Public checkout/status actions require the application code and `X-Application-Tracking-Token`. Supported purposes are Associate Membership Fee and eligible Share Capital installments.

## Member

- `GET /api/paymongo/members/me/share-capital`
- `POST /api/paymongo/checkouts/members/me/share-capital`

The server resolves the authenticated Member profile; the browser does not submit a Member ID.

## Staff

Bookkeeper can validate manual payments, reject, request clarification, edit eligible pending manual records, reverse, retry receipts, and retry verified failed gateway events. Chairman can list/filter/view safe detail only. Gateway recovery replays stored normalized fields; it never accepts a replacement webhook payload.
