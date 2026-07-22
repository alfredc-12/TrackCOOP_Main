# Database Setup and Safety

## Source of Truth

`TrackCOOP_Table_Reference_Only.sql` is the authoritative MySQL schema. It
defines exactly 34 application tables. Do not rename its tables, columns, enum
values, keys, or relationships in application code. TrackCOOP does not use
Prisma, views, triggers, or stored procedures.

Schema import is an explicit operator task. The API never creates, alters,
drops, truncates, migrates, or seeds tables during startup.

## Private Configuration

Create `server/.env` from `server/.env.example` and provide the RDS values
locally. The file is ignored by Git. Never commit credentials or paste them into
logs, issues, or source files.

For RDS, keep `DB_SSL=true`. When certificate verification requires a CA bundle,
download the current AWS RDS trust bundle outside the repository and set
`DB_SSL_CA_PATH` to its local path. The pool uses certificate verification and
does not log connection credentials.

## Schema Verification

Run the read-only checker after the schema has been imported manually:

```bash
npm run db:check
```

The checker executes only `SELECT 1` and a parameterized query against
`information_schema.TABLES`. It verifies that all 34 required TrackCOOP tables
exist, reports missing or additional tables, and never modifies data.

The API also exposes `GET /api/health/database`. Its response contains only
availability and query latency; connection details and database errors are not
returned to clients.

## Reference Data

After a successful schema check, an authorized operator may manually run
`server/database/seed-reference.sql` with their preferred MySQL client. The seed
uses `INSERT ... ON DUPLICATE KEY UPDATE`, is safe to repeat, and contains no
user accounts or credentials. It is never executed by `npm run dev`, API
startup, tests, or builds.

Automated tests use injected database doubles. Never point automated tests at
the production RDS database.

## Runtime Data Boundaries

- `user_sessions` stores only hashed opaque session tokens.
- `audit_logs` records administrative actions without passwords, raw tokens, or
  payment proof contents.
- `documents`, `reports`, and protected upload references store metadata and
  file paths, not public file contents.
- Landing tables (`site_content_blocks`, `services`, `programs_projects`,
  `partners_certifications`, `gallery_items`, `system_settings`) are edited by
  Chairman-only APIs and read publicly only through published/visible rows.

## Backup Baseline

Take database backups before schema imports, before large data imports, and
before production deployments. Store SQL dumps and upload archives separately
from the Git repository. Restore into a non-production database first, run
`npm run db:check`, then validate login, member lists, payment summaries,
reports, landing content, and representative uploaded documents.
