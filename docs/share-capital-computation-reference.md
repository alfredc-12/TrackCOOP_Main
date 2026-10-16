# TrackCOOP Share Capital Computation Reference

Prepared for internal reference: October 16, 2026

This reference describes the computation currently implemented in TrackCOOP for
Interest on Share Capital. It is CDA-aligned, but the cooperative's by-laws,
approved accounting policy, and required Board/General Assembly approvals must
control the final production rules.

## 1. Governing formula

The CDA-style formula is:

```text
Rate of Interest
= X × (Net Surplus - Statutory Reserves)
  ÷ Total Average Share Month
```

Where `X` is the approved percentage of the distributable surplus allocated to
Interest on Share Capital.

Official references:

- [CDA Revised Implementing Rules and Regulations](https://cda.gov.ph/wp-content/uploads/2021/01/Revised_IRR_updated.pdf)
- [CDA Allocation and Distribution of Net Surplus](https://cda.gov.ph/wp-content/uploads/2021/01/Allocation_-_-Distribution_-of_-Net_-Surplus.pdf)
- [CDA MC 2019-09 Patronage Refund Guidelines](https://cda.gov.ph/wp-content/uploads/2021/01/MC-2019-09-Patronage-Refund.pdf)

TrackCOOP implements the same calculation in pool form:

```text
Distributable Surplus
= Net Surplus - Statutory Reserves

Interest on Share Capital Pool
= Distributable Surplus × Interest Allocation Rate

Rate per Peso of Average Share Month
= Interest on Share Capital Pool
  ÷ Total Average Share Month

Member Interest
= Member Average Share Month × Rate per Peso
```

The current validator limits the Interest on Share Capital allocation rate to
70%, leaving at least 30% of the distributable surplus available for patronage
refund and other approved allocations. The separate CDA rule on the relationship
between the patronage-refund rate and the Interest on Share Capital rate must
also be checked before final approval.

## 2. Computation sequence

### Step 1 — Determine the coverage period

Example:

```text
Coverage start: January 1, 2026
Coverage end:   December 31, 2026
Number of months: 12
```

### Step 2 — Compute net surplus

TrackCOOP uses active, approved financial records within the coverage period.
Share Capital is excluded from operating income.

```text
Posted operating income                 PHP 1,200,000.00
Less: posted operating expenses         PHP   700,000.00
                                             ----------------
Net Surplus                              PHP   500,000.00
```

Formula:

```text
Net Surplus = Posted Income - Posted Expenses
```

### Step 3 — Compute statutory reserves

For this example, assume the approved statutory-reserve rate is 20%:

```text
Statutory Reserves
= PHP 500,000.00 × 20%
= PHP 100,000.00
```

### Step 4 — Compute distributable surplus

```text
Distributable Surplus
= PHP 500,000.00 - PHP 100,000.00
= PHP 400,000.00
```

### Step 5 — Compute the Interest on Share Capital pool

Assume the approved Interest on Share Capital allocation rate is 50%:

```text
Interest Pool
= PHP 400,000.00 × 50%
= PHP 200,000.00
```

The remaining 50% of the distributable surplus is PHP 200,000.00. This is not
automatically a final patronage-refund amount; it remains subject to the
cooperative's approved allocation and distribution policy.

## 3. Average Share-Month computation

The current TrackCOOP implementation applies this project convention when
turning ledger transactions into monthly balances:

- Credit transactions increase the balance.
- Debit transactions decrease the balance.
- Transactions dated on or before the 7th count in the current month.
- Transactions dated after the 7th count beginning in the next month.

The day-7 cutoff is an implementation convention and must be confirmed against
the cooperative's by-laws or approved policy before production use.

### Member A

```text
January 5:  credit PHP 10,000.00  -> effective January
June 10:    credit PHP  5,000.00  -> effective July
```

Monthly balances:

```text
January–June:   PHP 10,000.00 × 6 months = PHP  60,000.00
July–December:  PHP 15,000.00 × 6 months = PHP  90,000.00
                                                -----------
Total Share-Months:                         PHP 150,000.00
Average Share-Month: PHP 150,000.00 ÷ 12 = PHP 12,500.00
```

### Member B

```text
March 7: credit PHP 8,000.00 -> effective March
```

```text
January–February: PHP 0.00     × 2 months = PHP      0.00
March–December:   PHP 8,000.00  × 10 months = PHP 80,000.00
                                                 -----------
Total Share-Months:                         PHP 80,000.00
Average Share-Month: PHP 80,000.00 ÷ 12 = PHP 6,666.67
```

### Member C

```text
February 8: credit PHP 12,000.00 -> effective March
November 7: debit PHP 2,000.00   -> effective November
```

```text
January–February: PHP 0.00      × 2 months = PHP      0.00
March–October:    PHP 12,000.00 × 8 months = PHP 96,000.00
November–December: PHP 10,000.00 × 2 months = PHP 20,000.00
                                                  -----------
Total Share-Months:                          PHP 116,000.00
Average Share-Month: PHP 116,000.00 ÷ 12 = PHP 9,666.67
```

### Total Average Share-Month

```text
Member A: PHP 12,500.00
Member B: PHP  6,666.67
Member C: PHP  9,666.67
                           -----------
Total:    PHP 28,833.34
```

## 4. Allocate the pool to members

### Rate per peso

```text
Rate per Peso
= PHP 200,000.00 ÷ PHP 28,833.34
= PHP 6.9364146
```

### Member allocation

| Member | Average Share-Month | Computation | Interest |
| --- | ---: | --- | ---: |
| A | PHP 12,500.00 | 12,500.00 × 6.9364146 | PHP 86,705.18 |
| B | PHP 6,666.67 | 6,666.67 × 6.9364146 | PHP 46,242.79 |
| C | PHP 9,666.67 | 9,666.67 × 6.9364146 | PHP 67,052.03 |
| **Total** | **PHP 28,833.34** |  | **PHP 200,000.00** |

All member amounts are rounded to centavos. Any remaining rounding difference
is distributed by centavo adjustment so that the member total exactly equals the
approved Interest on Share Capital pool.

## 5. Effect on the member's Share Capital balance

The member account summary uses:

```text
Current Balance
= Initial Capital
  + Additional Contributions
  + Interest Added to Share Capital
  - Deductions
```

Example for Member A if the full interest is added to Share Capital:

```text
Initial Capital:              PHP 10,000.00
Additional Contributions:     PHP  5,000.00
Interest Added to Capital:    PHP 86,705.18
Less: Deductions:             PHP      0.00
                                                   -----------
New Current Balance:          PHP 101,705.18
```

If the member requests withdrawal instead, the withdrawal request does not add
credit to Share Capital. The Bookkeeper's completed payout is recorded as a
financial transaction under the Share Capital source module and the member's
Share Capital balance remains unchanged. That classification keeps a payout
from being counted as a future operating expense when the next ISC basis is
computed.

Validated source payments are locked after posting. A correction must use the
reversal workflow, which preserves the original transaction and adds a posted
debit reversal with its own reference. This prevents a staff edit from
silently changing the member's Average Share Month history.

## 6. Important controls before using the result

Before publishing a declaration, verify:

1. The financial records are complete, approved, active, and inside the correct dates.
2. The reserve rate and Interest on Share Capital allocation rate were formally approved.
3. The day-7 effective-month convention matches the cooperative policy.
4. The minimum patronage-refund allocation is satisfied.
5. The patronage-refund rate does not exceed twice the Interest on Share Capital rate.
6. The total member allocation equals the approved pool.
7. The ledger and account summary reconcile for every member.
8. The declaration is approved through the cooperative's required governance process before release.

This document is a system/computation reference, not a substitute for the
cooperative's by-laws, CDA confirmation, or professional accounting advice.
