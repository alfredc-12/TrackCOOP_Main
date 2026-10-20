# TrackCOOP Annual Interest on Share Capital Computation Reference

Prepared for internal reference: October 20, 2026

This document describes the computation and account behavior currently
implemented in TrackCOOP for the annual Interest on Share Capital workflow.
The member-facing and staff-facing UI uses **Annual Interest on Share Capital**
instead of Dividend. Some internal API, database, and legacy type names still
use `Dividend*` identifiers for compatibility.

The cooperative's by-laws, approved accounting policy, and required Board or
General Assembly approvals control the final production rules. This document
is a system reference and does not replace CDA confirmation or professional
accounting advice.

## 1. Scope and governance

TrackCOOP treats an Annual Interest on Share Capital declaration as a complete
12-month fiscal-year calculation.

- The default coverage period is January 1 through December 31.
- A different 12-month fiscal year may be used when it is supported by the
  cooperative's approved by-laws or policy, such as July 1 through June 30.
- The server rejects partial periods and periods that are not exactly one full
  fiscal year.
- The distribution date is recorded separately from the coverage dates.
- The final reserve rate, allocation rate, and distribution decision must be
  supported by the cooperative's approved governance process.

## 2. Declaration inputs

The new-declaration form follows these rules:

| Input | Current behavior |
| --- | --- |
| Declaration name | Required. Use a clear annual Interest on Share Capital title. |
| Coverage start and end | Required. Must cover one complete 12-month fiscal year. |
| Distribution date | Required before the declaration can be created. |
| Net surplus | Automatically calculated from posted financial records for the selected dates. |
| Statutory reserves (%) | Editable from 0% to 100%. The UI suggests 10% as a starting point. |
| Interest on Share Capital allocation (%) | Editable from 0% to 70%. The UI suggests 70% as a starting point. |
| Notes | Optional policy or approval notes. |

The 10% and 70% values are editable suggestions, not automatic legal defaults.
The reserve rate must follow the cooperative's applicable rules and approved
policy. The 70% value is the current TrackCOOP product limit; it should not be
treated as a universal CDA-prescribed allocation rate.

## 3. Governing computation

Let `R` be the approved statutory-reserve rate and `X` be the approved share
capital allocation rate.

```text
Net Surplus
= Posted Income - Posted Expenses

Statutory Reserves
= Net Surplus x (R / 100)

Distributable Surplus
= Net Surplus - Statutory Reserves

Interest on Share Capital Pool
= Distributable Surplus x (X / 100)

Rate per Peso of Average Share Month
= Interest on Share Capital Pool / Total Average Share Month

Member Interest
= Member Average Share Month x Rate per Peso
```

The current validator limits `X` to 70%. This leaves at least 30% of the
distributable surplus for patronage refund and other approved allocations. The
remaining amount is not automatically a final patronage-refund amount; it
still depends on the cooperative's approved allocation and distribution policy.

Only members with a positive Average Share Month are qualified for an
allocation. If the total Average Share Month is zero, the system cannot
allocate an Interest on Share Capital pool.

All monetary results are rounded to centavos. A final centavo adjustment makes
the sum of member allocations exactly equal to the approved Interest on Share
Capital pool.

## 4. Financial basis for net surplus

TrackCOOP calculates the net surplus from financial records that are:

- posted and approved;
- active;
- dated within the declaration coverage period; and
- included in the applicable financial record type.

The current basis is:

- `Income` records are included, except records whose source module is
  `Share Capital`;
- `Expense` records are included as posted expenses;
- unposted records are excluded; and
- adjustments may be shown as audit context but are not added to the net
  surplus calculation unless the approved accounting policy treats them as
  income or expense records.

```text
Net Surplus = Posted Income - Posted Expenses
```

Example:

```text
Posted operating income       PHP 1,200,000.00
Less: posted expenses         PHP   700,000.00
                              ----------------
Net Surplus                   PHP   500,000.00
```

## 5. Annual coverage and Average Share Month

The calculation produces twelve monthly balances for each member. Ledger
transactions are applied in date order using the current TrackCOOP convention:

- credit transactions increase the share capital balance;
- debit transactions decrease the share capital balance;
- transactions dated on or before the 7th count in the current month;
- transactions dated after the 7th count beginning in the next month;
- transactions before the coverage period contribute to the opening balance
  when they are part of the member's ledger history; and
- monthly balances cannot go below zero.

The day-7 cutoff is a system convention and must match the cooperative's
approved by-laws or policy before production use.

```text
Average Share Month
= Sum of the twelve monthly balances / 12
```

### Member A

```text
January 5: credit PHP 10,000.00  -> effective January
June 10:   credit PHP  5,000.00  -> effective July
```

```text
January-June:   PHP 10,000.00 x 6 months = PHP  60,000.00
July-December:  PHP 15,000.00 x 6 months = PHP  90,000.00
                                             -----------
Total Share-Months:                         PHP 150,000.00
Average Share Month: PHP 150,000.00 / 12 = PHP 12,500.00
```

