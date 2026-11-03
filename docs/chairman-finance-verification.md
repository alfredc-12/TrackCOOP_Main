# Chairman finance verification

Verified on 2026-11-03 in `TrackCOOP_ChairmanFinance_Worktree`, branch `feature/chairman-finance-complete`, based on local main `585528c`.

## Checks and results

| Command / verification | Result |
| --- | --- |
| `npm run typecheck` | Passed web and API TypeScript checks. |
| `npm run lint:ci` | Passed without changing `eslint-baseline.json`. Existing debt: 63 errors / 88 warnings against baseline 121 / 106; no file/rule/severity allowance increased. |
| `npm run build` | Passed frontend production build and API compilation. The final UI scope/visual adjustment was also rebuilt with `npm run build:web`; final server output was compiled again with `npm run build:api`. |
| `npm run test:api` | 408 passed, 0 failed, 2 opt-in/existing skips. Executed with explicit disposable-test DB settings, not an environment file. |
| `npm run test:paymongo-core` | 178 passed. Settlement, duplicate/idempotent webhook behavior, receipts, payment transitions and existing membership/payment policy regressions remain green. |
| SQL integration command below | 18 passed (reported root plus 17 cases) on disposable MariaDB 10.4.32. The local MySQL package lacked required runtime files, so its initialization was not used as evidence of successful testing. The new report queries were additionally verified on the configured remote database. |
| Focused policy / capital reversal / money display command below | 8 passed, covering Manila/year/leap boundaries, validated combinations, read-only snapshots, atomic reversal and large exact-decimal display. |
| Production Playwright command below | 12 passed. No teardown failure. |
| `npm run test:records` | Exit 0; no matching client records tests exist in this branch (0 tests). This is not claimed as records behavior coverage. Existing server records regressions are included in the API suite. |
| `npm run security:scan` | Passed after staging the new source, test and documentation files so the Git-based scan included them. No environment files, gateway secrets or generated database keys were staged. |
| `git diff --cached --check` | Passed. |

The API regression process used these task-only settings: `NODE_ENV=test`, `DB_HOST=127.0.0.1`, `DB_PORT=33317`, `DB_NAME=trackcoop_finance_fixture`, `DB_USER=root`, empty fixture-only password. The isolated checkout intentionally has no copied environment file. Some existing modules instantiate a pool during import and require syntactically valid configuration even when their test uses a fake repository. No production credentials were used for the regression suite.

## Exact specialized commands

```powershell
# Disposable SQL test only: initialized in this task checkout, loopback port 33317.
$env:FINANCE_LOCAL_SQL_TEST='1'
node.exe node_modules/tsx/dist/cli.mjs --test server/src/modules/finance-monitoring/finance-monitoring.mysql.test.ts

# Independent policy, workflow and precision checks.
node.exe node_modules/tsx/dist/cli.mjs --test server/src/modules/finance-monitoring/finance-monitoring.policy.test.ts server/src/modules/finance-monitoring/capital-reversal.test.ts src/features/finance-monitoring/monitor-client.test.ts

# Production-browser fixture setup. The web bundle was built with these public test URLs.
$env:PLAYWRIGHT_PORT='3138'
$env:PLAYWRIGHT_API_PORT='5357'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3138'
$env:PLAYWRIGHT_WEB_COMMAND='npm run start:web -- --hostname 127.0.0.1 --port 3138'
node.exe node_modules/@playwright/test/cli.js test tests/e2e/chairman-finance-monitoring.spec.ts --reporter=list --global-timeout=240000
```

The browser build used `NEXT_PUBLIC_API_URL=http://localhost:5357` and `NEXT_PUBLIC_APP_URL=http://localhost:3138`. These are test-process settings, not committed runtime defaults. Build with the deployment's normal public environment when integrating or deploying. Original development servers and dependencies were not changed.

## Financial cases checked

- Distinct manual and gateway pending populations; clarification and rejected/reversed states stay separate.
- Exact `0.10 + 0.20 = 0.30` database aggregation, no repeated-history multiplication, and aggregate display beyond JavaScript Number precision.
- Live/Test/Manual scope; default operational exclusion of Test collections while recorded capital liabilities stay visible with source-quality disclosure.
- Manila midnight, yesterday, rolling days, leap month and year boundaries; old submission/new validation; reliable stored-history fallback; no invented date for undated legacy references.
- Status-card base scope stays stable when selecting the validation-event table. Date, amount, purpose/channel and evidence filters are validated and shared with their corresponding summaries/lists.
- Expected POS/Rental income postings and member-linked capital postings; missing/duplicate/mismatched source review, receipt/event evidence, and active income left after reversal.
- Account balance versus signed posted ledger and counters; source/payment identity and amount matching; unique contributions; missing/duplicated credits; interest and patronage separation; explicit unavailable optional source assurance.
- Applicable current True Member completion, unknown/unassessed rate handling, disjoint capital bands, no-account profiles, actual recorded overdue/due-soon dates and historical reconstruction limits. Unknown assessment is not Not Applicable, and current deadline monitoring never combines historical balance with current eligibility.
- Atomic capital debit on authorized reversal, rollback for insufficient balance and rejection of a second reversal.
- Full server pagination and stable date/id sorting; export completeness beyond the current page, exact decimal text and formula-safe output.
- API denial for member/non-staff monitoring and export access; denial for Chairman direct capital recording; Bookkeeper recording remains available.

