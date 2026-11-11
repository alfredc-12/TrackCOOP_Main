# Patronage demo history (2021–2024)

The optional fixture uses existing approved, active True Members and the five existing equipment assets. It generates completed rentals, matching validated **synthetic** manual cash records, approved rental income/operating expenses, and booking status history. It makes no gateway calls and sends no notifications. No actual cash is received or paid.

Participation is 54, 56, 58 and 60 members respectively, with a regular group and rotating participants. Farm sectors influence equipment choices, rentals follow agricultural seasons, equipment dates do not overlap, and charges reuse the application's estimator and member discount. The fixed seed makes the fixture reproducible.

```powershell
npx tsx server/src/scripts/seed-patronage-history.ts --dry-run
npx tsx server/src/scripts/seed-patronage-history.ts --apply
npx tsx server/src/scripts/seed-patronage-history.ts --verify
```

The default command is read-only. `--apply` checks for existing history and requires unused 2021–2024 rental schedules and refund periods. Rerunning with an unchanged fixture verifies it rather than inserting duplicates. The verification command tests the actual create, calculate and finalize repository methods inside a rolled-back transaction. Run verification before manually creating refund periods for these years.

Records are marked `PATRONAGE_HISTORY_DEMO_V1`; booking and financial record numbers start with `DEMO-PR-`. Do not treat this fixture as audited financial history or run it against actual cooperative accounts.

For participating members, `true_member_since` is backfilled to January 1 of their first participating year so the existing eligibility query accepts their synthetic rentals. A demo explanation is appended to member notes. Account/application dates, existing financial records, share capital balances, payments and ledger entries are preserved. Original member profiles and existing records are saved under `../database-backups/` **before** any writes; the exact backup location, original/changed eligibility values and generated IDs are recorded in `scratch/patronage-history/manifest.json`.

The generated `scratch/patronage-history/README.md` contains annual totals and suggested financial inputs for manual tests. Its reviewed basis is rental income less rental expenses, including any preexisting Rental financial entries. POS/general business activity is excluded from these suggested rental-only figures. Statutory deductions are an illustrative 30% of this surplus, not a determination of statutory requirements. With the configured 30% allocation and 3% member refund rate, the pool covers each member's own qualifying rentals × 3%, rounded to cents. The remainder stays unallocated.

No yearly refund periods, allocations, payouts or share capital credits remain after seeding. Create the periods in the Patronage page to try the workflow. If removing the fixture later, use the saved manifest and backup to identify only generated rows and restore eligibility fields after reviewing subsequent activity; do not restore a whole database over newer transactions.
