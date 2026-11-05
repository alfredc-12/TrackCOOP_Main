# Annual equipment rental patronage refunds

Implemented policy:

- January 1–December 31; 3% of each eligible member's equipment rental total, rounded to cents per member.
- Approved, active True Members only. Rental use must start on or after the recorded `true_member_since` date. A missing date excludes the member until the office completes it.
- Rentals must be completed and fully paid, with a validated Rental payment covering the booking amount. Cancelled, unfinished, unpaid, reversed/refunded payments, facility rentals and all POS purchases are excluded.
- A rental belongs to the year in which both completion and validated payment have occurred (the later timestamp). The member screen explains this rule. The calendar-year close uses Philippine time.
- Current-year estimates are informational. The Chairman calculates and reviews allocations, then finalizes after December 31. Existing staff payout permissions remain unchanged; the Bookkeeper approves Share Capital transfers.
- Finalization checks the saved amounts against current rentals. Cash payout and capital transfer requests/approvals recheck eligibility and rental payments. Changed sources require office review. Cash and capital cannot consume the same refund twice.

## Existing records

The migration preserves every existing allocation, amount, payment and capital transfer. Existing periods are labeled `Legacy`, and additional payments or capital transfers from them are blocked pending review. Pending transfer requests can still be rejected.

The local database contained two paid legacy periods covering 2025 and part of 2026: 21 allocations totaling PHP 24,750. All 21 included POS patronage; 12 belong to members currently classified as Associates. Their original paid records remain unchanged. This is a historical-data finding, not an automatic adjustment or recovery of past payments.

An overlapping legacy period blocks a new annual period for the same year. The office must reconcile these historical records before creating new 2025 or 2026 annual refunds. No automatic reconciliation is provided because the old periods already contain payments. A draft without payment or transfer history can be recalculated only if it covers a full calendar year.

## Database setup

For another existing installation, run before using the updated API:

```powershell
npx tsx server/src/scripts/migrate-patronage-annual-policy.ts
```

The idempotent migration adds policy/rate fields and a generated annual-year unique index. It was applied to the configured local database. Fresh installs include these fields in the canonical SQL schema.

## Verification

- Web/API type checks and the existing lint baseline check.
- Patronage calculation, authorization and transactional tests, including concurrent reservations, rollback, repeat payout prevention, and changed rental sources.
- Opt-in MySQL source test using connection-local temporary tables:

```powershell
$env:PATRONAGE_LOCAL_SQL_TEST='1'
npx tsx --test server/src/modules/patronage/patronage-sources.mysql.test.ts
```

- Actual MySQL lifecycle verification with test records rolled back: fixed totals, annual create/recalculate/finalize, changed-source rejection, payment idempotency and unique-year constraints. Existing period counts, allocation counts and refund totals were unchanged afterward.
- Browser interaction checks with mocked API responses: annual selector/payload, staff actions, legacy notices, member/Associate explanations, capital-transfer confirmation and responsive widths. These UI checks do not represent real cash payments or capital postings.