## Browser and visual evidence

`tests/fixtures/finance-monitoring.json` was captured exclusively from the disposable SQL seed. It contains no production records. Browser requests use that test fixture; real SQL arithmetic and export content were verified separately by the database suite. UI verification is Chromium at 1440, 768 and 390 pixels, not a claim of testing every physical device or browser.

All six final full-page screenshots were opened and reviewed:

- `test-results/chairman-finance-monitorin-20b78-e-compact-layouts-at-1440px-chromium/payments-1440.png`
- `test-results/chairman-finance-monitorin-20b78-e-compact-layouts-at-1440px-chromium/capital-1440.png`
- `test-results/chairman-finance-monitorin-30fab-le-compact-layouts-at-768px-chromium/payments-768.png`
- `test-results/chairman-finance-monitorin-30fab-le-compact-layouts-at-768px-chromium/capital-768.png`
- `test-results/chairman-finance-monitorin-af67d-le-compact-layouts-at-390px-chromium/payments-390.png`
- `test-results/chairman-finance-monitorin-af67d-le-compact-layouts-at-390px-chromium/capital-390.png`

The finance page itself no longer overflows; wide tables remain independently scrollable. The new Actions column uses an accessible header name rather than an absolute hidden span outside its scroll container. Drawers support Escape, focus containment and return. Tests exercise Apply/Clear, custom combobox values, search debounce, chips, URL/back/reload, custom calendars, pagination, exports, history/source navigation, empty/error recovery and read-only Chairman controls.

## Configured-database verification and prerequisites

A bounded read-only schema check used the existing local configuration without printing credentials. The configured remote database has the ten inspected relevant tables and the inspected source/balance/date columns; session and system timezones were UTC. Both report methods subsequently executed in repeatable-read READ ONLY transactions. Only success/timing and data-quality booleans were printed, not member records or amounts. Existing reconciliation exceptions were reported and left unchanged. This is functional/schema verification, not a certification that every historical record is correct.

No production migrations, table alterations, balance repairs, payment mutations, notifications or emails were executed. The disposable database server was stopped after checking its `@@datadir`; both generated test directories were removed. Reproducible seed definitions and the browser fixture remain in source, while `.next`, dependencies and screenshots remain ignored review artifacts.

Existing ledger/settlement/interest migrations are prerequisites; no new schema migration is needed. Completion uses the explicit current Approved/Active True Member reporting population. Confirm any broader inactive/suspended-member policy with cooperative governance before reinterpreting that descriptive denominator.

## Integration boundaries

The original `TrackCOOP_Main` checkout remains on `main`; task changes have not been merged or pushed. It contains pre-existing staged/unstaged changes, including overlapping `server/src/app.ts`, `src/features/finance/FinanceViews.tsx` and `src/features/finance/finance-api.ts`. Preserve those and untracked/shared design work during integration. Merge route registrations, new monitoring integration and pagination helpers by intent rather than replacing complete files. The feature branch and worktree are retained for review and the user's exact merge trigger.

## Changed files

- `.gitignore`
- `docs/chairman-finance-audit.md`
- `docs/chairman-finance-metrics.md`
- `docs/chairman-finance-verification.md`
- `server/src/app.ts`
- `server/src/modules/finance-monitoring/capital-lists.ts`
- `server/src/modules/finance-monitoring/capital-monitoring.ts`
- `server/src/modules/finance-monitoring/capital-reversal.test.ts`
- `server/src/modules/finance-monitoring/finance-monitoring.export.ts`
- `server/src/modules/finance-monitoring/finance-monitoring.mysql.test.ts`
- `server/src/modules/finance-monitoring/finance-monitoring.policy.test.ts`
- `server/src/modules/finance-monitoring/finance-monitoring.routes.test.ts`
- `server/src/modules/finance-monitoring/finance-monitoring.routes.ts`
- `server/src/modules/finance-monitoring/finance-monitoring.schema.ts`
- `server/src/modules/finance-monitoring/finance-monitoring.service.ts`
- `server/src/modules/finance-monitoring/payment-monitoring.ts`
- `server/src/modules/payment-references/payment-reference.reversal.ts`
- `server/src/modules/payment-references/payment-validation.repository.ts`
- `server/src/modules/share-capital/share-capital-ledger.repository.ts`
- `server/src/modules/share-capital/share-capital-summary.test.ts`
- `server/src/modules/share-capital/share-capital.repository.ts`
- `server/src/modules/share-capital/share-capital.routes.ts`
- `server/src/modules/share-capital/share-capital.types.ts`
- `server/src/utils/manila-calendar.ts`
- `src/features/finance-monitoring/ChairmanCapitalView.tsx`
- `src/features/finance-monitoring/FinanceMonitoring.module.css`
- `src/features/finance-monitoring/MonitorFilters.tsx`
- `src/features/finance-monitoring/MonitorUi.tsx`
- `src/features/finance-monitoring/PaymentMonitorPanel.tsx`
- `src/features/finance-monitoring/monitor-client.test.ts`
- `src/features/finance-monitoring/monitor-client.ts`
- `src/features/finance/FinanceViews.tsx`
- `src/features/finance/PaymentValidationView.tsx`
- `src/features/finance/finance-api.ts`
- `src/features/finance/share-capital-pagination.test.ts`
- `tests/e2e/chairman-finance-monitoring.spec.ts`
- `tests/fixtures/finance-monitoring.json`
