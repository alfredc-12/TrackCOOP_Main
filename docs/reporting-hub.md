# Cooperative reporting hub

The staff Reports page now has an overview, monthly progress charts, a current attention list, and a searchable report library. It reuses the existing report authorization, preview, history, print, PDF/CSV/Excel export, and protected document-saving flows.

## Reports and calculation basis

- **Cooperative Overview** compares six monetary measures with the immediately preceding period of the same number of calendar days, including both endpoints. The default generated period is the current Manila month to date. The dashboard initially selects the current year to date. It shows absolute changes and percentage changes; a zero baseline has no percentage, and negative baselines use their absolute magnitude as the denominator.
- **Performance Trends** groups those same measures by month, fills missing months with zero, and limits partial months to the selected dates. Its chart lets staff switch measures without combining overlapping income sources.
- **Attention Needed** is a current snapshot of pending/clarification payments, validated payments without an approved active ledger entry, low available stock, and accessible documents expired or expiring within 30 days. It does not accept a historical date range. One record may have multiple issues.

Posted income and expenses use active, approved ledger entries, excluding linked payments that are not validated. Net result is their difference. Store sales require paid/completed orders with paid status and validated linked references where present. Rental receipts require validated rental references and are dated by approval. Capital contributions require validated capital payments and validated linked references where present. Timestamp dates for sales and approvals are converted from UTC to Manila; ledger and capital payment dates are business dates.

These measures overlap: sales and rental receipts may also appear in posted income. Capital contributions are not operating income. The UI and new exports explain that the measures must not be added into a grand total.

Stock uses the inventory movement balance less reservations on pending-payment orders. It retains the stock UI's minimum reorder threshold of 10. Archived/inactive/draft products are excluded. Document attention uses the existing document visibility policy, so the Bookkeeper cannot see Admin-only documents through the new report.

## History and preferences

The Reports home endpoint loads actual role-authorized recent reports and filter options. The monthly generated count includes successful, nonarchived reports in Manila's current month, rather than returning a fixed zero. Rerunning a recent report restores its saved filters and uses current records. Exports use the server-returned applied filters, including resolved default dates.

Favorites contain report keys only and are stored in browser local storage by staff role. They are browser preferences, not shared cooperative records. Storage failures do not block report access.

`GET /api/reports/progress` is staff-only and uses the existing report generator with history recording disabled. Viewing progress does not create report-history entries or financial records. Explicit generation and export retain the existing audit/history behavior.

## Limits

This phase adds no database tables or migrations. Approved performance targets and historical stock/backlog snapshots are not stored, so the page explicitly does not claim goal-completion percentages or historical backlog movement. Zero means no qualifying recorded activity; missing/unposted activity is not estimated. Dated reports use the current status of records, so a later reversal may change an earlier period's result. Existing agency templates still require approved configuration; the library does not present them as working reports.

## Verification

- Unit and service tests cover date boundaries, impossible dates, comparison arithmetic, missing months, role authorization, read-only previews, export notes, history counts, and filter-option loading.
- Browser tests cover 1440/768/390px layouts, trend selection, attention display, favorites across reload, recent filters, export dates, and unavailable-progress retry.
- The three new SQL reports and CSV/XLSX/PDF generation were also exercised against the configured database with `record: false`; no database writes were performed by that check.

Tests: `server/src/modules/records/report-progress.test.ts`, `server/src/modules/records/report-generation.test.ts`, and `tests/e2e/report-hub.spec.ts`.
