# Operations and security

Deploy the web and API as separate processes. Keep database credentials, PayMongo keys, webhook secret, service-account ID, cookie configuration, and protected-storage paths in `server/.env` or the deployment secret store.

Use HTTPS for production and for the temporary sandbox webhook tunnel. Restrict CORS to `FRONTEND_URL`. Keep protected receipts, proofs, and documents outside public static hosting and authorize every read.

Before deployment, run the documented type checks, tests, build, database check, secret scan, and `git diff --check`. Back up MySQL and protected uploads together. Restore into non-production first and verify login/RBAC, payments, Share Capital, finance, receipts, documents, and reports.

Rotate credentials after suspected exposure. Never log raw webhook bodies, signatures, keys, session tokens, application tracking tokens, payment proofs, or private member files.
