# Member dashboard loading

The member home page requests `GET /api/members/me/dashboard` with
`includeFinancialSummary=false`. This omits the six detailed financial-history
reads for manual financial records, purchases, rentals, patronage, annual interest,
and contribution history. Home statistics, current capital, recent activity,
referral information and profile details remain in the response. Opening Financial
requests the existing full summary. Omitting the new parameter preserves the old
API behavior. True/Associate access checks still apply independently of the flag.

Independent dashboard reads use a request-local queue with at most three database
operations in flight. This reduces sequential round trips without launching every
read at once. No database schema change or shared member-data cache is introduced.

The page loads its user information separately from the dashboard refresh effect,
so the permission result does not trigger the initial home request a second time.
Dividend and patronage details load when Member & Share opens. Background refreshes
run every 60 seconds while visible, with focus/visibility refresh retained. Identical
in-flight requests are shared. Changed financial filters cancel older dashboard
requests and reject their late results. Explicit financial updates and manual benefit
refreshes request fresh data even if a previous background read is still pending.

Verification on synthetic fixtures:

- 18 focused backend tests passed, including six-query avoidance, unchanged home
  fields, the three-operation concurrency limit, unlinked accounts, member-scoped
  data, rental activity, profiles and Associate financial restrictions.
- Eight mocked Chromium tests passed: desktop/tablet/phone home and section loading,
  the 60-second refresh interval, overlapping events, stale periods, financial update
  invalidation, and the existing member rental workflow.
- Desktop and phone screenshots were visually checked; layout is retained.

These results establish request behavior and response compatibility, not a measured
production speedup. No live database queries or financial mutations were used for
this verification. No deployment or policy activation is implied.

## Optional profile metadata

The dashboard profile read tolerates malformed saved livelihood JSON or entries
that fail livelihood validation. These previously caused the whole dashboard GET
to return 400 (or 500 for malformed JSON). The response now marks
`member.livelihoodsUnavailable=true` and omits the invalid optional details; the
page displays a warning while keeping the member's other records available.
Stored values are not rewritten. Profile writes retain strict validation, and
database failures continue to fail rather than returning invented empty data.
The frontend also includes the HTTP status and API error message in diagnostic
errors. Route-level regression tests use the real controller/service/repository
with a synthetic pool, covering invalid legacy entries, future dates, duplicate
activities, malformed JSON, valid data, strict writes and genuine database errors.
