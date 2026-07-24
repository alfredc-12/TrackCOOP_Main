# Database Setup and Safety

## Source of Truth

`TrackCOOP_Table_Reference_Only.sql` is the authoritative MySQL schema. It
defines exactly 40 application tables. Do not rename its tables, columns, enum
values, keys, or relationships in application code. TrackCOOP does not use
Prisma, views, triggers, or stored procedures.

Schema import is an explicit operator task. The API never creates, alters,
drops, truncates, migrates, or seeds tables during startup.

For an existing database that already has the earlier 34-table schema, apply
`server/database/migrations/20260724_add_membership_application_workflow.sql`
manually with a trusted MySQL client after taking a backup. The application must
report missing required tables if this migration has not been applied; it must
not attempt to create the membership-application tables itself.

For a clean database, import `TrackCOOP_Table_Reference_Only.sql` directly. It
already includes the membership-application workflow tables in foreign-key-safe
order.

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
`information_schema.TABLES`. It verifies that all 40 required TrackCOOP tables
exist, reports missing or additional tables, and never modifies data.

The API also exposes `GET /api/health/database`. Its response contains only
availability and query latency; connection details and database errors are not
returned to clients.

## Reference Data

After a successful schema check, an authorized operator may manually run these
idempotent seed files with their preferred MySQL client:

- `server/database/seed-reference.sql` for roles, financial categories, and
  existing base settings used by the current application.
- `server/database/seed-membership-settings.sql` for approved membership
  application workflow settings.

Both seeds use `INSERT ... ON DUPLICATE KEY UPDATE`, are safe to repeat, and
contain no user accounts or credentials. They are never executed by
`npm run dev`, API startup, tests, or builds.

## Membership Application Table Mapping

The membership application workflow adds six tables:

| Table | Purpose | Depends On |
| --- | --- | --- |
| `membership_applications` | Pre-acceptance application record and decision metadata | `users`, `member_profiles` |
| `membership_application_beneficiaries` | Applicant child and beneficiary rows | `membership_applications` |
| `membership_application_documents` | Protected uploaded document metadata | `membership_applications`, `users` |
| `membership_application_status_history` | Application status transitions and applicant messages | `membership_applications`, `users` |
| `user_activation_tokens` | Hashed member portal activation tokens | `users` |
| `membership_application_requirements` | Orientation, payment, share-capital, and document requirement tracking | `membership_applications`, `payment_references`, `membership_application_documents`, `users` |

`membership_application_requirements` appears after `payment_references` in the
clean reference schema so a new database can be imported without temporarily
disabling foreign-key checks.

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
