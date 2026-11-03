# Chairman Payments and Share Capital monitoring

Scope: `/portal/chairman/payments` and `/portal/chairman/share-capital`. The existing payment review dialog, Bookkeeper settlement controls, Share Capital ledger and Annual Interest on Share Capital panels remain available. The Financial Overview, Financial Ledger, POS, Rental, membership rules and interest calculation policy are not redesigned by this change.

## Metric contract

### Payments

| Display | Authoritative source and rule | Time / interaction |
| --- | --- | --- |
| Pending Manual Review | Current Pending references in non-gateway channels. Uses the same manual channel distinction as the settlement UI; incomplete QRPH checkouts are separate. | Selected reference-date scope and all non-status filters. Click selects the corresponding table population. |
| Needs Clarification | Current `Needs Clarification` references only. Rejected and Reversed references are separate. | Same base scope; click applies this status. |
| Validated Payments | Distinct references with an authoritative validation timestamp, currently Validated or subsequently Reversed. `validated_at` is preferred; a preserved dated Validated history event is used only when the canonical timestamp is absent. Repeated history rows cannot multiply a reference. | Validation date in the reporting period, independent of the selected table status. Click opens the validation-event population. |
| Validated Payment Volume | MySQL DECIMAL sum of the corresponding distinct reference amounts. This is gross validation activity, includes later reversals, and does not subtract gateway fees. | Same validation-event period; click/info opens the definition and purpose/channel breakdowns. |

Gross validated reference volume is not operating income, bank settlement, available cash or historical net activity. Amounts remain immutable after validation/reversal under the existing reference edit lock. Reversal event counts and amounts use the dated reversal history separately; they are not subtracted across unrelated periods or presented as reconstructed net cash.

Operational scope excludes PayMongo Test references by default and includes live and manual references. Test records remain reviewable through All or Test environment filters. The visible gateway channel is QRPH; stored channel/provider names remain unchanged.

The reference table can use Submitted, Paid or Validated date. Current status queue cards use that selected reference date; validation-event cards always use validation date. KPI status/view selection narrows the table without zeroing the other status KPIs. Purpose, channel, environment, search, source, amount and evidence filters establish the common base. The drawer and export metadata explicitly disclose these distinct time dimensions.

Today/Yesterday/last 7 or 30 days/current or previous month/current year/custom/all-time use the Asia/Manila calendar. Timestamp predicates are half-open UTC intervals, with no `DATE(timestamp)` truncation. Canonical timestamps and stored validation-history timestamps use the existing UTC database contract. A reference with neither a validation timestamp nor a preserved dated validation event is disclosed as undated and excluded from dated validation volume; submitted date is never substituted.

Supporting controls expose validated today, pending gateway checkouts, rejected references, dated reversals, and processing/posting review. Failures refer to recorded processing evidence and do not change payment status.

### Capital

| Display | Source / rule | Scope |
| --- | --- | --- |
| Total Current Share Capital | Sum of `share_capital_accounts.current_balance`. Pending payments are never added. | Selected member/account population, including holders of every official status. Transaction-period and collection-channel filters do not redefine this current liability. |
| Member Contributions This Period | Unique posted Credit transactions with source `share_capital_payment`, matching member/amount and a currently Validated source payment. A linked payment reference, when present, must also match and be a Validated Share Capital reference. Duplicate source credits are counted once and flagged. | Transaction effective date and collection/activity filters. Interest, patronage, adjustments, pending sources and reversed source contributions are excluded. This is effective posted contribution activity using current source validity, not historical net cash. |
| Members Holding Capital | Distinct members with a recorded balance above zero. | Same snapshot/member scope; click opens that holder population. |
| Full Requirement Completion | Assessed eligible members meeting the configured full requirement / all current eligible members. A complete account must agree with posted signed movements and counters and have no source/sequence/unverified-source issues. | The monitoring denominator is explicitly current Approved, Active True Members. Associates are excluded. If an eligible account is unassessed, the denominator is empty, or the view is historical, the rate is N/A rather than a fabricated percentage. |

