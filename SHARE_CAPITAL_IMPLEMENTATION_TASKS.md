# Share Capital and Dividend Implementation Tasks

Last updated: October 7, 2026

Current deployment status: implementation and automated validation are complete for the ledger, member dashboard, dividend decisions, Chairman declaration controls, and Bookkeeper withdrawal queue. The database migration has **not** been applied to the configured shared database yet; explicit approval and a backup are still required.

## Status legend

- `[x]` Done and currently available in the system
- `[~]` Partially available; still needs the listed work
- `[ ]` Not started or not yet verified as complete

## Current implementation snapshot

- `[x]` Existing Share Capital module and payment records
- `[x]` Existing member Share Capital page foundation
- `[x]` Existing Bookkeeper Share Capital page foundation
- `[x]` Existing Patronage Refund module
- `[x]` Existing finance and report-generation foundation
- `[x]` Share Capital records can show member, amount, payment method, reference, status, and payment date
- `[x]` Latest Share Capital records are ordered by insertion and silently refreshed
- `[~]` Current Share Capital total is displayed, but it is not yet backed by a complete credit/debit ledger with a running balance
- `[~]` Existing payment history contains some transaction information, but it does not yet provide the required full member statement
- `[~]` Existing Patronage Refund records have allocations and payment statuses, but the required dividend lifecycle is not yet implemented
- `[x]` Separate Share Capital Dividend accounting records
- `[x]` Member dividend decision workflow
- `[x]` Share Capital growth chart
- `[ ]` Complete Share Capital transaction reports and reconciliation

---

## Milestone 0 — Confirm accounting rules

- [ ] Confirm that Share Capital Dividend is separate from Patronage Refund
- [ ] Confirm who is allowed to declare dividends
- [ ] Confirm how dividend allocations are calculated
- [ ] Confirm whether members can withdraw immediately or require Bookkeeper approval
- [ ] Confirm allowed Share Capital deductions and adjustment reasons
- [ ] Confirm whether a minimum retained Share Capital balance is required

### Acceptance check

- [ ] Accounting rules are documented and approved before database implementation

---

## Milestone 1 — Database foundation

### Share Capital accounts

- [x] Create `share_capital_accounts` table
- [x] Add unique account per member
- [x] Add initial capital field
- [x] Add current balance field
- [x] Add total additional contributions field
- [x] Add total dividends added field
- [x] Add total deductions field
- [x] Add created and updated timestamps

### Share Capital transaction ledger

- [x] Create `share_capital_transactions` table
- [x] Add transaction date and insertion timestamp
- [x] Add transaction type
- [x] Add credit/debit direction
- [x] Add amount
- [x] Add balance before transaction
- [x] Add balance after transaction
- [x] Add reference number
- [x] Add source type and source ID
- [x] Add transaction status
- [x] Add remarks and creator
- [x] Add reversal transaction linkage
- [x] Add unique constraint to prevent duplicate source transactions
- [x] Add indexes for member, date, reference, source, and status

### Dividend records

- [x] Create `dividend_declarations` table
- [x] Create `member_dividends` table
- [x] Create `dividend_action_history` audit table
- [x] Add declaration and distribution dates
- [x] Add dividend amount per member
- [x] Add Pending status
- [x] Add Available status
- [x] Add Withdrawal Requested status
- [x] Add Withdrawn status
- [x] Add Added to Share Capital status
- [x] Add Cancelled and Reversed statuses

### Acceptance checks

- [ ] Database migration runs successfully on a clean database
- [ ] Database migration runs successfully on an existing database
- [ ] Monetary fields use exact decimal values
- [ ] Duplicate source transactions are rejected
- [ ] Posted ledger records cannot be directly deleted

---

## Milestone 2 — Existing data migration and reconciliation

- [x] Create idempotent Share Capital backfill script
- [x] Read all existing validated Share Capital payments
- [x] Group existing payments by member
- [x] Sort transactions by `created_at` and primary key
- [x] Identify initial Share Capital where source data is sufficient
- [ ] Mark uncertain initial-capital records for manual review
- [x] Create a ledger transaction for every validated payment
- [x] Calculate balance before and after every transaction
- [x] Populate Share Capital account summaries
- [x] Compare old totals with new ledger totals
- [x] Produce reconciliation mismatch report
- [ ] Resolve all unexplained balance mismatches

### Acceptance checks

- [ ] Running the backfill twice does not create duplicates
- [ ] Every validated old payment has exactly one ledger entry
- [ ] Every member's closing ledger balance matches their account balance
- [ ] No existing payment data is deleted

---

## Milestone 3 — Backend Share Capital service

- [x] Implement member capital summary service
- [x] Implement paginated transaction-history service
- [x] Implement validated-payment posting service
- [x] Implement central capital transaction creation service
- [x] Implement current-balance update inside a database transaction
- [x] Implement growth-series calculation
- [ ] Implement capital adjustment workflow
- [x] Implement reversal workflow
- [x] Implement member-account reconciliation service
- [x] Add server-side role and ownership checks
- [x] Add audit logging for sensitive actions

