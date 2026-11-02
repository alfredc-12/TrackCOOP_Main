# Chairman Financial Overview (`/portal/chairman/finance`)

A read-only workspace for the cooperative's **recorded expenses**: what was recorded, which categories account for it, how it changed, and what needs checking. It does not show income, net surplus, share capital or patronage (Financial Analytics, Share Capital and Patronage own those), and it does not edit anything (recording, posting, correcting and voiding stay with the Bookkeeper and the Financial Ledger).

Code: `server/src/modules/expense-overview/` (API) and `src/features/expense-overview/` (page). Tests: `expense-overview.*.test.ts`, `src/features/expense-overview/expense-client.test.ts`, `tests/e2e/chairman-expense-overview.spec.ts`.

## Confirmed problems in the previous page, and what fixed them

| # | Finding (verified in code) | Fix |
| --- | --- | --- |
| 1 | The route rendered `OperatingExpensesView` and the shared Financial Dashboard together | Route now renders only `ExpenseOverviewClient`. `/financial-dashboard` is untouched. |
| 2 | A Record Expense form was on the Chairman page | Gone. `OperatingExpensesView` is unchanged and is still the Bookkeeper's page. |
| 3 | `POST /operating-expenses` allowed Chairman and Bookkeeper | Bookkeeper only (`finance.routes.ts`). Tested for both roles. The list and report GETs stay available to both. |
| 4 | Only a hard-coded set of category codes counted | Classification registry plus the category's own `category_type`; custom Expense categories are counted (flagged "by default rule"), nothing is silently dropped. |
| 5 | POS and Rental rows were excluded | Included whenever their category classifies as operating. |
| 6 | Posting approver not required | `approved_by IS NOT NULL` is part of the one shared predicate (also added to the Bookkeeper list/report query). |
| 7 | At most 100 records | Server-side paging over everything; exports page through the whole filtered set. |
| 8 | "Patronage Basis" KPI was a static word | Removed; the four KPIs are computed. |
| 9 | The PDF received only the 100 most recent records | `operatingExpenses(query, { all: true })` pages through all of them. Integration-tested with 130 rows. |
| 10 | `financial_records` does not prove payment | The page says so, shows no cash-outflow figure, and the record drawer states what cannot be confirmed. |

## The one posting rule

`record_type = 'Expense' AND record_status = 'Active' AND approved_by IS NOT NULL AND reversal_of_record_id IS NULL`, plus the selected classification, filters and period (`expense-overview.repository.ts`, `viewSql.posted`).

* A reversed or corrected original has a non-Active status and is excluded. The payment-reversal flow offsets with a negative **Adjustment** row, which is not an Expense, so nothing is counted twice or netted twice. The code never sets `Corrected` or `correction_of_record_id` today; a replacement row would simply be a new Active expense.
* Reporting date is `record_date` (a DATE) read in Asia/Manila. Records dated after today are not counted and are listed in the integrity panel.
* **As-known snapshot:** figures describe the ledger as it stands now. Voiding or correcting a past row changes that past period's total; there is no historical "as it was known then" view and none is reconstructed.

## Classification (`expense-classification.ts`)

| Class | Meaning | In the headline? |
| --- | --- | --- |
| Operating | Registry codes (salaries, fuel, utilities, repairs, office, insurance, transportation, other) and any unknown **Expense** category (default rule) | Yes (default) |
| Other recognized | `PRODUCT_COST` (goods bought for resale) | Selectable |
| Capital | `CAPITAL_EXPENDITURE`, `EQUIPMENT_PURCHASE`, `ASSET_ACQUISITION`, `FIXED_ASSETS` (none exist in the data today) | Selectable |
| Non-expense disbursement | `DIVIDEND_PAYMENT`, `SHARE_CAPITAL`, refunds, principal, transfers, and every row whose source is Share Capital | Selectable, never in operating |
| Needs classification | An Expense row on an Income/Both category | Selectable |

The registry is code, not data. Nothing in the database was changed or reclassified. **The registry is a proposed policy and needs the cooperative's confirmation** (notably `PRODUCT_COST`, and defaulting unknown Expense categories to operating).

## Reconciliation with Financial Analytics

