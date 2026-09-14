# Operations and security

Deploy the web and API as separate processes. Keep database credentials, PayMongo keys, webhook secret, service-account ID, cookie configuration, and protected-storage paths in `server/.env` or the deployment secret store.

Use HTTPS for production and for the temporary sandbox webhook tunnel. Restrict CORS to `FRONTEND_URL`. Keep protected receipts, proofs, and documents outside public static hosting and authorize every read.

Before deployment, run the documented type checks, tests, build, database check, secret scan, and `git diff --check`. Back up MySQL and protected uploads together. Restore into non-production first and verify login/RBAC, payments, Share Capital, finance, receipts, documents, and reports.

Rotate credentials after suspected exposure. Never log raw webhook bodies, signatures, keys, session tokens, application tracking tokens, payment proofs, or private member files.

## Rental requester email updates

TrackCOOP stores an optional requester email with each rental booking. Because the project has no mail transport, rental submission and status/schedule changes trigger a backend-ready webhook when `RENTAL_STATUS_EMAIL_WEBHOOK_URL` is configured in the Next.js web process environment (use root `.env.local` for local development). Set `RENTAL_STATUS_EMAIL_WEBHOOK_TOKEN` when the receiving automation requires a bearer token. The webhook receives `rental.status.updated`, recipient name/email, a ready-to-send subject and plain-text message, the public rental status/note, and the public status-check URL. It never receives the requester's valid ID, contact number, address, or internal staff notes.

The receiving service must return a 2xx response within five seconds and perform the actual email delivery. Delivery failures are logged by rental reference and status without rolling back an already committed booking update. Leave both variables blank to keep email delivery disabled in local development.
