# TrackCOOP Database Files

The root of this folder should contain only the current full database setup SQL
files:

1. `TrackCOOP_MAIN_Database.sql`
   - Creates the full TrackCOOP database schema.
   - **DESTRUCTIVE / FRESH DATABASES ONLY:** this script drops and recreates TrackCOOP objects. Never run it on production or the populated `trackcoopdb_main_2` demo database.
   - Includes the structural definitions from the merged migration set and the currently unmerged PR #18 evidence metadata migrations. The latter do **not** activate unfinished finance workflows.
   - A brand-new install that runs this file must **not** re-run its already incorporated migration DDL.
   - Use this first only when setting up an empty/disposable database.
   - Includes PayMongo test-gateway support tables and payment validation
     history for new installs.
   - When the system needs new tables, add those `CREATE TABLE`, index, view,
     and required schema changes here so fresh installs are complete.

2. `testing_data_and_admin_settings.sql`
   - Adds reference data, admin/system settings, and local testing data.
   - Use this after `TrackCOOP_MAIN_Database.sql`.
   - When the system needs new admin settings, default reference rows, or
     testing records, add them here as idempotent inserts or updates.

The application does not import these files automatically. Run them manually
against the configured MySQL database.

Older one-off SQL files, historical migration scripts, and superseded overlays
live in `server/database/migrations/`. Keep those files for existing databases
that need manual upgrade history, but do not treat them as the fresh-install
source of truth.

Existing databases that were created before the PayMongo test integration should
apply only the outstanding PayMongo migration files manually after a backup.

## Status of source-bound evidence migrations

The four `20261107_*evidence*` / `20261107_receipt_attempt_recovery.sql` SQL files
are copied from draft PR #18 for traceability and fresh-install schema coverage.
Their presence in this directory is **not** approval to activate or deploy that
unfinished workflow. PR #18's durable recovery and integration requirements remain
open, and no migration here is automatically executed against any live database.
For existing databases, inventory missing structures, review exact dependencies,
and use a separate additive, verified upgrade plan; never run the reset-oriented
full setup SQL.
