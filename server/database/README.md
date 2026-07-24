# Database Files

`seed-reference.sql` contains idempotent reference-data upserts for TrackCOOP
roles, finance categories, and existing base settings. It does not create
accounts, passwords, sessions, or sample transactions.

`seed-membership-settings.sql` contains only the approved membership application
workflow settings. Run it manually after the 40-table schema is present.

`migrations/20260724_add_membership_application_workflow.sql` adds the six
membership application workflow tables to an existing 34-table database. It is
manual and non-destructive.

The application never imports the schema, applies migrations, or runs these
seeds automatically. Read [`docs/database.md`](../../docs/database.md) before
executing any SQL file.
