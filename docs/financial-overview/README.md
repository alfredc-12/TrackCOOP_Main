# Chairman Financial Overview

Implemented on `feature/chairman-financial-overview`, from local main `8990cd6`, in the sibling `TrackCOOP_FinancialOverview_Worktree`. The original checkout, its environment files, staged changes, untracked design references and other agents' work were preserved. No pull, merge, push, deployment or production migration was performed.

## Workspace and financial contract

`/portal/chairman/finance` renders a dedicated, read-only overview. It no longer mounts the expense-only page or a second Financial Dashboard. Existing Bookkeeper recording, payment validation, Budget Controls, Share Capital, and deeper Financial Analytics remain separate.

The four cards show **Money In** (posted operating Income), **Money Out** (posted operating Expense), **Net Operating Result** (Income minus Expense), and distinct **Financial Records for Review**. Income/expense cards focus activity; net and information controls open a right-side drawer. Review conditions overlap but each record is counted once. A zero result says Balanced; negative net is a deficit. Ordinary voided history is not automatically a new problem.

`financial_records` is authoritative. There is no independent accumulation of POS sales, rentals, payment references or share-capital receipts into revenue. Eligibility is centralized in `server/src/modules/finance/financial-posting-rules.ts` and reused by the overview, generic finance summary/trends, financial transparency, and dashboard finance trends. It keeps `postedRecordSql`, `postedOperatingSql`, `capitalMovementSql` and the classification exports compatible with the separate analytics work.

Eligible postings are active, approved Income/Expense records, have a positive amount and an existing category of the same type or Both, and have valid recorded source/relationship links. Known capital, internal-transfer, principal, capital-acquisition and distribution codes; Share Capital source/category/payment-purpose; Adjustments; reversal records; originals superseded by active approved corrections/reversals; duplicate active posted income for one payment reference; missing referenced payments; test-gateway records; and operational income with incompatible payment status/amount or a broken recorded POS/Rental source ID are excluded. Ambiguous duplicates are all routed to source review rather than arbitrarily selecting one amount. Corrections with valid parent links remain included; legitimate POS/Rental expenses, donations, grants, custom compatible categories, and historically inactive categories remain included. Existing inactive labels do not erase historical postings.

The current schema has no governed operating/capital field for every custom category. Existing compatible custom categories are preserved; custom capital names that carry no recognized source/code cannot be inferred reliably. The optional classification proposal in database-review.md addresses that limitation. This is current-state ledger reporting, not an immutable historical as-posted statement. Corrections posted later can affect prior record-date periods. Recorded income does not prove cash collection, recorded expenses do not prove cash disbursement, and net is not an available-cash balance or audited distributable surplus.

## Filters and interactions

- Inclusive `record_date` bounds use the Asia/Manila calendar. Today, yesterday, last 7/30 days, this/last month, current quarter/year, last year, custom and all time are supported. Future parts are clamped to today; future-only and reversed ranges fail explicitly.
- Comparisons use the previous equivalent elapsed period or same period last year, or None. All time has no arbitrary comparison. Previous zero/negative net has a displayed amount change with percent N/A. A custom range compares its inclusive day count with the immediately preceding range.
- Base filters (date, category, source, text/reference search, recorder, approver, optional season, exact min/max amount) affect KPIs, compositions, sources, trends and activity. **Activity-only** selections (transaction view, audit status, category/source/bucket drill-down, review condition, ordering and pagination) narrow the table while keeping posted headlines stable. This prevents a click on Income from erasing Expense or changing Net unexpectedly.
- Search is debounced 350ms. Custom StyledSelect controls are reused throughout; date fields use DatePicker. Query state is written into the URL and restored by reload/back/forward. Chips remove individual active constraints. Apply/Clear are in the filter header; additional controls expand beside the Filters title.
- Grouped income/expense bars support monthly, quarterly, yearly and daily intervals. An accessible expandable figures table gives keyboard users the same bucket selection. Empty buckets remain visible. More than 1,500 buckets requires a broader interval.
- Ranked category panels and source rows focus the activity list. Category panels show six rows, with all remaining categories available in the drawer. Source net is income less attributed expenses, not departmental profit.
- Server pagination, exact selected-row count/amount, allowlisted sorting and a deterministic ID tie-break prevent browser-side partial totals. On phones records become stacked cards; data tables scroll inside their own bounds.
- Record drawers include amounts, status, category/source IDs, authors, season, remarks, linked correction/reversal records, authorized document metadata, recorded audit history and available source-payment context. Unavailable evidence is disclosed. Document links continue through the existing authorized document route; no raw file paths or private metadata are returned. The drawer traps focus, closes with Escape/backdrop/X, and returns focus.
- Missing financial posting is not invented as a nonexistent financial-record row. Existing payment-posting exceptions are linked separately to the payments monitoring workspace.

## API and reports

New Chairman-only GET endpoints under `/api/financial-overview`: `options`, `summary`, `transactions`, `transactions/:id`, `trends`, `categories`, `sources`, `review`, and `export?format=xlsx|pdf`. No mutation endpoint is added. All require an authenticated Chairman; no-store caching applies. Existing finance mutations remain Bookkeeper-only.

Every report request uses a read-only repeatable-read transaction, and each export obtains summary, breakdowns, trends and the complete selected activity dataset in one snapshot. Financial values remain SQL DECIMAL strings and BigInt cents through aggregation, comparison, reconciliation and exports. Chart geometry and percentages use numbers only for presentation; they do not calculate money totals. Existing legacy finance responses retain their numeric contracts.

PDF and Excel include title/cooperative, generation UTC, effective reporting period, comparison, applied filters, financial basis, summary, comparison amounts/percentages, income-versus-expense trend, income/expense categories, sources, complete selected activity and review indicators. Activity/audit scope is distinguished from the shared posted base in report metadata. Excel stores exact monetary decimals as text, preserving long values and preventing formula execution. PDF wraps activity cells across taller rows; Excel retains complete recorded remarks (including structured Rental remarks). The drawer retains the same source text. PDFs above 5,000 activity records and Excel above 100,000 records fail explicitly instead of silently exporting a partial result. Narrow the filters for larger populations. Reused report rendering now accepts an optional financial banner; old expense-report callers retain their original banner.

## Schema verification

The configured database was inspected **read-only on 2026-11-03** using existing credentials only in process memory. Required finance/category/payment/correction/audit columns were present. `financial_records.season_id`, `seasons`, and document `related_module`/`related_record_id` associations were available. Summary, transaction page, options and one record detail completed successfully; income and expense category/source reconciliation returned true. The three list/summary/options queries completed in about 1.6 seconds in that observation; this is not a production load benchmark. No financial values, row identifiers or credentials from that read check are committed.

See [database-review.md](database-review.md) for mandatory/optional schema review and SQL proposals, and [verification.md](verification.md) for check results and integration risks.

## Design review

Uses original-checkout TrackCOOP design references, Impeccable, Taste application-screen guidance and their applicable companion guidance. The existing forest shell, less-beige background, shared white KPI/control cards and right drawers are retained. No new font, icon library, visualization library or global theme is introduced. Taste direction `achromatic-ledger`, seed `1917342096`, was selected after a consumer/pastel draw (`198871509`) conflicted with the financial-workspace brief. Brand and portal consistency take precedence over a generic palette recommendation. Desktop/tablet/phone screenshots were reviewed at 1440/768/390 pixels; dates, phone KPI alignment and bucket bar width were adjusted in the bounded review pass.

## Subsequent integration

The user authorized integration into the original main checkout after the isolated implementation. See [integration.md](integration.md) for merge identity, preserved work, conflict resolutions and combined verification.
