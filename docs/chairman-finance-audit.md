# Chairman payments and share capital: initial audit

This is an initial audit of local main at c5926fa, not a completed metric contract. No live database or migration state was inspected.

## Confirmed source behavior

- Payment reference summary counts every pending reference, including incomplete gateway checkouts. Its manual count excludes PayMongo, matching the manual-review channel check in the existing payment UI. Status, purpose, date and other table filters are not applied to the summary.
- `validatedAmount` sums all references whose current status is Validated, with no reporting period or gateway environment restriction. It is not revenue, historical net activity, or bank settlement.
- `validatedToday` used the UTC calendar despite validations being stored with `UTC_TIMESTAMP()`. The branch changes this to the UTC interval corresponding to the Asia/Manila day. Historical records require separate verification of their timestamp conventions.
- Share-capital `validatedTotal` and `membersWithValidatedCapital` aggregate payment records; neither represents current ledger account balances or current capital holders. `share_capital_accounts.current_balance` is the requested balance source and needs reconciliation with posted signed transactions.
- The share-capital UI requests at most 100 payments, then paginates the result in the browser, so it can omit later records.
- `POST /share-capital` currently permits chairman and bookkeeper. Its intended governance exception has not yet been established; do not change authorization without completing the workflow audit.

## Required follow-up

Define and verify period, environment and reversal semantics; implement shared server-side summary and table filters, ledger-based capital metrics, reconciliation and full pagination, permitted drill-down and exports. Add unit and integration tests for Manila boundaries, gateway environments, reversals, decimal aggregation, account/ledger reconciliation and role authorization. Confirm deployed schema and legacy data before treating any migration as applied. Preserve the existing capitalization and reversal workflows. No migration or production mutation was performed.