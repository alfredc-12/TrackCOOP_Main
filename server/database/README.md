# Database Files

`seed-reference.sql` contains idempotent reference-data upserts for TrackCOOP
roles, finance categories, and confirmed membership settings. It does not create
accounts, passwords, sessions, or sample transactions.

The application never imports the schema or runs this seed automatically. Read
[`docs/database.md`](../../docs/database.md) before executing either SQL file.
