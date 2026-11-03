# DATABASE CHANGES REQUIRED — USER REVIEW

## Mandatory changes

**None for this implemented Financial Overview on the inspected database.** The baseline schema and read-only live inspection contain the required financial records, categories, approval/recording actors, source references, correction/reversal links and audit columns. No SQL was executed to change the configured database, and `TrackCOOP_MAIN_Database.sql` is unchanged.

Season filters are exposed only when both the financial-record season column and seasons table can support them. A missing requested season association produces an explicit unsupported-filter response. Financial-document associations are similarly detected; when unavailable the drawer explains the missing relationship and directs users to authorized source receipts. An old installation missing mandatory finance posting columns receives `OVERVIEW_SCHEMA_REQUIRED` instead of fabricated totals; reconcile that installation with its existing finance migrations before rollout.

## Optional proposals (not applied or consumed by this release)

Each file below is a **proposal requiring production approval**. Do not run them as a prerequisite for this page. Take a verified backup, examine metadata and workload plans, test on a restored staging copy, then approve an explicit change window. MySQL DDL is not an application-transaction rollback.

### 1. Governed category classification

- Table: `financial_categories`.
- Definition: nullable `operating_classification ENUM('Operating','Capital','Internal Transfer','Principal','Non-operating','Needs Review') DEFAULT NULL`.
- Limitation: category type Income/Expense/Both does not determine the operating nature of arbitrary custom categories. Source/code guards protect recognized cases; ambiguous custom names need human accounting review.
- Purpose: future explicit accountant-approved classification without guessing from names.
- Migration proposal: `server/database/proposals/20261103_financial_category_classification.sql` (exact ALTER in file).
- Backfill: none automatically. Review category code, purpose and historical postings with the Bookkeeper/accountant. Leave NULL until classified. Do not mass-map every Expense to Operating.
- Compatibility: current readers/writers ignore the added nullable column. A separate approved application change must implement dual-read fallback, governance/edit permissions, audit changes and consistent classification across Overview/Analytics/reports before using it. Old clients continue to operate. Reclassification can change historical current-state totals; approve and audit each change.
- Verify: SHOW COLUMNS confirms the enum/default, old writes still work, NULL population is reviewed, then future readers' category/source totals reconcile. Restore a backup or drop only the unused proposal column if rolling back before any consuming deployment. Never drop populated classification without preserving it.

### 2. Posting lookup index

- Table: `financial_records`.
- Definition: `idx_financial_posting_reference (payment_reference_id, record_type, record_status, approved_by)`.
- Limitation: the inspected database has a single-column payment-reference foreign-key index; duplicate-posting correlation may scan more rows for large references.
- Purpose: optional lookup performance, with no change to financial classification or uniqueness. A unique constraint is intentionally not proposed because corrections/history may share a payment reference.
- Migration proposal: `server/database/proposals/20261103_financial_posting_lookup_index.sql` (exact CREATE INDEX in file).
- Backfill: MySQL builds the index; no row updates.
- Compatibility: additional storage and write overhead; do not remove existing FK indexes automatically. Check for equivalent prefix indexes first. Apply only if EXPLAIN ANALYZE and representative staging load demonstrate a benefit. Exact deployment locking behavior depends on the database engine/version.
- Verify: SHOW INDEX confirms column order, query results/reconciliation are unchanged and plans/latency improve. Roll back with `DROP INDEX idx_financial_posting_reference ON financial_records` only after ensuring no other change depends on it.

## Deliberately unclaimed capabilities

Cash movement, settlement timestamps for arbitrary manual expenses, immutable historical posting snapshots and complete supporting-document coverage cannot be inferred from remarks or `approved_by`. Adding a timestamp alone would not reconstruct past state. Those require separate accounting/workflow design and approvals; no automatic historical backfill or guessed evidence is proposed here.
