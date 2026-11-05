# Membership applications and capital completion

This release applies the `membership-2026-11-v2` policy to new applications and new upgrade requests only. It does not change existing members’ obligations, deadlines, classifications, transactions or approved benefits.

## Payments and approval

- Associate application: PHP 200 one-time membership fee, no mandatory initial capital.
- True application: PHP 200 fee and PHP 1,500 initial capital (PHP 1,700 initially); full completion is PHP 200 fee plus PHP 3,000 capital (PHP 3,200 total).
- Fee and capital use separate payment references and categories. Paying in full means paying the fee and a PHP 3,000 capital contribution; it is not an undifferentiated PHP 3,200 capital payment.
- Additional validated installments count; pending/clarification payments do not complete the target. Existing pending commitments count toward the PHP 15,000 capacity limit.
- The initial Chairman review opens payment. Initial confirmed payment permits general membership approval. A new True applicant is an Associate until capital is complete and the Chairman explicitly approves True classification. The final approval dialog contains a separate affirmative classification checkbox.
- Completion alone never promotes membership, suspends an overdue account or blocks later contributions. An approved original True applicant can use the existing Chairman member-status review; no duplicate initial public application is needed. Existing Associates may use the existing upgrade request and retain their validated capital without another membership fee.

## Completion dates and history

New obligations start on the Asia/Manila date of the original submission or upgrade request. Calendar-month anniversaries clamp to the last valid day (August 31 plus six months becomes February 28/29).

Below the target: In Progress before three months, Reminder from the three-month anniversary through the inclusive six-month deadline, Overdue from the following day. At PHP 3,000: Completed takes precedence. Completion and eligibility for review are distinct from the official membership classification.

`membership_capital_cases` preserves the dates and target. Original applications are linked to their converted member in that same case. An original pending case is reused rather than restarting its clock through an upgrade request. Application-related validated/reversed capital is recorded idempotently in `membership_capital_events`; the member ledger supplies additional contributions without counting converted application capital twice.

Monthly figures use evidence available at each month end. They do not project today’s completed status backward. Evidence is loaded in batches, not one database query per member per month. The panel uses the reporting period, requested membership type, barangays and sector filters; engagement/official-status filters of the general member dashboard do not define application obligations. Monthly application counts include upgrade requests. Incomplete includes Reminder and Overdue; those series are subsets, not additive stacked categories.

Legacy cases are explicitly marked for policy review and excluded from the new-policy monthly cohort. No guessed historical obligation or balance is created. Unrecognized historical sectors and location text are retained. Current sector/location filters describe the selected population; historical sector/address changes are not reconstructed without recorded evidence.

## Personal data and benefits

Both membership types can access their own payment history, capital progress, contributions, referrals, store purchases and rental services. Every new self-service route resolves member ID from the authenticated user; caller-supplied member IDs do not select an owner.

Cooperative-wide financial transparency is no longer returned from the ordinary member dashboard. Existing True Member benefit guards remain in place for patronage refunds, Annual Interest and capitalization/withdrawal benefit endpoints. No patronage calculation, payout/capitalization workflow, annual-interest calculation, POS price, rental rate or historical benefit record is modified.

Referral history is paginated and uses the existing masked name format. There are no referral rewards or credits. Existing referral records are preserved. Staff application review shows referral details in a secondary disclosure.

## Sectors and locations

Six canonical sector values: Rice, Corn, Fishery, Livestock, High-value crops (gulayan), Coffee. The legacy high-value label is preserved for compatibility and displayed as High-Value Crops. Relational application/member join tables are authoritative for multiple selections; the first selected value remains available as the legacy primary designation. This is independent from livelihoods/crops.