The eligibility definition is an operational reporting population, not a legal certification or a change to membership status. Governance should confirm whether an alternative inactive/suspended-member obligation population is needed before using this descriptive rate as policy. Their capital holdings remain in liability totals regardless.

The existing application constants remain initial PHP 1,500, full PHP 3,000, and maximum PHP 15,000. Existing payment-time maximum checks and locking are unchanged. Capital above the contribution maximum requires classification review because interest/patronage and other credits can affect the balance. Monitoring does not reject those authorized workflows.

Capital bands are disjoint: zero, greater than zero below 1,500, 1,500 through 2,999.99, 3,000 through 14,999.99, exactly 15,000, and above 15,000. These are balance categories, not membership statuses.

Current balance is a stock; period contribution and payment activity are flows. Payment status filters narrow payment records. Member, account, stage, balance range and reconciliation filters select the population for snapshot metrics. Collection environment/channel, amount/reference, transaction type/direction/status and period filters scope activity. The UI states this difference, and source-activity drawers use the same predicates as the summary.

## Reconciliation and historical assurance

For each account, compare all of the following:

1. Recorded current account balance.
2. Initial + additional + interest counters minus deductions.
3. All posted signed ledger movements (Credit positive, Debit negative).
4. Payment-linked credits, source members/amounts and validated/reversed source state.
5. Approved interest capitalization and, when the optional table is available, approved patronage transfers and their exact transaction links.
6. Source uniqueness, per-row arithmetic, running balance sequence and matching reversal debits.

The canonical reversal workflow leaves the original credit Posted and appends a Posted debit. Both are included in signed movements. Opening contributions represented by migration transactions are not added a second time. Patronage uses `Additional Capital Contribution` as a transaction type, so classification uses its `patronage_capital_transfer` source and never treats it as a cash contribution.

The composition view separates initial member capital, additional member contributions, interest, patronage, other credits and deductions. Unknown/test-funded source assurance is a review condition; the recorded account amount is retained. Missing credits, duplicated/mismatched sources, unsupported source assurance and account/ledger differences identify the affected member and reviewable transactions. No monitoring query repairs data.

A historical balance is reconstructed from recorded Posted signed movements through the chosen effective date. Current account amounts remain available for comparison. An unbacked non-zero opening amount or legacy Reversed transaction without reliable historical treatment makes the member's historical balance unknown. Unknown amounts are explicitly excluded from the partial historical aggregate with a visible count. No historical eligibility percentage is inferred. Later backdated ledger records can restate the current recorded view of a past effective date; this is not an immutable as-known-at-the-time snapshot.

Recorded deadlines are classified only for the applicable current population with assessable current balances, compared with Manila today. A historical balance selection does not turn these into historical eligibility or deadline claims. Due soon defaults to 7 days and can be changed to 30 in the UI (validated API range 1–90). Overdue requires an actual earlier recorded deadline and an unmet requirement. Missing dates are distinct from Not Applicable; no official deadline is invented. Unassessed accounts go to reconciliation review rather than being asserted overdue.

## Workflows and permissions

- New `/api/finance-monitoring/*` endpoints are GET-only and require Chairman or Bookkeeper authentication.
- Chairman remains unable to validate, reject, reverse, retry settlement, record capital or directly change balances.
- Direct `POST /api/share-capital` now enforces Bookkeeper authorization, matching the existing recording UI. Source inspection found no authorized Chairman caller that depends on that route. Chairman interest-declaration governance remains unchanged.
- Payment reference reversal now invokes the existing capital-debit function inside the same transaction before the source is marked Reversed. Insufficient balance rolls back the entire operation; a second reversal is rejected. Both direct capital and reference reversal dates use the shared Manila calendar helper.
- Payment detail links identify the original capital account/credit; capital transaction links open the original payment review dialog and history. Canonical `/portal/...` URLs retain query parameters through the existing route conventions.
- Existing Annual Interest on Share Capital preview, complete fiscal-year/Average Share Month calculation, approval, publication, allocation, withdrawal, capitalization, receipt and audit workflows are retained.

## Filters, paging and exports

