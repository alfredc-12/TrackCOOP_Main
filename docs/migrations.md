# Migration paths

## Clean database

1. Back up any existing database.
2. Import `server/database/TrackCOOP_MAIN_Database.sql`.
3. Apply outstanding dated migrations in chronological order.
4. Run `npm run db:migrate:share-capital-ledger` for the Share Capital ledger, dividend tables, Interest on Share Capital fields, historical backfill, and reconciliation check.
5. Run `npm run db:check`; expect 60 required TrackCOOP base tables.

## Existing database

1. Back up MySQL and protected files.
2. Record which dated migrations were already applied.
3. Apply only outstanding files in chronological/dependency order.
4. Do not re-run the clean main schema on an already migrated database.
5. Run `npm run db:check` and focused payment tests.

The Share Capital migration command is safe to retry after a completed run. It preserves existing payment rows, uses source-level idempotency for ledger backfill, and exits with an error if an account balance does not reconcile with its transactions.

The command also applies `20261012_dividend_action_approval_workflow.sql`, which adds the pending state used when a member asks to withdraw a dividend or add it to Share Capital, `20261013_repair_legacy_dividend_action_statuses.sql`, which repairs requests created before that state existed, `20261017_dividend_withdrawal_payout_details.sql`, which stores payout details, and `20261018_dividend_withdrawal_receipt.sql`, which stores the optional receipt attached when a payout is completed. Run the command before testing the Bookkeeper action queue.

Migrations are manual operator actions and never run during API startup.

The referral feature uses `20261022_member_referrals.sql` for referral codes and tracking, followed by `20261023_referral_reward_policy.sql` for the Chairman-configurable tracking-credit policy. Apply both in chronological order on an existing database.

Seasonal Analytics and Budget Controls use `20261027_seasons_and_budget_controls.sql`. Apply it after the referral migrations. It creates season, production-record, budget, and budget-line tables and adds nullable season links to financial and POS records. Existing records remain valid; selected-season analytics includes untagged historical records when their dates fall within the season range.
