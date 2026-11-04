# Chairman member analytics

The member overview at `/portal/chairman/dashboard` now uses a dedicated, read-only member analytics service. The Financial Dashboard still uses its existing `DashboardClient mode="financial"` and `/api/chairman/dashboard` contract.

## Entry points

- `src/features/member-analytics/MemberAnalyticsClient.tsx`: connected filters, six KPIs, charts, map, insights and report export.
- `AnalyticsFilters.tsx`: staged filters with explicit Apply/Clear, removable applied chips and URL persistence.
- `AnalyticsDrawer.tsx`: one dashboard overlay state; the barangay/sector matrix opens on the left, other analyses on the right. Radix handles focus containment, dismissal and focus return. Long tables sort and paginate; referrer/location tables also search.
- Existing `DemographicsMap.tsx`: unchanged local GeoJSON geometry, enriched hover/popup summaries, count-range highlighting, reset, native fullscreen and an accessible expanded-map fallback.
- Existing Member Management receives semantic analytics filters and a selection. It remains the individual-record workspace; the dashboard does not introduce a Member Explorer.

## API and authorization

All three routes require an authenticated **Chairman**. Bookkeeper and Member requests are denied before source reads. Responses use `private, no-store`.

| GET route | Result |
| --- | --- |
| `/api/chairman/member-analytics` | Typed, filtered aggregate report |
| `/api/chairman/member-analytics/matching-members` | Existing Member Directory projection/pagination, after the full analytics population and semantic selection are applied |
| `/api/chairman/member-analytics/export` | Excel workbook containing the complete filtered aggregate dataset, context, definitions and coverage |

Filters: `start`, `end`, `asOf`, pipe-separated `barangays`/`sectors`, `membershipType`, `engagement`, `officialStatus`, `capitalStage`, and `source`. Dates are validated; the reporting end cannot exceed as-of, future snapshots are rejected, and custom ranges are bounded to 3,660 days. Defaults use the current cooperative-local year and date. No API request runs on each filter keystroke.

Semantic selections: `new`, `attention`, `overdue`, `deadline`, `engagement`, `capital`, `sector`, `month`, and `barangay` (optionally `cellSector`). Member Directory's additional **current-field** filters use separate `directoryMembershipType`, `directoryOfficialStatus`, `directoryBarangay`, and `directoryApprovalStatus` parameters. This avoids accidentally overriding a historical analytics selection with a current membership type. Directory summary cards remain explicitly labelled overall membership.

The repository reads a repeatable-read, read-only transaction. Metadata checks cover the actual required columns; optional incomplete sources become explicit unavailable sections. An incomplete core member schema returns a descriptive 503. Values are parameterized; no reconciliation, scoring, approval, payment, migration or reward writes happen on analytics reads.

## Calculation rules

- **Population:** distinct currently approved member IDs with an actual `approved_at` on/before the snapshot date. An explicit Approved application-history timestamp is the only missing-date fallback. Row creation dates are never substituted. Official membership histories determine types/statuses when available; historical eligibility, sector and location gaps are disclosed as restated current classifications.
- **Time:** cooperative-local `Asia/Manila` dates. Timestamp cutoffs use the following Manila midnight as the exclusive UTC bound. DATE ledger/participation values retain their recorded calendar dates.
- **Growth:** `(population at reporting end − population before reporting start) / population before reporting start × 100`. Zero base is N/A. New approvals use actual dates within the reporting period; stock and event dates are labelled separately. Comparison series use equivalent previous-year dates, including leap-day clamping. Monthly/quarterly/yearly views aggregate the same response.
- **Participation:** distinct new approvals with recorded qualifying cooperative participation within 30/60/90 days. Only fully observed windows enter the denominator. The activity qualifying flag and configured participation statuses match the existing RFM sources. Zero means no qualifying record, not proof that an unrecorded activity did not happen.
- **RFM:** persisted labels and component scores only; no independent scoring formula. Not Yet Scored remains separate. Movement requires distinct eligible snapshots, equal scoring version, equal effective-settings fingerprint and comparable calendar/day basis. Future authorized recalculations store the fingerprint in the existing `basis_summary`; legacy snapshots are not backfilled or presumed comparable.
- **Capital:** currently Posted ledger credits minus debits, including reversal debits. Payment rows are evidence for reconciliation, never added again to ledger totals. Unknown includes unmatched validated payments, account/ledger discrepancies, negative balances and incomplete sources. Eligible True Members form the completion denominator; an unknown eligible ledger makes the rate N/A. Ordinary Associates are excluded. Associates with a confirmed converted True Member application are shown separately for their documented obligations.
- **Capital stages:** zero; positive below configured target; at/above target but below maximum; at maximum; above maximum as an exception. Unknown ledger is a separate coverage category. Defaults remain the existing ₱3,000 target and ₱15,000 maximum, overridden by approved membership settings. Gross credits, payment-source contributions, interest/dividend credits, other credits and deductions are distinguished.
- **Deadlines/completion:** only recorded deadlines. A 30-day look-ahead is a descriptive window, never a synthesized or extended deadline. First completion uses actual dated ledger entries. Durations from approval exclude negative/inapplicable intervals. Historical balances/completions are restated using currently posted entries and current targets, not an audit-time reconstruction of policy or reversals.
- **Attention:** distinct union of monitoring/inactive RFM and confirmed recorded overdue capital. Overlap counts once; unscored does not imply inactivity. Missing required sources make the headline unavailable. Unknown deadlines/balances do not silently become overdue.
- **Sectors/geography:** five existing primary sectors, one per member. Multi-select filters combine these assignments without duplication. All 42 geometry barangays remain available, including zero-count rows; unmatched locations stay explicit. Matrix representation is sector members / barangay members; Active RFM rate is Active / all sector members, including unscored. Yearly and reporting-period change modes identify their comparison dates. These are cooperative membership distributions, not census penetration or agricultural production.
- **Recruitment:** actual approvals, zero-filled calendar months, earliest month/window wins a tie. Strongest three-month periods are consecutive calendar months, not the three largest disconnected months. Multi-year custom periods support historical inspection.
- **Referrals:** creations in the reporting period by the filtered referrer population. Qualification by as-of additionally requires recorded Successful status, a qualification date, an approved linked member, and validated application payment references for the required purpose/amount. This follows the approval workflow's direct related payment references; current status/payment records are not a complete historical reversal audit. No rewards or monetary values are invented.
- **Journey:** one submission cohort throughout, with observed milestones, unresolved history, same-cohort approval conversion and processing durations. Optional/non-sequential stages are explained. Missing payment/review milestones are not inferred from an eventual approval. Terminal milestones do not get invented next-stage rates.
- **Insights:** deterministic recorded attention/unscored/deadline counts; recruitment ranking appears only with at least five approvals in the reporting period. Zero/unsupported signals are omitted. No statistical significance, causation or forecast is claimed.

