# TrackCOOP Database Files

The root of this folder should contain only the current full database setup SQL
files:

1. `TrackCOOP_MAIN_Database.sql`
   - Creates the full TrackCOOP database schema.
   - Use this first when setting up a fresh database.
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
