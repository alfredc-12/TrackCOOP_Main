# TrackCOOP Database Files

The root of this folder should contain only the current full database setup SQL
files:

1. `TrackCOOP_MAIN_Database.sql`
   - Creates the full TrackCOOP database schema.
   - Use this first when setting up a fresh database.
   - When the system needs new tables, add those `CREATE TABLE`, index, view,
     and required schema changes here so fresh installs are complete.

2. `testing_data_and_admin_settings.sql`
   - Adds reference data, admin/system settings, and local testing data.
   - Use this after `TrackCOOP_MAIN_Database.sql`.
   - When the system needs new admin settings, default reference rows, or
     testing records, add them here as idempotent inserts or updates.

The application does not import these files automatically. Run them manually
against the configured MySQL database.

Older one-off SQL files and historical migration scripts live in
`server/database/migrations/`. Keep those files for existing databases that need
manual upgrade history, but do not treat them as the fresh-install source of
truth.
