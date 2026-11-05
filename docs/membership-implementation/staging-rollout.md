# PR #7 staging rollout approval checklist

This is an execution plan, not an executed deployment. No staging/production connection, migration, financial repair, workflow dispatch or PR merge was performed while preparing it.

PR #6 is merged into main at `3e95e6ad85ef4056aca1f7d166e3d4d5cc3cb2c9`. PR #7 must include that commit and pass Quality Gate on its final head before rollout approval. The master SQL file is a destructive fresh-install/reset script: **never import it into the existing staging database as an upgrade**.

## Approval and automation gate

The current staging API and frontend workflows use successful **main** CI as an automatic deployment trigger:

- `.github/workflows/verpex-api-deploy.yml`
- `.github/workflows/verpex-web-build.yml`

Before authorizing a future PR #7 merge, the release owner must establish an approved deployment hold or equivalent scheduling control so that code cannot reach staging before its database is ready. This task does not disable or dispatch workflows. A feature-branch CI run does not authorize a merge, migration or deployment. Production workflows remain separately authorized.

Use one exact approved PR/merge SHA for all three SQL files and matching API/frontend artifacts. Existing compiled-API deployment archives contain `server/dist` and package files, not `server/database/migrations`; obtain the reviewed SQL files separately from that same SHA. Do not assume the archive automatically migrates the database.

## Staging isolation: hard prerequisite, not yet verified remotely

The release owner must identify and record the **actual** staging endpoint, schema name and database principal before execution. No staging credentials or schema identity were inspected in this task.

- Use a dedicated staging database and staging-only database user. A separate instance is preferred; a separate schema on the same server is acceptable only if the staging user has no grants on production schemas and no global/super privileges. A different frontend domain alone is not isolation.
- Staging API and staging cron worker must both resolve to that staging database/user. Verify the effective runtime configuration, not only a saved file: inherited process variables override the worker environment file.
- Verify identity with `SELECT DATABASE(), CURRENT_USER(), @@hostname, @@version, @@session.time_zone;` and review `SHOW GRANTS;` through the approved staging connection. Stop if the selected database is not the administrator-confirmed staging schema or grants reach production. `/api/health/database` proves connectivity, not isolation.
- Use only staging upload storage/root or a staging-only object-storage prefix with restricted credentials; no writes to production uploads.
- Staging frontend: `https://verpex-test.trackcoop.online`; staging API: `https://api-verpex-test.trackcoop.online` (the current workflow build targets). Confirm DNS/app roots still belong to staging. API FRONTEND_URL/CORS/payment return URLs and built frontend NEXT_PUBLIC_API_URL must agree with staging, not production.
- Initially disable gateway calls (`PAYMONGO_ENABLED=false`) and delivery (`EMAIL_DELIVERY=disabled`). No live keys, production webhook targets or production email queues may be exercised. Enabling test QRPH or allowlisted email later is a separate staging test authorization, not permission to use live payments.
- For an approved reminder/email test, use Resend restricted mode, a test-recipient allowlist, staging credentials, and a staging-only valid 32-byte base64 EMAIL_SECRET_KEY shared by the staging API and worker. Keep the worker file outside the web root with owner-only permissions (mode 600). Do not paste secrets into commands or this document.
- Do not restore production data into staging as part of this plan without separate authorization. Prefer synthetic/sanitized fixtures; never start workers against copied customer recipients or payment references.

## Required schema and migration prerequisites

The staging baseline must already support the current merged main financial workflows. Confirm parent IDs are BIGINT UNSIGNED, tables use InnoDB, foreign keys/indexes are compatible, and the DBMS meets the project target (MySQL 8+ / MariaDB 10.6+). MySQL client authentication and TLS settings must match the staging server.

Baseline tables include `users`, `member_profiles`, `membership_applications`, `membership_application_requirements`, `payment_references`, `financial_categories`, `financial_records`, `system_settings`, and `share_capital_payments`.

