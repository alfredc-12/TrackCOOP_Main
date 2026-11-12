# Annual equipment rental patronage refunds

New periods use `RentalConfiguredAnnual` and save both Settings percentages:

- **Patronage allocation (%)** defaults to 30% of reviewed rental net surplus after applicable statutory deductions. It funds the annual refund pool.
- **Member rental refund rate (%)** defaults to 3% of each eligible member's own qualifying rental total. It accepts positive percentages up to 100%, with two decimal places.
- `refund pool = (reviewed net surplus − statutory deductions) × allocation percentage`.
- `member refund = member qualifying rentals × saved member refund rate`, rounded independently to cents.
- Recalculation preserves the funding pool and both saved percentages. Later settings changes apply to new periods only.
- Finalization compares current rental sources with the saved allocations and rejects total refunds above the funding pool. An unused balance stays unallocated; it is not silently distributed or posted to another fund. All-zero refunds after rounding cannot be finalized.
- The Chairman records reviewed annual rental surplus and statutory deductions. Coverage remains January 1–December 31 in Philippine time, with finalization after year-end.
- Existing eligibility remains active, approved True Members with a recorded effective date, completed and fully paid equipment rentals, and validated payments. POS, facilities, cancelled/unpaid bookings, test payments, and reversed/refunded payments remain excluded.
- Member estimates require a saved annual period. Payouts and capital transfers recheck the member's qualifying rentals and saved rate. Historical proportional periods still check the full rental denominator. Existing payment/transfer permissions and double-payment protections remain in place.

The Settings card contains only these two fields, brief descriptions, and the existing review/save controls. It has no worked example, table, or long calculation guide.

The configured member-rate policy is the cooperative-specific policy requested for the project. It is separate from CDA MC 2019-09's proportional distribution formula. Statutory allocations, entitlement rules, by-laws, approval requirements and the relationship to Interest on Share Capital still require cooperative review; this implementation does not certify CDA compliance.

## Existing records

The migrations preserve every existing allocation, amount, payment and capital transfer. Older `Legacy` periods remain blocked for additional payouts or transfers pending review. Periods already saved as `Rental3PercentAnnual` or `RentalSurplusAnnual` retain their original fixed-rate or proportional calculation and existing payout/transfer checks; they are not relabeled or silently recomputed under the new formula. Pending transfer requests can still be rejected.

The local database contained two paid legacy periods covering 2025 and part of 2026: 21 allocations totaling PHP 24,750. All 21 included POS patronage; 12 belong to members currently classified as Associates. Their original paid records remain unchanged. This is a historical-data finding, not an automatic adjustment or recovery of past payments.

An overlapping legacy period blocks a new annual period for the same year. The office must reconcile these historical records before creating new 2025 or 2026 annual refunds. No automatic reconciliation is provided because the old periods already contain payments. Supported-policy drafts without payment or transfer history can be recalculated only if they cover a full calendar year. Unknown Legacy policies require manual review.

## Database setup

For another existing installation, run before using the updated API:

```powershell
npx tsx server/src/scripts/migrate-patronage-annual-policy.ts
npx tsx server/src/scripts/migrate-patronage-surplus-policy.ts
```

The idempotent migrations add policy/rate fields, reviewed financial-basis fields and a generated annual-year unique index covering all three supported annual policies. Refund-rate precision accommodates computed rates. They were applied to the configured database. Fresh installs include the fields in the canonical SQL schema. A pre-change backup was saved at `C:/CAPSTONE/database-backups/patronage-surplus-before-20261111.json`; verification found both existing periods and all 21 allocations unchanged.

## Verification

- Web/API type checks and the existing lint baseline check.
- Patronage calculation, authorization and transactional tests, including concurrent reservations, rollback, repeat payout prevention, and changed rental sources.
- Opt-in MySQL source test using connection-local temporary tables:

```powershell
$env:PATRONAGE_LOCAL_SQL_TEST='1'
npx tsx --test server/src/modules/patronage/patronage-sources.mysql.test.ts server/src/modules/patronage/patronage-surplus.mysql.test.ts
```

- Actual MySQL lifecycle verification with test records rolled back: the agreed PHP 30,000 pool example, annual create/recalculate/finalize, immutable saved allocation and member rates after settings changes, insufficient-funding rejection, changed-rental rejection before payout, preserved historical proportional calculations, payment idempotency and unique-year constraints. Existing period counts, allocation counts and refund totals were unchanged afterward.
- Browser interaction checks with mocked API responses cover the policy tab at desktop/tablet/phone widths, allocation validation/review/save, and the annual financial-basis form with its saved configured member rate. These UI checks do not represent real cash payments or capital postings.