### Acceptance checks

- [ ] Frontend cannot directly submit a running balance
- [ ] Only validated payments affect Share Capital
- [ ] A payment cannot be posted twice
- [ ] A reversal preserves the original transaction
- [ ] Concurrent requests do not corrupt the member balance

---

## Milestone 4 — Share Capital APIs

### Member APIs

- [x] Get member Share Capital summary
- [x] Get member Share Capital transactions
- [x] Get member Share Capital growth data
- [x] Get member dividends
- [x] Add available dividend to Share Capital
- [x] Request available dividend withdrawal

### Bookkeeper APIs

- [x] Get Share Capital accounts (read-only reconciliation viewer)
- [x] Get all Share Capital transactions (read-only staff ledger viewer)
- [ ] Create authorized capital adjustment
- [ ] Reverse an incorrect transaction with a reason
- [x] Get dividend withdrawal requests
- [x] Complete dividend payout

### Chairman APIs

- [x] Create dividend declaration
- [~] Preview dividend allocations through calculated member count and total; per-member preview remains
- [x] Approve dividend declaration through a separate approval step before publication
- [x] Publish dividend declaration
- [x] View member decisions and distribution totals

### Acceptance checks

- [ ] Member can access only their own financial records
- [ ] Bookkeeper and Chairman actions follow role permissions
- [ ] Invalid status transitions return a clear error
- [ ] API responses use consistent success and error formats

---

## Milestone 5 — Member Share Capital dashboard

- [~] Existing member Share Capital page foundation
- [x] Show Initial Share Capital card
- [x] Show Additional Contributions card
- [x] Show Dividends Added card
- [x] Show Total Deductions card
- [x] Show Current Share Capital card
- [x] Add clear explanation of how current balance is calculated
- [x] Add responsive layout for mobile and desktop
- [x] Add initial-load skeleton
- [x] Add silent auto-refresh without visible loading

### Acceptance checks

- [ ] Summary totals match the transaction ledger
- [ ] Latest inserted transaction appears first
- [ ] Background refresh preserves current page and filters
- [ ] Background refresh does not close a modal or overwrite input

---

## Milestone 6 — Share Capital Transaction History

- [x] Add transaction-history table
- [x] Add Date column
- [x] Add Transaction Type column
- [x] Add Reference Number column
- [x] Add Amount Added column
- [x] Add Amount Deducted column
- [x] Add Updated Balance column
- [x] Add Status column
- [x] Add server-side pagination
- [x] Add date filter
- [x] Add credit/debit and posted/reversed filters
- [ ] Add transaction-type filter
- [ ] Add printable member statement
- [ ] Add PDF statement export
- [ ] Show opening and closing balances in statements

### Acceptance checks

- [ ] Every displayed running balance matches the ledger
- [ ] Credits and deductions are visually distinguishable
- [ ] Currency uses correct Philippine peso formatting
- [ ] No unnecessary `.000` is displayed for whole values

---

## Milestone 7 — Share Capital Growth Summary

- [x] Add total Share Capital summary
- [x] Add total additional contributions summary
- [x] Add total dividends added summary
- [x] Add total deductions summary
- [x] Add Share Capital growth line chart
- [x] Add all-time view
- [ ] Add yearly view
- [ ] Add monthly view
- [ ] Add quarterly view
- [ ] Carry the previous balance through months without transactions

### Acceptance checks

- [ ] Final chart value equals the current Share Capital balance
- [ ] Credits increase the graph
- [ ] Debits and reversals decrease the graph
- [ ] Chart remains readable on mobile

---

## Milestone 8 — Dividend member experience

- [x] Add My Dividends section to member portal
- [x] Show dividend declaration title and coverage period
- [x] Show date declared
- [x] Show distribution or availability date
- [x] Show dividend amount
- [x] Show current dividend status
- [x] Show processing date and reference
- [x] Add Withdraw Dividend button for available dividends
- [x] Add Add to Share Capital button for available dividends
- [x] Hide or disable actions after a final decision
- [x] Add silent auto-refresh

### Acceptance checks

- [ ] Members can clearly distinguish Pending, Available, Withdrawn, and Added to Share Capital
- [ ] Only available dividends allow a member decision
- [ ] A processed dividend cannot be processed again

---

## Milestone 9 — Add Dividend to Share Capital workflow

- [x] Add confirmation modal showing the exact amount
- [x] Lock the dividend record while processing
- [x] Lock the member Share Capital account while processing
- [x] Revalidate dividend ownership and availability
- [x] Create `DIVIDEND_CAPITALIZATION` ledger transaction
- [x] Update current Share Capital balance
- [x] Update total dividends added
- [x] Link dividend to its capital transaction
- [x] Change dividend status to Added to Share Capital
- [x] Save dividend action history
- [x] Show success message
- [x] Refresh summary, history, chart, and dividend list silently

### Acceptance checks