PR #6 also expects the existing financial schema, including `share_capital_accounts`, `share_capital_transactions`, `payment_gateway_checkout_attempts`, `patronage_capital_transfers`, and `member_dividends` with their current status/reservation columns. PR #6 itself adds no migration. Membership v2 can create missing capital-ledger tables but does not install all historical patronage/interest migrations or repair balances. If this baseline is incomplete, **stop and obtain a separately reviewed prerequisite plan**; do not guess at additional migrations or run a destructive master schema.

The two named prerequisite migrations, in order, are:

1. `server/database/migrations/20261104_email_outbox.sql`
   - Must provide `email_outbox`, `email_outbox_attempts`, `email_webhook_events`, including unique outbox dedupe/coalesce keys and webhook-event identity.
2. `server/database/migrations/20261105_membership_upgrade_requests.sql`
   - Must provide `membership_upgrade_requests`, member/reviewer foreign keys, the generated pending-member identity, and its unique pending-request index.

Only then apply `server/database/migrations/20261106_membership_policy_v2.sql`. If a prerequisite is already applied, verify its **full expected structure**, not just the table name, and skip its execution. All three scripts must come from the approved release SHA.

Before v2, inspect these points with the read-only preflight queries below:

- `municipality_psgc` and `barangay_psgc` must both be absent from both target tables for a clean first run. If any are already present, treat the migration as potentially applied/partial and stop for inspection. The two ADD COLUMN statements are not repeat-safe.
- Existing non-null member sector values must be one of Rice, Corn, Fishery, Livestock, High-value crops (gulayan), Coffee. Do not let ENUM conversion silently truncate an unrecognized value. Preserve/export discrepancies and obtain a reviewed mapping instead of coercing records.
- Required system-setting rows must exist. Existing approved fee/initial/max values are PHP 200 / PHP 1,500 / PHP 15,000. V2 updates only the full-capital target to 3000, deadline default to 6, and referral reward policy to disabled; it does not silently create missing setting rows. Do not blindly rerun the broad seed file over a configured database.
- Review row counts, historical application snapshots/deadlines/classifications, payment totals, ledger counts/balances, sector counts and current settings before execution. Preserve these as the comparison baseline.

## Backups and freeze

Before any schema change:

1. Freeze **all staging writes**, application/upgrade submissions, approvals, payment validations and relevant callbacks; pause staging reminder/outbox cron jobs. Coordinate any incoming staging test callbacks rather than losing events. Keep the new API/frontend inactive until the database check and coordinated cutover finish.
2. Take a full recoverable **staging** schema-and-data snapshot/dump with the appropriate DBMS client, plus any relevant staging upload-storage snapshot and the current staging release/configuration backup. Protect secrets in the backup; never commit it.
3. For a transaction-consistent dump, use InnoDB and a controlled DDL/write-free interval; a single-transaction dump is not a substitute for coordinating concurrent DDL. Verify the backup completed, checksum it, and prove it can restore into a separate disposable database.
4. Record the old release SHA, all relevant settings, expected staging DB identity and the backup timestamp/location. Confirm restoration privileges before starting.

## Approved future deployment sequence

The following steps are **not authorized by this document alone**:

1. Obtain explicit approval for the precise release SHA, staging DB identity, migration window, backup and deployment actions; keep the automatic staging deployment hold active.
2. Freeze staging writes and workers; complete and verify the backup/identity checks above.
3. Verify/apply `20261104_email_outbox.sql` if missing; inspect its resulting tables/indexes.
4. Verify/apply `20261105_membership_upgrade_requests.sql` if missing; inspect its generated column/index/FKs.
5. Apply `20261106_membership_policy_v2.sql` **once** to the explicitly selected staging schema. Use an authorized schema-change account restricted to staging; runtime accounts should not have production privileges. Save the migration output/errors privately. DDL is not transactionally rolled back, so stop on the first error and inspect actual state; do not repeatedly paste the file.
6. Verify before releasing writes:
   - cases/events/sector tables, foreign keys and unique keys exist;
   - four new PSGC columns are nullable CHAR(10), Coffee is accepted and the new application deadline-column default is 6;
   - all six canonical sector rows exist and recognized legacy primary-sector relationships were copied without changing primary strings;
   - target/deadline setting rows are 3000/6 and referral rewards are disabled; approved fee/initial/max rows remain 200/1500/15000;
   - `SHARE_CAPITAL` financial category is present and active (INSERT IGNORE will not reactivate a pre-existing inactive row);
   - historical payment/financial records, account balances, classifications, application obligation snapshots and existing deadlines match the saved baseline. Legacy cases must not be created by the migration.