## Schema / production observations

The main schema and subsequent participation/RFM, ledger/interest, referrals, primary-sector and patronage-transfer migrations were inspected. A read-only inspection of the configured online database confirmed all fourteen audited tables and the relevant columns. There is no normalized multiple-sector relationship.

The implemented report was also executed against that database in a read-only transaction: 220 dated approved members, 44 geographic rows (42 boundaries plus unmatched locations), and all five source categories available. All 220 lacked a comparable fingerprinted RFM pair. No database rows were changed.

**No migration or `ALTER TABLE` is required for this implementation on that inspected schema.** The main SQL file is not changed for a nonexistent schema delta. The fingerprint is an optional field inside existing TEXT/JSON-compatible `basis_summary`. No production recalculation, backfill, deployment, commit or push is part of this task.

## Design and verification

### Compact chart cards

Paired chart cards use natural content height instead of stretching to their tallest neighbour. Growth/capital plots use 200px and the other compact plots use 220px; the engagement donut uses 200px. Growth legend/actions and engagement metadata share compact footer rows. Capital and sector summary keys show short labels and counts for nonzero groups; all plot categories remain, and full labels/percentages remain in tooltips, accessible key labels and the existing detail drawers. Zero-member categories remain available in the full breakdown. Touch summary keys retain 44px targets.

### Icons and semantic colors

`AnalyticsSignal.tsx` and `analytics-signals.ts` provide presentation-only signals for KPI cards, RFM/capital charts and legends, insights, referrals and supporting tables. Section headings use matching Lucide icons. Green identifies approved/positive or complete records; yellow identifies monitoring/partial records; red identifies recorded overdue, inactive RFM, declining growth or above-maximum exceptions. Gray identifies missing results, unscored members and context. Labels and distinct icons accompany color, with the existing success/warning/danger token pairs used for readable badges.

No performance targets or new member scores are introduced. Completion is complete versus partial, growth uses its actual sign, and attention uses recorded overdue/inactive/monitoring evidence. Capital-band colors do not create obligations for ordinary Associates. Counts, API contracts, payment rules, official statuses and the custom combobox controls remain unchanged.

Uses the TrackCOOP palette, Arial-based incumbent typography, public-neutral/workspace surfaces, restrained panel depth and existing Button/DatePicker/PageHeader components. UI/UX Pro Max, design-taste app-screen guidance, selective Neumorphism depth and Impeccable's bounded review were applied through the main design skill. The installed shadcn skill did not require replacing the working Radix/CVA controls. A source review used the current [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

Calculation/access/repository tests are under `server/src/modules/member-analytics/`; the existing RFM scoring tests remain unchanged. Browser scenarios in `tests/e2e/member-analytics.spec.ts` cover responsive composition, Apply/URL/Back behavior, drawers/focus, matrix/map interactions, exports, error/empty states, directory integration, the existing Financial Dashboard and the fullscreen fallback. `barangay-map.spec.ts` continues geometry/alias/hover/keyboard/retry/zero-data checks with the new API fixture. Fixtures are confined to tests and never returned by production routes.

Final command results and browser evidence are recorded in [implementation.md](implementation.md).
