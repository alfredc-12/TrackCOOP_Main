# Chairman Member Indicator Workspace

Route: `/portal/chairman/member-indicators`.

This is an advisory RFM verification workspace, separate from Member Management and the broader Chairman dashboard. It never changes official member statuses, capital balances, accounts, applications, or penalties.

## Confirmed population and scoring contract

The user confirmed the population on 2026-11-02: `member_profiles.approval_status = 'Approved'` and `official_member_status IN ('Active', 'Inactive')`. Pending, Rejected, Suspended, and Terminated profiles are excluded. Historical browsing applies this **current eligible population**; it does not reconstruct historical membership eligibility.

The existing `calculateMemberIndicator` engine remains the only scoring implementation. Configured settings override the existing fallback thresholds. Invalid configured values produce a clear error rather than silently manufacturing zero values or saving fallback results.

| Component | Source and basis | Fallback thresholds |
| --- | --- | --- |
| Recency | Last participation whose activity qualifies and participation status matches configured statuses, through basis end | ≤30: 5; ≤90: 4; ≤180: 3; ≤365: 2; otherwise/none: 1 |
| Frequency | Qualifying participation records inside the inclusive rolling 12-month period | ≥12: 5; ≥6: 4; ≥3: 3; ≥1: 2; otherwise: 1 |
| Contribution | Validated, non-reversal share-capital payment records through basis end | ≥PHP15,000: 5; ≥PHP3,000: 4; ≥PHP1,500: 3; ≥PHP0.01: 2; otherwise: 1 |

Total = R + F + C, from 3 to 15. Fallback labels: Active ≥12; Needs Monitoring ≥7; otherwise Inactive. The existing zero-frequency/no-participation-within-365-days safeguard overrides labels regardless of total. Contribution does **not** include POS/rental spending, ledger interest, or unrelated capital adjustments. Rejected/Reversed payments and reversal entries are excluded.

The backend derives basis start by subtracting 12 calendar months and clamping leap-day/month-end dates. Future calculations and nonrolling start/end pairs are rejected. The basis is inclusive at both ends, preserving the established rolling-date contract.

## Snapshot integrity

- Current Scores selects the latest valid saved basis end per member, then computation timestamp, then numeric indicator ID. It discloses mixed basis periods.
- Historical Snapshot selects the exact requested basis end. Missing historical scores remain unscored; today's results are never substituted.
- Calculation History selects an actual run. Its population is the distinct eligible members represented by saved observations in that run.
- Legacy runs are explicitly approximate groupings by exact timestamp, basis, and version because original run IDs were not preserved.
- Individual history is paginated, ordered by basis end, and includes undated legacy observations with a review flag. A high ID from an older historical recalculation cannot displace a newer basis.
- Comparable history requires distinct chronological basis dates, matching formula versions, and matching nonempty preserved configuration fingerprints. Repeated runs for one period are not separate months. Charts use actual saved observations without invented monthly points; the history table supplies their text alternative.

New observations preserve the effective configuration, canonical SHA-256 configuration fingerprint, run UUID, actor, raw metrics, safeguard outcome, and immutable participation/payment evidence in `basis_summary`. Existing saved observations are not rewritten. Legacy thresholds/evidence are explicitly unavailable when not originally preserved; present-day sources are never presented as original historical evidence.

The fingerprint uses the same canonical field order and safeguard identifier as the parallel Member Analytics configuration reference in the main checkout, without copying or committing that agent's uncommitted files.

## Filters, aggregation, and quality

The dedicated workspace contract contains nullable indicator fields for unscored eligible members. The legacy list/detail/summary contracts remain available and retain their scored-row shape. The legacy summary now accepts its list filters.

Search, classification, membership type, official status, barangay, primary sector, component scores, raw metric ranges, total score ranges, quality, version, snapshot, sorting, and pagination are validated on the server. SQL identifiers come from allowlists; user values are parameters. Search treats wildcard characters literally. The selected population is counted once per member before pagination. KPIs, median/average, component distributions, matrix, filtered totals, and exports share that same population in a repeatable-read transaction.

Coverage is scored / eligible ×100. Classification percentages use scored members. Zero denominators produce unavailable percentages, not fabricated percentages. Invalid or missing selected snapshots are not assigned an Inactive label.

Quality definitions:

| State | Definition |
| --- | --- |
| Current | Today's basis and compatible preserved configuration/evidence; source freshness remains unverified |
| Potentially Outdated | Current-view basis precedes today; an attention flag, not proof that sources are stale |
| Historical | Explicit saved historical basis/run context |
| Missing | No selected saved observation |
| Incompatible Version | Saved formula/configuration differs from effective settings |
| Requires Review | Invalid/incomplete calculation basis, invalid score, or missing original configuration/evidence |