7. Deploy/restart the matching **staging API first**, with workers paused and gateway/email disabled. Confirm the compiled capital-reminder entry point and outbox worker are included. Verify health/database connectivity, effective staging target and logs.
8. Deploy the matching **staging frontend** built against the staging API. Keep the write freeze until both run the same approved SHA and health/authorization checks pass.
9. Under separately approved staging test authorization, use synthetic records to verify Associate PHP 200; True PHP 1,700 initial / PHP 3,200 full split; installments; initial ledger credit; retry/concurrency without duplicate credits; exact/over PHP 15,000 guard; Chairman-only classification; personal-data ownership and True-only benefits; sectors/locations; complete masked referral pagination. No historical bulk financial repair is part of smoke testing.
10. Configure/enable the daily `run-capital-reminders.js` command before the existing outbox worker only after staging DB/recipient isolation is confirmed. First validate configuration with `node server/dist/scripts/run-email-outbox.js --check-config` (configuration only; sends nothing). `run-capital-reminders.js` has **no dry-run flag**: do not invoke it until the staging queue test is approved. Then test only allowed synthetic recipients and persistent dedupe/retry behavior. Do not release copied production outbox rows. Confirm workers use the same stage DB and encryption key as the API.
11. Resume staging writes/jobs only after checks pass, then release the approved staging deployment hold. Monitor API/worker failures, outbox results, financial reconciliation and legacy-review flags. Production rollout remains a separate approval.

## Failure and rollback

If migration/deployment verification fails, keep staging writes/jobs paused. MySQL/MariaDB ALTER/CREATE operations can commit independently; a BEGIN/ROLLBACK wrapper does not undo this script. Inspect partial state before any retry.

Before new v2 writes have been accepted, restore the verified staging backup and prior matching release/configuration together if the approved rollback plan calls for it. If v2 records have been created, preserve them and obtain a reviewed recovery/roll-forward plan before restoring anything that could lose records. Never drop evidence tables or rewrite historical financial data as an automatic rollback.

## Read-only identity and schema preflight (for an approved staging operator)

These queries were prepared but **not run against staging**:

```sql
SELECT DATABASE() AS selected_schema, CURRENT_USER() AS database_principal,
       @@hostname AS server_host, @@version AS db_version,
       @@session.time_zone AS session_time_zone;
SHOW GRANTS;

SELECT table_name, engine
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('users','member_profiles','membership_applications',
    'membership_application_requirements','payment_references','financial_categories',
    'financial_records','system_settings','share_capital_payments',
    'share_capital_accounts','share_capital_transactions',
    'payment_gateway_checkout_attempts','patronage_capital_transfers','member_dividends',
    'email_outbox','email_outbox_attempts','email_webhook_events',
    'membership_upgrade_requests')
ORDER BY table_name;

SELECT table_name, column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('member_profiles','membership_applications')
  AND column_name IN ('sector','municipality_psgc','barangay_psgc',
                      'share_capital_deadline_months');

SELECT sector, COUNT(*) AS records_to_review
FROM member_profiles
WHERE sector IS NOT NULL AND sector NOT IN
 ('Rice','Corn','Fishery','Livestock','High-value crops (gulayan)','Coffee')
GROUP BY sector;

SELECT setting_key, setting_value
FROM system_settings
WHERE setting_key IN ('membership.associate_fee','membership.initial_share_capital',
 'membership.true_member_required_capital','membership.maximum_share_capital',
 'membership.share_capital_deadline_months','referrals.reward_policy')
ORDER BY setting_key;
```

Use SHOW CREATE TABLE / SHOW INDEX for all prerequisite and existing financial tables to compare complete expected definitions. Missing/unexpected rows, unsupported values, partial migration state or production-reaching grants are **stop conditions**, not permission to repair data.
