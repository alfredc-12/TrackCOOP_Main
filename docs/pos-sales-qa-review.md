# POS Sales QA Review

## Implemented fixes

- Completed and paid orders are included consistently in validated sales totals.
- Cash and online totals include completed transactions.
- The weekly date filter excludes future-dated orders.
- Rejected orders are represented using the backend `Cancelled` status.
- Status filters now include Paid, Completed, and Cancelled.
- Reject and revoke reason inputs are limited to 500 characters.
- Discount values are server-validated as finite, non-negative, and not greater than the order subtotal.
- Order route IDs must be positive integers.
- Reject action has duplicate-submit protection and an action-specific loading state.
- Existing confirm and revoke loading states remain active during requests.

## Remaining verification

- Verify Paid versus Completed reporting rules with the business owner.
- Run concurrent confirmation and revoke tests against MySQL.
- Verify inventory movement rollback for revoke and cancellation workflows.
- Verify Chairman and Bookkeeper authorization and direct endpoint access.
- Test date filters across timezone boundaries and future-dated records.
- Test responsive action layout at mobile and tablet widths.

## Requirement clarifications

- Should a Completed order be counted in the same KPI totals as Paid?
- Should the UI use `Cancelled` everywhere, or display it as `Rejected` while retaining `Cancelled` in the database?
- Is the discount entered as a percentage or a fixed amount in all POS workflows?
- Should completed orders be revocable, or only Paid orders?