### Member B

```text
March 7: credit PHP 8,000.00 -> effective March
```

```text
January-February: PHP 0.00      x 2 months = PHP      0.00
March-December:   PHP 8,000.00  x 10 months = PHP 80,000.00
                                                  -----------
Total Share-Months:                          PHP 80,000.00
Average Share Month: PHP 80,000.00 / 12 = PHP 6,666.67
```

### Member C

```text
February 8: credit PHP 12,000.00 -> effective March
November 7: debit  PHP  2,000.00 -> effective November
```

```text
January-February:    PHP 0.00      x 2 months = PHP      0.00
March-October:       PHP 12,000.00 x 8 months = PHP 96,000.00
November-December:   PHP 10,000.00 x 2 months = PHP 20,000.00
                                                    -----------
Total Share-Months:                            PHP 116,000.00
Average Share Month: PHP 116,000.00 / 12 = PHP 9,666.67
```

```text
Member A: PHP 12,500.00
Member B: PHP  6,666.67
Member C: PHP  9,666.67
                           -----------
Total:    PHP 28,833.34
```

## 6. Worked annual example

Using the financial example above:

```text
Net Surplus                         PHP 500,000.00
Suggested reserve rate                       10%
Statutory Reserves                 PHP  50,000.00
Distributable Surplus              PHP 450,000.00
Suggested Interest allocation rate          70%
Interest on Share Capital Pool     PHP 315,000.00
Remaining distributable surplus     PHP 135,000.00
```

Using the three Average Share Month examples above:

```text
Rate per Peso
= PHP 315,000.00 / PHP 28,833.34
= PHP 10.9248530
```

| Member | Average Share Month | Computation | Interest |
| --- | ---: | --- | ---: |
| A | PHP 12,500.00 | 12,500.00 x 10.9248530 | PHP 136,560.66 |
| B | PHP 6,666.67 | 6,666.67 x 10.9248530 | PHP 72,832.39 |
| C | PHP 9,666.67 | 9,666.67 x 10.9248530 | PHP 105,606.95 |
| **Total** | **PHP 28,833.34** |  | **PHP 315,000.00** |

The actual member list and amounts come from the declaration's calculation at
publish time. This table is only a reproducible example of the calculation.

## 7. Effect on a member's Share Capital balance

The member account summary uses:

```text
Current Balance
= Initial Capital
  + Additional Contributions
  + Interest Added to Share Capital
  - Deductions
```

When a member chooses **Add to Share Capital**, the member confirms the action
and the approved Interest on Share Capital amount is posted immediately as a
Share Capital credit. No additional Bookkeeper approval is required for this
member action.

When a member chooses **Withdraw**:

- the member selects cash or online transfer;
- online transfer records the provider and account or mobile number;
- cash uses a cash payout reference or OR number;
- the payout receipt is optional; and
- the Bookkeeper records the completed payout.

A completed withdrawal does not add a Share Capital credit. It is recorded as
a payout transaction under the Share Capital source module, so it does not
silently become a future operating expense in the next Interest on Share
Capital basis. The member's Share Capital balance is therefore not increased
by the withdrawal.

After either action, the member card shows the current available amount. A
completed withdrawal or capital addition is shown in history with the
declaration name and the corresponding negative or positive amount.

## 8. Controls before publishing

Before publishing an annual declaration, verify:

1. Financial records are complete, posted, approved, active, and inside the
   correct coverage dates.
2. The coverage period is the cooperative's complete 12-month fiscal year.
3. The reserve rate and Interest on Share Capital allocation rate are formally
   approved.
4. The day-7 effective-month convention matches the cooperative policy.
5. The applicable reserve and patronage-refund requirements are satisfied.
6. The total member allocation equals the approved Interest on Share Capital
   pool.
7. The member ledger and account summary reconcile.
8. The declaration has the required Board or General Assembly approval before
   release.

Validated source payments are locked after posting. A correction must use the
reversal workflow, which preserves the original transaction and adds a posted
debit reversal with its own reference. This prevents an edit from silently
changing a member's Average Share Month history.

## 9. Official references

- [Republic Act No. 9520 - Philippine Cooperative Code of 2008, CDA](https://cda.gov.ph/issuances/republic-act-9520/)
- [CDA Allocation and Distribution of Net Surplus](https://cda.gov.ph/wp-content/uploads/2021/01/Allocation_-_-Distribution_-of_-Net_-Surplus.pdf)
- [CDA MC 2022-25 - Guidelines on the Allocation and Distribution of Net Surplus](https://cda.gov.ph/wp-content/uploads/2022/09/MC-2022-25-NPO..pdf)
- [IRR of Republic Act No. 9520, Lawphil](https://lawphil.net/statutes/repacts/ra2010/irr_ra9520_2010.html)

The official references should be checked together with the cooperative's
current by-laws, approved financial policy, and any later CDA issuance before
the declaration is finalized.
