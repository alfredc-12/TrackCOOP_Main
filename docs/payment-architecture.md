# Payment architecture

TrackCOOP owns the payment obligation in `payment_references`; PayMongo supplies hosted checkout and signed event evidence.

Checkout attempts are reusable, environment-separated, and idempotent. The raw webhook route verifies timestamp and HMAC before parsing. Paid events enter one centralized settlement transaction that validates purpose, amount, currency, ownership, checkout/payment IDs, and actor attribution.

Settlement creates validation history, exactly-once finance/Share Capital posting, notifications, audit records, and a durable receipt job. PDF receipt generation runs after commit so filesystem failure cannot roll back settlement; failed receipts are safely retryable.

Manual settlement uses the authenticated Bookkeeper. Automated webhook settlement uses the configured noninteractive PayMongo service account. Chairman is read-only. Reversal creates adjustment records and history rather than deleting originals or automatically changing membership type.