Calculation age is elapsed days from `computed_at`; basis age is days from basis end in the Manila calendar. Source freshness and operational completeness are **not independently verified**. No qualifying participation or validated payment rows is recorded absence, not proof that source data is complete. Only the primary `member_profiles.sector` relationship exists in this committed schema; a future multiple-sector model must use distinct-member joins when integrated.

## Recalculation and concurrency

1. Choose member/all eligible population and explicit end date.
2. Request a read-only server dry run using the same engine and source loader as save.
3. Review affected population, basis, settings, zero-evidence conditions, new-for-basis members, and classification changes against the preceding saved observation for that exact basis.
4. Explicitly confirm saving. Table filters never restrict Recalculate Eligible Population.
5. The server acquires a database-scoped MySQL named lock and checks the preview fingerprint again. Changed sources, settings, population, or prior saved observations require another preview. Failed saves roll back the entire calculation, preserve old results, and release the lock.
6. Identical member/basis/configuration/evidence observations are skipped. Changed results append history. Audit entries retain the run reference and outcome, including all-identical runs with no new observations.

The UI prevents duplicate clicks. The legacy recalculation route remains compatible for existing callers and delegates to the same safe repository, eligibility, date, transaction, metadata, and duplicate policies. The redesigned UI exclusively uses the explicit preview/confirmed-save endpoints.

## API and reports

All workspace routes are behind the existing chairman authentication/role middleware and return `Cache-Control: no-store`:

| Route under `/api/member-indicators/workspace` | Purpose |
| --- | --- |
| `GET /` | Paginated results plus consistent summary, diagnostics, matrix, options, settings |
| `GET /export` | All matching authorized rows, independent of pagination |
| `GET /runs` | Paginated saved runs / labelled legacy groups |
| `GET /:memberId/history` | Paginated actual saved observations |
| `GET /:memberId/history/export` | Complete member history in one read snapshot |
| `GET /:memberId/evidence/:indicatorId` | Original saved evidence/configuration, or explicit legacy limitation |
| `POST /preview` | Read-only dry run |
| `POST /recalculate` | Explicit confirmation plus preview fingerprint required |

Excel is a real OOXML `.xlsx` workbook using the existing JSZip dependency. Sheets: RFM Summary, Member Indicator Results, Component Distribution, Comparison Matrix, Methodology, and Data Coverage. Member history has its own workbook. Text uses inline-string cells and formula-prefix escaping; numeric/currency/date cells retain their types. Reports include generation date, filters, actual basis, versions, official status distinct from advisory RFM, and coverage. More than 100,000 matching members or 10,000 member-history observations yields an explicit export error instead of silent truncation.

Print Summary hides portal/navigation/actions and labels the displayed results as the current page. Excel supplies complete filtered results.

## Required migration and operational limits

Review and apply `server/database/migrations/20261102_member_indicator_workspace.sql` through the normal migration process before enabling large evidence snapshots. It idempotently widens `basis_summary` from TEXT to MEDIUMTEXT and adds `(member_id, basis_period_end, computed_at, indicator_id)`. It preserves scores and existing metadata and does not invent historical configurations. The existing September 2026 participation/RFM migration is a prerequisite. The new query uses MySQL 8 window functions and CTEs.

No production migration, merge, push, deployment, or existing-data deletion was performed. The metadata remains subject to database packet/column limits. Synchronous full-population recalculation is serialized; very large cooperatives may later need a durable background-job implementation. No artificial progress percentage is shown.

## Implementation and integration touch points

- `src/features/member-indicators/`: workspace, controls, diagnostics/matrix/quality/run drawers, member evidence/history, confirmation workflow, CSS, HTTP client, and comparison helpers.
- `src/app/(portal)/chairman/member-indicators/`: existing route retained, with Suspense around URL-aware client rendering.
- `server/src/modules/member-indicators/`: dedicated workspace types/policy/query/repository/router/export; legacy controller/service/repository adapted without changing existing caller DTOs.
- `src/components/ui/StyledSelect.tsx`: original string API preserved; Radix supplies keyboard/typeahead, focus return, and portalled collision-aware placement. No native select/datalist was introduced.
- `src/app/(portal)/chairman/members/MembersClient.tsx`: read-only RFM deep link opens the existing profile and returns to preserved RFM filters. It does not duplicate administrative controls.
- `server/src/modules/members/member.repository.ts` and `server/src/modules/dashboard/dashboard.repository.ts`: latest indicator reads order by valid basis before computation time/ID so historical recalculation cannot regress those consumers.

The worktree starts from committed `2ebae95`, excluding the main checkout's uncommitted design-system and analytics changes. Feature CSS references authoritative `--coop-*` variables with matching fallbacks because those token files were untracked at isolation time. Shared controls, the members page/repository, and the legacy indicator repository may need careful integration with the main checkout's existing edits. Do not overwrite either version wholesale. The main checkout's `.env`, finance, public UI, design-system references, and analytics feature changes were not copied into this commit.

See [verification.md](verification.md) for checks and the actual UI reference paths.