Filters use the shared StyledSelect and DatePicker, Apply/Clear, 350ms search debounce, removable chips, validated ranges and URL/back/reload persistence. Sort keys are allowlisted, SQL values are parameterized, and sort ties include record IDs. Both contribution payments and supporting account/transaction lists are paginated by the server with complete matching totals. The old local truncation is removed; overlapping refresh/filter responses cannot overwrite newer results.

Excel exports use the existing report/workbook utilities. Payments exports include complete filtered references, validation/status summary, gross purpose/channel volume and posting review. Capital exports include summary, accounts, current requirement population, composition, ledger activity and reconciliation. Every workbook includes title, cooperative, generation timestamp, timezone, filters, scopes, definitions and limits. PHP values are exact decimal text to avoid binary-money accumulation or spreadsheet precision loss; formula-like text is escaped. No raw webhook payload, signature, secret or unnecessary proof data is exported. More than 100,000 matching rows is an explicit request to narrow the filters, never a silent partial export. Operational exports are not audited statements.

All report queries and exports use a repeatable-read read-only transaction for a consistent request snapshot. They never invoke the legacy rental-reference synchronization write during monitoring. Aggregates use DECIMAL in SQL and retain exact monetary strings for the new summaries, displays and exports; the existing per-reference table keeps its numeric amount contract. JavaScript does not accumulate financial totals.

## Schema and deployment

No new database tables, columns or production migration are introduced. Existing prerequisites include:

- `20261007_share_capital_ledger_and_dividends.sql`
- `20261010_share_capital_workflow_hardening.sql`
- `20261012_dividend_action_approval_workflow.sql`
- Existing gateway settlement, validation-history, receipts and reversal migrations
- `20261030_patronage_capital_transfers.sql` for complete patronage-source assurance

Missing required tables/columns produces an explicit `FINANCE_SCHEMA_REQUIRED` response. Optional patronage-table absence is detected; recorded transfers are shown as unverified, not falsely approved. A staff-only schema endpoint reports table presence, not an assertion that every historical migration/data repair is complete.

On 2026-11-03 a read-only check of the configured remote database confirmed the ten relevant tables, the inspected balance/source/date columns, and UTC session/system timezones. Both new monitoring queries also executed successfully there in read-only transactions without displaying member records or monetary values. One observed request took about 1.2s for payments and 2.2s for capital; this is a single functional check, not a performance guarantee. Existing reconciliation exceptions were reported and left unchanged.

Query review reuses the source uniqueness index, account/member unique key, transaction member/date and member/creation indexes and existing payment/posting foreign-key indexes. Application query count is constant with member count; no per-member network query loop is introduced. Broad exports are capped explicitly. Larger deployments should measure their own query plans before adding indexes; this task does not apply production DDL.

## Implementation and integration

- Backend: `server/src/modules/finance-monitoring/` (validated contract, payment monitoring, capital monitoring/lists, read-only service/router, export).
- Shared dates: `server/src/utils/manila-calendar.ts`.
- Existing workflow corrections: payment reference reversal, Bookkeeper-only capital recording, ledger account balance reconciliation, stable share-capital pagination.
- Frontend: `src/features/finance-monitoring/` plus integration into `FinanceViews.tsx`, `PaymentValidationView.tsx` and `finance-api.ts`.
- Presentation follows the TrackCOOP palette, compact white KPIs with meaningful icons/colors, shared controls, right detail drawers and existing operational tables. Scope/financial qualifications remain findable. The mobile table Actions header uses its accessible name directly so an off-screen absolute hidden label cannot widen the page.

Worktree: `TrackCOOP_ChairmanFinance_Worktree`; branch: `feature/chairman-finance-complete`; base: local main `585528c`. The original main checkout contains unrelated, uncommitted changes in `server/src/app.ts`, `FinanceViews.tsx`, `finance-api.ts` and shared UI. Those files must be integrated by preserving both implementations. Do not replace them wholesale. Untracked design references in the original checkout were read as guidance and were not copied into this commit.

See [verification](chairman-finance-verification.md) for checks and practical limits.
