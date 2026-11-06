# Literal SQL write-site index

Baseline `740def0e611d77734b45a13d2f2f675ff635e5cc`. This is a source-only search aid, not proof of a complete runtime call graph. Dynamic SQL, stored procedures, generated SQL, other tables, external writers and deployed versions require separate review. No query was executed.

## financial_records

- [`server/src/modules/finance/finance.repository.ts:490`](../../server/src/modules/finance/finance.repository.ts#L490) — `INSERT INTO financial_records`
- [`server/src/modules/finance/finance.repository.ts:533`](../../server/src/modules/finance/finance.repository.ts#L533) — `UPDATE financial_records`
- [`server/src/modules/finance/finance.repository.ts:581`](../../server/src/modules/finance/finance.repository.ts#L581) — `UPDATE financial_records`
- [`server/src/modules/finance/finance.repository.ts:604`](../../server/src/modules/finance/finance.repository.ts#L604) — `UPDATE financial_records`
- [`server/src/modules/finance/finance.repository.ts:639`](../../server/src/modules/finance/finance.repository.ts#L639) — `INSERT INTO financial_records`
- [`server/src/modules/membership/membership.repository.ts:1015`](../../server/src/modules/membership/membership.repository.ts#L1015) — `INSERT IGNORE INTO financial_records`
- [`server/src/modules/membership-applications/membership-application.capital.reconcile.ts:168`](../../server/src/modules/membership-applications/membership-application.capital.reconcile.ts#L168) — `UPDATE financial_records`
- [`server/src/modules/payment-references/payment-reference.repository.ts:708`](../../server/src/modules/payment-references/payment-reference.repository.ts#L708) — `INSERT IGNORE INTO financial_records`
- [`server/src/modules/payment-references/payment-reference.repository.ts:738`](../../server/src/modules/payment-references/payment-reference.repository.ts#L738) — `UPDATE financial_records`
- [`server/src/modules/payment-references/payment-reference.reversal.ts:60`](../../server/src/modules/payment-references/payment-reference.reversal.ts#L60) — `INSERT INTO financial_records`
- [`server/src/modules/payment-references/payment-reference.reversal.ts:78`](../../server/src/modules/payment-references/payment-reference.reversal.ts#L78) — `UPDATE financial_records`
- [`server/src/modules/paymongo/paymongo.settlement.finance.ts:54`](../../server/src/modules/paymongo/paymongo.settlement.finance.ts#L54) — `INSERT IGNORE INTO financial_records`
- [`server/src/modules/paymongo/paymongo.settlement.member-share-capital.ts:207`](../../server/src/modules/paymongo/paymongo.settlement.member-share-capital.ts#L207) — `INSERT IGNORE INTO financial_records`
- [`server/src/modules/paymongo/paymongo.settlement.pos.ts:257`](../../server/src/modules/paymongo/paymongo.settlement.pos.ts#L257) — `INSERT INTO financial_records`
- [`server/src/modules/paymongo/paymongo.settlement.rental.ts:160`](../../server/src/modules/paymongo/paymongo.settlement.rental.ts#L160) — `INSERT INTO financial_records`
- [`server/src/modules/pos/pos.repository.ts:499`](../../server/src/modules/pos/pos.repository.ts#L499) — `INSERT INTO financial_records`
- [`server/src/modules/pos/pos.repository.ts:636`](../../server/src/modules/pos/pos.repository.ts#L636) — `UPDATE financial_records`
- [`server/src/modules/rental/rental.repository.ts:1326`](../../server/src/modules/rental/rental.repository.ts#L1326) — `INSERT INTO financial_records`
- [`server/src/modules/rental/rental.repository.ts:3423`](../../server/src/modules/rental/rental.repository.ts#L3423) — `INSERT INTO financial_records`
- [`server/src/modules/rental/rental.repository.ts:3441`](../../server/src/modules/rental/rental.repository.ts#L3441) — `UPDATE financial_records`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:1472`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L1472) — `INSERT INTO financial_records`

## payment_references

- [`server/src/modules/membership/membership.repository.ts:829`](../../server/src/modules/membership/membership.repository.ts#L829) — `INSERT INTO payment_references`
- [`server/src/modules/membership/membership.repository.ts:981`](../../server/src/modules/membership/membership.repository.ts#L981) — `UPDATE payment_references`
- [`server/src/modules/membership/membership.repository.ts:1243`](../../server/src/modules/membership/membership.repository.ts#L1243) — `UPDATE payment_references`
- [`server/src/modules/membership-applications/membership-application.capital.reconcile.ts:158`](../../server/src/modules/membership-applications/membership-application.capital.reconcile.ts#L158) — `UPDATE payment_references`
- [`server/src/modules/payment-references/payment-reference.rental-sync.ts:15`](../../server/src/modules/payment-references/payment-reference.rental-sync.ts#L15) — `INSERT INTO payment_references`
- [`server/src/modules/payment-references/payment-reference.rental-sync.ts:51`](../../server/src/modules/payment-references/payment-reference.rental-sync.ts#L51) — `UPDATE payment_references`
- [`server/src/modules/payment-references/payment-reference.repository.ts:472`](../../server/src/modules/payment-references/payment-reference.repository.ts#L472) — `INSERT INTO payment_references`
- [`server/src/modules/payment-references/payment-reference.repository.ts:525`](../../server/src/modules/payment-references/payment-reference.repository.ts#L525) — `UPDATE payment_references`
- [`server/src/modules/payment-references/payment-reference.repository.ts:594`](../../server/src/modules/payment-references/payment-reference.repository.ts#L594) — `UPDATE payment_references`
- [`server/src/modules/payment-references/payment-reference.repository.ts:773`](../../server/src/modules/payment-references/payment-reference.repository.ts#L773) — `UPDATE payment_references`
- [`server/src/modules/payment-references/payment-reference.reversal.ts:135`](../../server/src/modules/payment-references/payment-reference.reversal.ts#L135) — `UPDATE payment_references`
- [`server/src/modules/payment-references/payment-reference.review.ts:60`](../../server/src/modules/payment-references/payment-reference.review.ts#L60) — `UPDATE payment_references`
- [`server/src/modules/paymongo/paymongo.checkout-attempt.repository.ts:339`](../../server/src/modules/paymongo/paymongo.checkout-attempt.repository.ts#L339) — `UPDATE payment_references`
- [`server/src/modules/paymongo/paymongo.checkout-attempt.repository.ts:444`](../../server/src/modules/paymongo/paymongo.checkout-attempt.repository.ts#L444) — `UPDATE payment_references`
- [`server/src/modules/paymongo/paymongo.member-share-capital.repository.ts:436`](../../server/src/modules/paymongo/paymongo.member-share-capital.repository.ts#L436) — `INSERT INTO payment_references`
- [`server/src/modules/paymongo/paymongo.member-share-capital.repository.ts:460`](../../server/src/modules/paymongo/paymongo.member-share-capital.repository.ts#L460) — `UPDATE payment_references`
- [`server/src/modules/paymongo/paymongo.membership-installment.queries.ts:296`](../../server/src/modules/paymongo/paymongo.membership-installment.queries.ts#L296) — `INSERT INTO payment_references`
- [`server/src/modules/paymongo/paymongo.repository.ts:334`](../../server/src/modules/paymongo/paymongo.repository.ts#L334) — `INSERT INTO payment_references`
- [`server/src/modules/paymongo/paymongo.repository.ts:414`](../../server/src/modules/paymongo/paymongo.repository.ts#L414) — `UPDATE payment_references`
- [`server/src/modules/paymongo/paymongo.settlement.membership.ts:327`](../../server/src/modules/paymongo/paymongo.settlement.membership.ts#L327) — `UPDATE payment_references`
- [`server/src/modules/paymongo/paymongo.settlement.pos.ts:247`](../../server/src/modules/paymongo/paymongo.settlement.pos.ts#L247) — `UPDATE payment_references`
- [`server/src/modules/paymongo/paymongo.settlement.rental.ts:150`](../../server/src/modules/paymongo/paymongo.settlement.rental.ts#L150) — `UPDATE payment_references`
- [`server/src/modules/paymongo/paymongo.settlement.ts:181`](../../server/src/modules/paymongo/paymongo.settlement.ts#L181) — `UPDATE payment_references`
- [`server/src/modules/paymongo/paymongo.webhook.service.ts:492`](../../server/src/modules/paymongo/paymongo.webhook.service.ts#L492) — `UPDATE payment_references`
- [`server/src/modules/pos/pos.repository.ts:338`](../../server/src/modules/pos/pos.repository.ts#L338) — `INSERT INTO payment_references`
- [`server/src/modules/pos/pos.repository.ts:465`](../../server/src/modules/pos/pos.repository.ts#L465) — `UPDATE payment_references`
- [`server/src/modules/pos/pos.repository.ts:475`](../../server/src/modules/pos/pos.repository.ts#L475) — `INSERT INTO payment_references`
- [`server/src/modules/pos/pos.repository.ts:567`](../../server/src/modules/pos/pos.repository.ts#L567) — `UPDATE payment_references`
- [`server/src/modules/pos/pos.repository.ts:619`](../../server/src/modules/pos/pos.repository.ts#L619) — `UPDATE payment_references`
- [`server/src/modules/pos/pos.repository.ts:625`](../../server/src/modules/pos/pos.repository.ts#L625) — `UPDATE payment_references`
- [`server/src/modules/rental/rental.repository.ts:2916`](../../server/src/modules/rental/rental.repository.ts#L2916) — `INSERT INTO payment_references`
- [`server/src/modules/rental/rental.repository.ts:2959`](../../server/src/modules/rental/rental.repository.ts#L2959) — `UPDATE payment_references`
- [`server/src/modules/rental/rental.repository.ts:3011`](../../server/src/modules/rental/rental.repository.ts#L3011) — `INSERT INTO payment_references`
- [`server/src/modules/rental/rental.repository.ts:3053`](../../server/src/modules/rental/rental.repository.ts#L3053) — `UPDATE payment_references`
- [`server/src/modules/rental/rental.repository.ts:3191`](../../server/src/modules/rental/rental.repository.ts#L3191) — `UPDATE payment_references`

## share_capital

- [`server/src/modules/membership/membership.repository.ts:1252`](../../server/src/modules/membership/membership.repository.ts#L1252) — `INSERT INTO share_capital_payments`
- [`server/src/modules/membership-applications/membership-application.capital.reconcile.ts:95`](../../server/src/modules/membership-applications/membership-application.capital.reconcile.ts#L95) — `INSERT INTO share_capital_payments`
- [`server/src/modules/patronage/patronage-capital.repository.ts:228`](../../server/src/modules/patronage/patronage-capital.repository.ts#L228) — `INSERT INTO share_capital_transactions`
- [`server/src/modules/patronage/patronage-capital.repository.ts:237`](../../server/src/modules/patronage/patronage-capital.repository.ts#L237) — `UPDATE share_capital_accounts`
- [`server/src/modules/payment-references/payment-reference.repository.ts:749`](../../server/src/modules/payment-references/payment-reference.repository.ts#L749) — `UPDATE share_capital_payments`
- [`server/src/modules/payment-references/payment-reference.reversal.ts:97`](../../server/src/modules/payment-references/payment-reference.reversal.ts#L97) — `UPDATE share_capital_payments`
- [`server/src/modules/paymongo/paymongo.settlement.member-share-capital.ts:166`](../../server/src/modules/paymongo/paymongo.settlement.member-share-capital.ts#L166) — `INSERT INTO share_capital_payments`
- [`server/src/modules/paymongo/paymongo.settlement.membership.ts:345`](../../server/src/modules/paymongo/paymongo.settlement.membership.ts#L345) — `INSERT INTO share_capital_payments`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:601`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L601) — `INSERT INTO share_capital_accounts`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:620`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L620) — `INSERT INTO share_capital_transactions`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:642`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L642) — `UPDATE share_capital_accounts`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:705`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L705) — `INSERT INTO share_capital_transactions`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:727`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L727) — `UPDATE share_capital_accounts`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:1049`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L1049) — `INSERT INTO share_capital_accounts`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:1069`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L1069) — `INSERT INTO share_capital_transactions`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:1089`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L1089) — `UPDATE share_capital_accounts`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:1510`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L1510) — `INSERT INTO share_capital_accounts`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:1531`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L1531) — `INSERT INTO share_capital_transactions`
- [`server/src/modules/share-capital/share-capital-ledger.repository.ts:1551`](../../server/src/modules/share-capital/share-capital-ledger.repository.ts#L1551) — `UPDATE share_capital_accounts`
- [`server/src/modules/share-capital/share-capital.repository.ts:205`](../../server/src/modules/share-capital/share-capital.repository.ts#L205) — `INSERT INTO share_capital_payments`
- [`server/src/modules/share-capital/share-capital.repository.ts:268`](../../server/src/modules/share-capital/share-capital.repository.ts#L268) — `UPDATE share_capital_payments`

## budget

- [`server/src/modules/budgets/budget.repository.ts:198`](../../server/src/modules/budgets/budget.repository.ts#L198) — `INSERT INTO budgets`
- [`server/src/modules/budgets/budget.repository.ts:206`](../../server/src/modules/budgets/budget.repository.ts#L206) — `INSERT INTO budget_lines`
- [`server/src/modules/budgets/budget.repository.ts:238`](../../server/src/modules/budgets/budget.repository.ts#L238) — `UPDATE budgets`

## documents

- [`server/src/records/central-document.ts:43`](../../server/src/records/central-document.ts#L43) — `INSERT INTO documents`
- [`server/src/scripts/migrate-records.ts:157`](../../server/src/scripts/migrate-records.ts#L157) — `UPDATE documents`
- [`server/src/scripts/migrate-records.ts:162`](../../server/src/scripts/migrate-records.ts#L162) — `UPDATE documents`
- [`server/src/modules/communication/communication.repository.ts:916`](../../server/src/modules/communication/communication.repository.ts#L916) — `INSERT INTO documents`
- [`server/src/modules/communication/communication.repository.ts:964`](../../server/src/modules/communication/communication.repository.ts#L964) — `UPDATE documents`
- [`server/src/modules/payment-references/payment-reference.reversal.ts:179`](../../server/src/modules/payment-references/payment-reference.reversal.ts#L179) — `UPDATE documents`
- [`server/src/modules/records/document-service.ts:559`](../../server/src/modules/records/document-service.ts#L559) — `INSERT INTO documents`
- [`server/src/modules/records/document-service.ts:582`](../../server/src/modules/records/document-service.ts#L582) — `UPDATE documents`
- [`server/src/modules/records/document-service.ts:674`](../../server/src/modules/records/document-service.ts#L674) — `UPDATE documents`
- [`server/src/modules/records/document-service.ts:767`](../../server/src/modules/records/document-service.ts#L767) — `UPDATE documents`
- [`server/src/modules/records/document-service.ts:768`](../../server/src/modules/records/document-service.ts#L768) — `UPDATE documents`
- [`server/src/modules/records/report-service.ts:2117`](../../server/src/modules/records/report-service.ts#L2117) — `INSERT INTO documents`
- [`server/src/modules/records/report-service.ts:2140`](../../server/src/modules/records/report-service.ts#L2140) — `UPDATE documents`