- [ ] All updates succeed or fail together
- [ ] Double-clicking creates only one transaction
- [ ] The ledger reference identifies the source dividend
- [ ] Updated balance immediately matches all related screens

---

## Milestone 10 — Withdraw Dividend workflow

- [x] Add withdrawal confirmation modal
- [x] Change available dividend to Withdrawal Requested
- [x] Add request to Bookkeeper withdrawal queue
- [~] Add payout reference and notes; payout-method field remains
- [x] Allow Bookkeeper to complete the payout
- [x] Create related finance expense/payment record
- [x] Change dividend status to Withdrawn
- [x] Save processing date and processor
- [x] Save dividend action history
- [x] Do not modify Share Capital balance

### Acceptance checks

- [ ] Withdrawal never creates a Share Capital credit
- [ ] Withdrawal appears in finance and dividend reports
- [ ] Only authorized Bookkeepers can complete payout
- [ ] Completed payout cannot be processed again

---

## Milestone 11 — Bookkeeper interface

- [~] Existing Bookkeeper Share Capital screen and navigation
- [ ] Add member capital-account summary table
- [ ] Add member transaction-history viewer
- [ ] Add capital adjustment form with required reason
- [ ] Add transaction reversal workflow
- [x] Add dividend withdrawal queue
- [x] Add payout review modal
- [x] Add payout completion confirmation
- [x] Sort latest inserted records first
- [x] Add invisible background refresh
- [x] Ensure only one modal can be open

### Acceptance checks

- [ ] Bookkeeper can trace every balance to its transactions
- [ ] Adjustment and reversal actions create audit entries
- [ ] Search, pagination, and filters survive silent refresh

---

## Milestone 12 — Chairman interface

- [x] Add dividend declaration form
- [x] Add calculation method and rate controls
- [~] Add eligible-member count and total preview; detailed member allocation preview remains
- [x] Show total declared amount before approval
- [~] Add publication confirmation; separate approval step remains
- [x] Add publication confirmation
- [x] Add declaration monitoring dashboard
- [x] Show withdrawn, capitalized, pending, and available totals
- [ ] Prevent silent editing of published declarations
- [ ] Add cancellation/reversal workflow for corrections

### Acceptance checks

- [ ] Published allocations match the approved total
- [ ] Declaration changes are fully audited
- [ ] Members see dividends only after publication

---

## Milestone 13 — Reports

- [~] Existing report-generation foundation
- [ ] Add Individual Share Capital Statement
- [ ] Add Share Capital Ledger Report
- [ ] Add Initial Capital Summary
- [ ] Add Additional Contributions Report
- [ ] Add Dividend Capitalization Report
- [ ] Add Dividend Withdrawal Report
- [ ] Add Dividend Distribution Summary
- [ ] Add Pending Dividend Decisions Report
- [ ] Add Share Capital Reconciliation Report
- [ ] Add date, member, type, and status filters
- [ ] Add print and export support

### Acceptance checks

- [ ] Report totals match the ledger and account summaries
- [ ] Reports include reference numbers and running balances
- [ ] Capitalized and withdrawn dividends are not double-counted

---

## Milestone 14 — Automated and manual testing

### Unit tests

- [ ] Credit balance calculation
- [ ] Debit balance calculation
- [ ] Reversal calculation
- [ ] Initial and additional contribution totals
- [ ] Dividend status transitions
- [ ] Growth chart data generation
- [ ] Duplicate source prevention

### Integration tests

- [ ] Validated payment creates one ledger entry
- [ ] Dividend capitalization is atomic
- [ ] Dividend withdrawal does not change capital
- [ ] Concurrent dividend decisions process only once
- [ ] Report totals reconcile with ledger totals
- [ ] Member, Bookkeeper, and Chairman permissions work

### UI tests

- [ ] Member views only their own account
- [ ] Latest transaction appears first
- [ ] Confirmation messages show correct amounts
- [ ] Only one modal opens at a time
- [ ] Submit buttons lock while processing
- [ ] Silent refresh has no loading flicker
- [ ] Mobile and desktop layouts are usable

---

## Milestone 15 — Deployment

- [ ] Back up production database
- [ ] Run database migrations before frontend deployment
- [ ] Run data backfill
- [ ] Review reconciliation report
- [ ] Resolve every unexplained mismatch
- [ ] Deploy backend services and APIs
- [ ] Deploy member, Bookkeeper, and Chairman interfaces
- [ ] Run production smoke tests
- [ ] Verify reports against sample member accounts
- [ ] Monitor errors and duplicate transaction attempts

### Final definition of done

- [ ] Every Share Capital movement is recorded in the ledger
- [ ] Every transaction has a correct running balance
- [ ] Members can understand how their capital grows over time
- [ ] Members can withdraw or capitalize an available dividend
- [ ] Dividend decisions cannot be processed twice
- [ ] UI, account summary, chart, and reports show matching totals
- [ ] All sensitive actions have an audit trail
- [ ] Existing data is successfully migrated and reconciled
- [ ] Automated tests and production smoke tests pass

