# Troubleshooting

- **PayMongo disabled:** confirm private `server/.env` values and restart the API.
- **Live key rejected:** use Test Mode outside production.
- **Signature invalid/stale:** confirm the webhook secret, raw-body route, tunnel URL, and system clock.
- **Webhook accepted but ignored:** confirm the event is `checkout_session.payment.paid`.
- **Amount/currency/ID mismatch:** inspect safe Bookkeeper detail; do not edit gateway IDs manually.
- **Failed settlement:** Bookkeeper may retry only a previously signature-verified failed event with normalized stored fields.
- **Duplicate webhook:** this should be idempotent; investigate only if duplicate posting appears.
- **Receipt failed:** settlement remains valid; use receipt retry.
- **Member checkout blocked:** verify active approved profile, ownership, no conflicting active checkout, and the PHP 15,000 maximum.
- **Database check fails:** apply the correct clean overlay or outstanding migrations, then rerun `npm run db:check`.
- **Secret scan fails:** remove and rotate the secret before pushing; do not print it in reports.
