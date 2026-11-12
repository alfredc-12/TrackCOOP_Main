# Executable request mapping

The repository search did not identify a Chapter III mapping. This mapping is derived from route definitions, not an approved mapping. All paths below are under `/api`, use GET, have no request body and use default query parameters. Authentication uses a unique per-user cookie; true-member status is required for J05. Synthetic fixtures provide the same chairman/bookkeeper/member ratio at each user level. CAL03 exercised all ten groups; formal results are reported separately.

| ID | Candidate feature and endpoint | Route access |
|---|---|---|
| J01 | Public landing: `/public/landing` | Public |
| J02 | Session identity: `/auth/me` | Authenticated |
| J03 | Personal dashboard: `/members/me/dashboard` | Member |
| J04 | Membership applications: `/membership-applications` | Staff |
| J05 | Share capital overview and transactions: `/members/me/share-capital/overview`, `/members/me/share-capital/transactions` | True Member |
| J06 | Financial records and summary: `/financial-records`, `/financial-records/summary` | Staff |
| J07 | Member and financial analytics: `/chairman/member-analytics`, `/chairman/financial-analytics` | Chairman |
| J08 | Rental schedules: `/rental/schedules` | Staff |
| J09 | Inventory and sales: `/inventory`, `/pos/orders` | Inventory: authenticated roles; orders: staff |
| J10 | Documents, announcements and activities: `/documents`, `/announcements`, `/activities` | Documents: authenticated; announcements: optional authentication; activities: staff |

The multi-request groups have separately labeled `TX_Jxx` workflow transaction samples and individual HTTP samples. Expected results are HTTP 200 and valid JSON with the expected success/data envelope; J08/J09 require arrays, J10 documents requires a documents list, and J03 requires a linked true-member dashboard. J02 checks the returned identity email against the user's assigned CSV identity. J05 checks that the overview belongs to the synthetic member and reconciles, then checks any returned transaction member IDs against that owner. The synthetic members have no seeded ledger activity, so the transaction ownership check is vacuous for an empty list and does not establish behaviour with populated member histories. Login uses the same per-user check, creates a session and audit entry, and is excluded from steady-state group metrics. The first dashboard read can initialize a missing referral code, so the synthetic profiles were initialized before formal baselines. Other selected requests are intended to be read-only; financial and membership snapshots verify targeted effects. The selection is safe for repetition only under the documented local test gate and synthetic configuration. Payment, payout, withdrawal, membership decision, booking and sales mutation operations are excluded; they are not represented as successfully load-tested.

JMeter reads the private CSV once per thread through a Groovy preprocessor, rather than the standard CSV Data Set element. The first 5, 10 and 20 rows preserve the same 1:1:3 role mix. This implementation difference is recorded so the plan can be independently reproduced.
