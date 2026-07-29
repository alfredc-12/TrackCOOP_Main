# Migration paths

## Clean database

1. Back up any existing database.
2. Import `server/database/TrackCOOP_MAIN_Database.sql`.
3. Apply `server/database/TrackCOOP_PAYMONGO_Core_Completion.sql`.
4. Run `npm run db:check`; expect 48 base tables.

## Existing database

1. Back up MySQL and protected files.
2. Record which dated migrations were already applied.
3. Apply only outstanding files in chronological/dependency order.
4. Do not run the clean completion overlay on an already migrated database.
5. Run `npm run db:check` and focused payment tests.

Migrations are manual operator actions and never run during API startup.
