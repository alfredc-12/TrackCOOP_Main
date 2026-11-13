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

- 27 focused backend tests passed, including six-query avoidance, unchanged home
  fields, the three-operation concurrency limit, unlinked accounts, member-scoped
  data, rental activity, profiles and Associate financial restrictions.
- 16 mocked Chromium tests passed: desktop/tablet/phone home and section loading,
  the 60-second refresh interval, overlapping events, stale periods, financial update
  invalidation, livelihood review/repair and the existing member rental workflow.
- Desktop, tablet and phone repair screenshots were visually checked; layout is retained.

These results establish request behavior and response compatibility, not a measured
production speedup. No live database queries or financial mutations were used for
this verification. No deployment or policy activation is implied.

## Optional profile metadata

Dashboard and self-profile reads normalize compatible legacy lists: activity-name
strings, absent/null/empty optional dates and identical repeated activities. Reads
never rewrite stored values. Valid activities remain visible if another entry is
invalid. Invalid or conflicting dates are omitted without guessing a crop cycle.
Malformed JSON, unrecognized fields and excessive entries require review; the
response marks `member.livelihoodsUnavailable=true` while keeping other records
available. Database failures still fail rather than inventing empty data.

The dashboard warning opens My Profile. Only the authenticated member's self-profile
response includes review issues and the original saved value, rendered as escaped
text. Members review and correct the list, then explicitly confirm replacement.
The backend rejects an attempted replacement of invalid saved data without
`confirmLivelihoodsRepair=true`. New writes retain strict validation. Saving other
profile fields without confirmation omits `livelihoods`, preserving the original
value. A preview beyond 12,000 characters is shortened and the UI disables repair
confirmation pending a complete record review. No automatic database repair or
migration is performed.

The frontend also includes the HTTP status and API error message in diagnostic
errors. Route tests use the real controller/service/repository with a synthetic
pool, covering compatibility, partial recovery, original-value preservation,
explicit repair confirmation, member-scoped writes and genuine database errors.
Mocked browser tests cover review, correction, contact-only saves, failed saves,
escaped previews and keyboard operation at desktop/tablet/phone widths. These
checks do not access real member records or prove a particular account is repaired.