Dependent searchable `StyledSelect` controls use a local Batangas dataset (34 cities/municipalities and 1,077 barangays). Source: Philippine Statistics Authority PSGC, 2026 Q2, via the pinned `Tenasia/ph-psgc` release. Source URL, mirror, version and checksum accompany each cached JSON. PSA’s 2026 Q3 publication identifies its name correction in Bukidnon; the pinned Batangas names are unaffected. The direct PSA workbook host returned HTTP 403 during implementation, so the source is explicitly described as a PSA-derived mirror rather than a directly downloaded workbook. No runtime geography request is required for the membership address controls.

Sources: https://psa.gov.ph/classification/psgc/ and https://raw.githubusercontent.com/Tenasia/ph-psgc/2026-Q2/psgc/areas/0401000000.json . To refresh, extract only Batangas from a verified release, preserve leading-zero string codes, update both cached files together, and rerun the location integrity tests. No polygon/map rendering changes are included.

## Migration and release order

1. Back up the selected database and verify restored backups before release. Record existing membership settings and table/column presence. Do not run the destructive master schema on an existing database.
2. Ensure the existing email outbox migration (`20261104_email_outbox.sql`) and membership upgrade migration (`20261105_membership_upgrade_requests.sql`) are applied.
3. Apply `server/database/migrations/20261106_membership_policy_v2.sql` once. It includes the existing capital-ledger table definitions if missing, without balance backfills, interest table changes or historical repair. It creates new-policy tracking/sectors, copies recognized legacy single-sector relationships, adds nullable PSGC codes, extends Coffee support and changes defaults for future applications. Existing obligation/payment rows are not rewritten.
4. Deploy the matching API and frontend together only with separate deployment authorization. New code depends on the migration; this PR does not deploy or migrate production.
5. Configure the reminder command and existing email worker only with hosting approval, then monitor dry fixtures/staging before enabling customer delivery.

The additive CREATE statements and sector copies are repeat-safe. The nullable-column ALTER statements are intentionally one-time: inspect `information_schema.COLUMNS` before rerunning a partially applied migration; do not repeatedly paste the entire file. DDL is not transactionally rolled back in MySQL/MariaDB. Keep the old application release available, retain new tables/data for audit, and restore settings from the backup only after deciding how applications submitted under v2 will be served. Do not drop evidence tables as a rollback shortcut.

`TrackCOOP_MAIN_Database.sql` is synchronized for fresh installations, including the previously omitted upgrade and existing capital-ledger structures. Financial categories must include active `SHARE_CAPITAL`; new-policy capital refuses to silently fall back to a membership-fee category. Existing capital postings are not recategorized.

## Scheduled reminders

Run `npm run membership:reminders` (or `node server/dist/scripts/run-capital-reminders.js`) daily before the existing `email:worker`. Use the existing worker environment mechanism; never place credentials in cron command text. This release changes no `.env` file.

Durable reminders require the existing Resend outbox mode and worker configuration. In other delivery modes the scheduler reports disabled and sends nothing. No browser timer or SMS is used. Each case has one three-month and one six-month dedupe key. The existing outbox retains delivery attempts, safe failures and retries; a fresh render cancels obsolete reminders after completion/closure. Missing recipients are recorded as skipped; restricted-stage allowlists still apply.

## Separate audit findings

- Rental estimators currently apply the existing 5% member discount without distinguishing Associate/True membership. The member-profile lookup does not explicitly validate approval status. That concern is recorded only; rental code/pricing is unchanged.
- The base master schema uses the legacy `chairman_admin` role seed while some application code expects `chairman`; existing role normalization/seed cleanup is outside this task. No role records were changed in a shared database.
- The previous master schema omitted the existing capital-ledger tables. The membership migration/master now reuse their existing structural definitions; no historical balance repair is attempted.
- Locked dependencies reported pre-existing npm audit findings during `npm ci`; no dependency versions were upgraded as part of this membership change.

## Verification

See `verification.md` for the exact checks, local-only SQL coverage and browser screenshots. SQL integration tests are opt-in with `MEMBERSHIP_LOCAL_MYSQL=1` and hard-code a disposable localhost port/schema; they cannot target production through the project `.env` files.
