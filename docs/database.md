# Database

The final clean-install schema is `server/database/TrackCOOP_MAIN_Database.sql`. The final expected count is 48 unique base tables.

The PayMongo lifecycle uses `payment_references`, `payment_gateway_events`, `payment_gateway_checkout_attempts`, `payment_validation_history`, `share_capital_payments`, `payment_receipts`, and `financial_records`. Raw webhook bodies, signature headers, API keys, and webhook secrets are not stored.

Clean database: import the main schema, then run `npm run db:check`. Existing database: back up first and apply only outstanding migrations in dependency order. Never run migrations automatically at application startup.

`npm run db:check` performs `SELECT 1` and a parameterized `information_schema.TABLES` read. Tests must use doubles or a dedicated test database and must never silently connect to production RDS.
