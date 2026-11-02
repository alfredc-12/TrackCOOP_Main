# People Management KPIs and filters

How the Chairman's User Accounts, Applications, Member Directory and Status History pages count and filter.
Code: `server/src/utils/people-filters.ts` (shared predicates), the `*.repository.ts` files of `users`, `members`
and `membership-applications`, and `src/features/people-management/` (cards, chips, URL state).

## Rules that apply to every view

- **One predicate set per view.** The list, its total and the KPI summary build their `WHERE` clauses from the same
  function (`userFilterConditions`, `applicationFilterConditions`, `memberFilterConditions`,
  `unifiedHistoryConditions`). The summary leaves out only the dimension its cards break down, so a selected card's
  number equals the table total.
- **Cards are never computed from the loaded page.** They come from `GET .../summary` with the active filters.
  `overallTotal` is the unfiltered population, used for "42 of 126 … match the selected filters".
- **Dates are Asia/Manila calendar days, inclusive.** `YYYY-MM-DD` bounds are converted to UTC instants
  (`manilaRangeBounds`) and compared with `>=` / `<`, assuming DATETIME columns hold UTC (the pool uses `timezone: "Z"`).
- **Barangay** is free text, so it is matched trimmed and case-insensitively; `Unspecified` finds blank values.
- **A summary from an API that predates these figures is rejected** (`requireSummaryFields`) instead of showing zeros.

## User Accounts

| Card | Definition |
| --- | --- |
| Total accounts | Accounts matching search, role, created-date, member-link and last-login filters under the hidden-account setting. Caption shows role counts. |
| Active accounts | `account_status = 'Active'`; percentage = Active ÷ Total. |
| Pending activation | `account_status = 'Pending'` (account activation, not application approval). |
| Restricted accounts | `Suspended` + `Inactive`, with the split shown. |

Member-account linkage (`linked ÷ member-role accounts`) is a note under the cards; staff accounts are never "unlinked".
Last login: `never` = no recorded login; `recent` = logged in within N days; `inactive` = has logged in before, but not
within N days (never-logged-in accounts are excluded, since a missing timestamp does not prove abandonment).

## Applications

For review = Submitted + Under Review. Payment stage = Payment Required + Payment Confirmed (each also selectable).
Approved = applications whose **current** status is Approved; with a submission-date range it means "submitted in the
range and approved today", not "approved during the range".
Requirements complete/incomplete is evaluated in SQL by `prePaymentRequirementsCompleteSql`, generated from the same
constants as `assertPrePaymentRequirementsComplete`: at least one pre-payment requirement, all Verified or Waived
(payment and orientation requirements excluded). It covers every application, not the loaded page.

## Member Directory

Percentages use **approved members** as the base, so Associate + True Member = Approved members. Officially Active is
the official membership status (not the RFM indicator). Supporting counts: pending approval, officially
inactive/suspended/terminated (approved members), approved members without a linked user account. A linked account
that is still Pending counts as linked. Sector filters the single primary sector column.

## Status History

Counts are history events, not people. Sources: `membership_application_status_history`, `member_status_history`, and
`audit_logs` (`user.status_changed`, `user.role_changed`) for user accounts linked to a member profile only. Member
events are classified as official-status, membership-type, or both. "No recorded actor" means no actor was stored.

## URL state

Users: `q, role, status, hidden, from, to, link, login, days, sort, dir`. Members page keeps one namespace per tab:
`a_*` applications, `d_*` directory, `h_*` history, plus `tab`.
