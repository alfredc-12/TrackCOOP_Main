# Chairman Member Analytics — implementation record

Status: implemented and verified locally. Source brief: the user's complete Chairman Member Analytics Dashboard brief, 2026-11-02. This task does not authorize a commit, push, merge, deployment, production migration, or recalculation of production indicators.

## Confirmed audit

- Existing Member Dashboard is `src/app/(portal)/chairman/dashboard/page.tsx`, using `DashboardClient` in member mode. Financial Dashboard uses the same legacy component in financial mode and must stay operational.
- Combined `/api/chairman/dashboard` accepts limited filters, but its demographics query does not use those filters. Member mode also contains obsolete minimum-capital text and hypothetical planning calculations. New member analytics will use a separate chairman-only service/client; financial mode is retained.
- Read-only information_schema/settings inspection of the configured database succeeded. Fourteen relevant tables exist, including member/application histories, participation, RFM snapshots, capital accounts/transactions, and referrals. No `member_sectors` relationship table exists. `member_profiles.sector` is a single enum: Rice, Corn, Fishery, Livestock, High-value crops (gulayan). Multi-select filtering is supported over primary sectors; multi-sector assignment history is explicitly unavailable.
- RFM uses qualifying cooperative participation and validated capital, configured threshold/label settings, and its existing zero-frequency/365-day inactivity safeguard. Persisted snapshots contain formula version and basis dates but older basis summaries lack an effective-settings fingerprint. Dashboard reads must not recalculate scores or change official status. Future recalculations will record a fingerprint in the existing basis_summary field without changing scoring rules.
- Capital authority is posted ledger credits minus debits, including posted debit reversals. `reconcileMember` already uses that formula; reversal posting leaves the original credit posted and adds a posted debit. Do not double-count payment rows alongside ledger entries. Account-versus-ledger discrepancies and validated payments missing ledger entries must be reported. The required capital defaults are the existing 3,000 / 15,000 constants and approved membership settings. No deadline is synthesized.
- Approval uses `member_profiles.approved_at`; explicit application Approved history may supply a missing timestamp, never row creation time. Application approval is guarded by validated membership payment and then marks pending referrals Successful; analytics rechecks linked approval/payment evidence and does not invent monetary rewards.
- Existing Member Directory: `MembersClient` defaults to Applications. Analytics links must select the Directory tab and preserve semantic analytics filters; a matching-members endpoint will reuse the existing MemberRepository projection, authorization and pagination. No Member Explorer is added to the dashboard.
- The published GeoJSON map is retained. It has 42 local polygons, explicit unknown-location accounting, sequential legend, hover/tap/keyboard details and a static Next geometry endpoint. The source `Nasugbu.geojson` stays unchanged.

## Contracts and guardrails

- Reporting dates are cooperative-local Asia/Manila dates. An as-of date is inclusive; UTC timestamps use the next Manila midnight as an exclusive bound. Date-only ledger/activity values remain date-only. Reporting events and snapshot stocks are labelled separately.
- Populations count distinct approved member IDs. Official status and RFM engagement are separate. Filters are validated server-side, applied to the same source population, and carried in URLs. Missing approvals or temporal history produce coverage notes/unavailable comparisons rather than fabricated dates or zero denominators.
- Current ledger snapshots are restated from currently posted entries by effective transaction_date, matching existing ledger behavior. Historical sector/location classifications are not versioned; current classifications are disclosed when analysing historical approvals.
- Mature 30/60/90-day participation cohorts use qualifying activity records and configured participation statuses. Incomplete windows are not failures. Missing activity coverage is disclosed.
- Engagement movement requires comparable basis signatures, formula versions and effective-settings fingerprints. Missing legacy fingerprints do not imply a valid comparison.
- True Member completion denominators exclude ordinary Associates. Explicit provisional True Member obligations/deadlines are shown separately and may contribute to attention reasons when supported by records.
- One unified overlay state: left barangay/sector matrix, right analytical details; full-height responsive sheets, focus return, Escape/backdrop/close behavior. Main page contains charts and compact summaries, not detailed record tables.
- Query results are read-only and aggregated in bounded batches, with parameterized SQL and capability checks for optional tables. Finance APIs, payments, approvals, referral qualification and the RFM scoring formula stay unchanged.

## Work sequence