Financial Analytics counts every posted, non-capital-movement Expense. The summary reports that figure (`analyticsComparableTotal`) next to the sum of all classes except non-expense disbursements (`recognizedExpenseTotal`); they are equal when the page and Analytics see the same population. `financial-posting-rules.ts` (which defines Analytics' rule) is **uncommitted in the original checkout**, so this branch re-implements the same rule in `analyticsComparable`. See "Integration risks".

## KPIs and other figures

* **Total posted operating expenses** = SUM(amount) over distinct posted records (integer cents). Count = distinct record IDs; average = total ÷ records, N/A at zero.
* **Expense change** = current − previous; % = change ÷ previous × 100 only when previous > 0, otherwise N/A with the peso change shown. An unfinished period is compared with the same number of elapsed days (this month on the 12th vs 1st-12th of last month; a finished month vs the whole previous month, with month-end/leap-year clamping). Options: previous equivalent, same period last year, none.
* **Largest category** = max total by category ID; share = category ÷ total.
* **Category, source, matrix and trend totals** all add up to the headline; the API verifies it (`reconciles`) and the UI warns if not. **Drivers**: category changes sum to the overall change, including new and stopped categories.
* **Budget context**: each posted expense is assigned to the single most specific approved line covering it (season-specific first, then latest coverage start), so overlapping budgets never count one expense twice. This differs deliberately from Budget Controls' enforcement query, which counts all Active expenses; see the doc comment in `budgetContext`.
* **Observations** are rule-based sentences, each carrying its figure, period and comparison basis; none forecasts or explains a cause.

## API (all `GET`, Chairman only; the Bookkeeper and members get 403)

`/api/financial-overview/expenses/` `summary`, `trends`, `categories`, `sources`, `drivers`, `matrix`, `records`, `records/:id`, `integrity`, `budget`, `insights`, `options`, `export`. Filters are validated once (zod) and parsed identically by every endpoint: `period, startDate, endDate, compare, categoryIds, sourceModules, classes, amountMin, amountMax, recordedBy, postedBy, seasonId, budget, search`; the table adds `view, page, pageSize, sortBy, sortDirection` (allow-listed). SQL is parameterized; there are no N+1 queries; detail views (matrix, record, period, category) load on demand.

Exports (`kind` = summary, records, categories, comparison, sources, integrity; `format` = xlsx, pdf) carry the cooperative name, generation time, period, comparison, filters, definitions and the "not an audited financial statement / not cash outflow" notes. Records exports cover the entire filtered population (Excel up to 100,000 rows, PDF up to 5,000, else a clear 413). Spreadsheet text is protected against formula injection.

## Not available, and why

* **Confirmed cash outflow / partial payments / payee:** the ledger has no disbursement events. Rental expense entries store a payee and method as JSON in `remarks`; these are shown as "as entered", never as proof.
* **Evidence coverage:** `documents` has no link to financial records.
* **Budget context / seasons** appear only if their migration (`20261027`) is applied; the page detects this and says so otherwise.

## Tests

`npm run test:api` (unit + routes, including the Chairman 403 on `POST /operating-expenses` and the absence of write endpoints), `EXPENSE_TEST_DB_NAME=<name>_test` for the 20 MySQL integration tests (hand-computed fixture; refuses any database not ending in `_test`), `tests/e2e/chairman-expense-overview.spec.ts` (20 browser tests incl. 1440/768/390px).

## Integration risks

* The original checkout has uncommitted edits to `finance.repository.ts`, `finance.schema.ts`, `finance.types.ts`, `financial-transparency.ts`, `FinanceViews.tsx`, `finance-api.ts` and `chairman/finance/page.tsx`, and untracked `financial-posting-rules.ts`, `financial-analytics/`, `SearchableCombobox.tsx` and a rewritten `StyledSelect.tsx`. This branch touches `finance.repository.ts`, `finance.routes.ts`, `finance.service.ts` and `chairman/finance/page.tsx`. `finance.repository.ts` and `page.tsx` will need a hand merge; when `financial-posting-rules.ts` lands, replace the inline analytics-comparable predicate with `postedOperatingSql`.
* `PeopleFilterUi.tsx` gained an optional `hint` prop on `KpiCard` and a two-line label; the People pages are unaffected.