1. Source audit and live schema observation (complete).
2. Typed filters, time/population definitions and a pure analytics engine with calculation tests.
3. Read-only repository, authorized routes, matching-member integration and exports.
4. Dedicated member analytics UI, connected filters, six KPIs, charts, map enhancements, left/right drawers and management links.
5. Calculation/access/regression tests, desktop/tablet/mobile browser checks, typecheck/lint/build and final coverage documentation.

## Delivered implementation

- Dedicated `server/src/modules/member-analytics/` contracts, validated Manila date filters, source-column readiness, read-only repeatable-read repository, pure analytics engine, chairman-only service/routes and OOXML Excel export. Calendar-equivalent RFM bases handle different month-end days; official-history timestamp ties use the latest history ID.
- Future RFM calculations record their actual configuration fingerprint inside existing `basis_summary`; the existing scoring formula and safeguard remain unchanged.
- `src/features/member-analytics/` owns the compact staged filter panel, six KPIs, growth/RFM/capital/sector/recruitment/referral charts, observation rules and unified analytical drawers. Supporting tables sort meaningful values (including formatted currency/decimal percentages) and paginate; action-only columns do not get decorative sort buttons.
- `chairman/dashboard/page.tsx` now opens that dedicated client. Financial Dashboard retains its existing client and combined endpoint.
- Existing GeoJSON map gains membership/RFM/growth details, range highlighting, selection highlighting, reset, native fullscreen and a Radix expanded-map fallback. The source geometry is unchanged. Keyboard activation is handled once instead of bubbling into Leaflet's popup toggle.
- Existing Member Management hydrates the Directory tab and semantic analytics context; matching IDs are selected before its existing repository pagination. Namespaced current-directory filters remain distinct from as-of analytics filters. Overall summary cards are labelled accordingly.
- Main design-system index and existing-pattern reference now link the implemented composition and its source/coverage definitions.

## Final verification

Commands used the Windows `npm.cmd` / `npx.cmd` wrappers because PowerShell blocks `npm.ps1` on this machine. API regressions ran with email disabled, local storage, gateway disabled and dummy local DB configuration; tests inject repositories/services rather than mutating the online database.

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed, web and API |
| `npm.cmd run lint:ci` | Passed; 55 existing errors / 77 warnings covered by the unchanged baseline; no new file/rule/severity debt |
| `npm.cmd run test:api` | Passed, 376 tests |
| `npm.cmd run test:paymongo-core` | Passed, 177 tests, including existing finance permission/interaction regressions |
| `npm.cmd run test:records` | Completed successfully; the existing glob discovers **0 tests** |
| `npx.cmd tsx --test src/features/member-analytics/*.test.ts` | Passed, 3 filter/request/sorting tests |
| `npm.cmd run security:scan` | Passed |
| `npm.cmd run build` | Passed, Next production build (105 routes) and API build |
| `npm.cmd run build:api` | Passed again after the final backend history-timestamp tie correction |
| `node.exe node_modules/@playwright/test/cli.js test tests/e2e/member-analytics.spec.ts tests/e2e/barangay-map.spec.ts --reporter=list` | Passed, **14 tests** against the local production build |
| `git diff --check` | Passed |
| `git diff --exit-code -- eslint-baseline.json` | Passed; baseline unchanged |

The browser command used `PLAYWRIGHT_PORT=3132`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3132`, and `PLAYWRIGHT_WEB_COMMAND="npm run start:web -- --hostname 127.0.0.1 --port 3132"`. Its fake auth/API responses and neutral basemap tiles are test-only. The actual static Next geometry route was exercised. The suite covers 1440/768/390px layout, no page overflow, real polygon hover/keyboard/tap summaries, filter Apply/URL/Back behavior, right drawers and left matrix/focus return, cell-to-polygon selection, direct chart selection context, empty/error/retry, downloads, existing Directory integration, Financial Dashboard compatibility and fullscreen fallback. Desktop and mobile captures received one batched review and a bounded confirmation; no unrelated portal redesign was performed.

A separate read-only report query against the configured online database succeeded with all source categories available: 220 approved dated members, 44 geographic rows, 0 undated approvals and 0 unknown/reconciliation capital records. RFM movement correctly reports 220 members without comparable fingerprinted historical pairs. This is live query/schema validation, distinct from the mocked browser suite. No database migration, data backfill or production RFM recalculation ran.

The temporary production-preview server was used only for verification. Unrelated working-tree changes, environment files, payment/approval behavior, media resolution and the Financial Dashboard were preserved. Changes remain local.
