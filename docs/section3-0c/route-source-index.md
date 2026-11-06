# Route-source index

Source baseline `740def0e611d77734b45a13d2f2f675ff635e5cc`. This mechanical index records literal Express router declarations in relevant modules; it is not proof of reachability or a complete route inventory. Consult middleware, controllers, schemas and service authorization; dynamically dispatched routes and variable paths require manual review (notably rental). Paths are router-local and generally mounted under `/api`.

## budgets

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/budgets` | [`server/src/modules/budgets/budget.routes.ts:14`](../../server/src/modules/budgets/budget.routes.ts#L14) |
| GET | `/budgets/summary` | [`server/src/modules/budgets/budget.routes.ts:15`](../../server/src/modules/budgets/budget.routes.ts#L15) |
| GET | `/budgets/:id` | [`server/src/modules/budgets/budget.routes.ts:16`](../../server/src/modules/budgets/budget.routes.ts#L16) |
| POST | `/budgets` | [`server/src/modules/budgets/budget.routes.ts:17`](../../server/src/modules/budgets/budget.routes.ts#L17) |
| POST | `/budgets/:id/status` | [`server/src/modules/budgets/budget.routes.ts:18`](../../server/src/modules/budgets/budget.routes.ts#L18) |

## communication

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/documents` | [`server/src/modules/communication/communication.routes.ts:28`](../../server/src/modules/communication/communication.routes.ts#L28) |
| POST | `/documents` | [`server/src/modules/communication/communication.routes.ts:29`](../../server/src/modules/communication/communication.routes.ts#L29) |
| GET | `/documents/:id` | [`server/src/modules/communication/communication.routes.ts:30`](../../server/src/modules/communication/communication.routes.ts#L30) |
| PATCH | `/documents/:id` | [`server/src/modules/communication/communication.routes.ts:31`](../../server/src/modules/communication/communication.routes.ts#L31) |
| POST | `/documents/:id/access-log` | [`server/src/modules/communication/communication.routes.ts:32`](../../server/src/modules/communication/communication.routes.ts#L32) |
| GET | `/reports` | [`server/src/modules/communication/communication.routes.ts:34`](../../server/src/modules/communication/communication.routes.ts#L34) |
| POST | `/reports` | [`server/src/modules/communication/communication.routes.ts:35`](../../server/src/modules/communication/communication.routes.ts#L35) |
| POST | `/reports/:id/archive` | [`server/src/modules/communication/communication.routes.ts:36`](../../server/src/modules/communication/communication.routes.ts#L36) |
| GET | `/announcements` | [`server/src/modules/communication/communication.routes.ts:38`](../../server/src/modules/communication/communication.routes.ts#L38) |
| POST | `/announcements/upload-image` | [`server/src/modules/communication/communication.routes.ts:40`](../../server/src/modules/communication/communication.routes.ts#L40) |
| POST | `/announcements` | [`server/src/modules/communication/communication.routes.ts:72`](../../server/src/modules/communication/communication.routes.ts#L72) |
| PATCH | `/announcements/:id` | [`server/src/modules/communication/communication.routes.ts:73`](../../server/src/modules/communication/communication.routes.ts#L73) |
| POST | `/announcements/:id/publish` | [`server/src/modules/communication/communication.routes.ts:74`](../../server/src/modules/communication/communication.routes.ts#L74) |
| POST | `/announcements/:id/archive` | [`server/src/modules/communication/communication.routes.ts:75`](../../server/src/modules/communication/communication.routes.ts#L75) |
| POST | `/announcements/:id/acknowledge` | [`server/src/modules/communication/communication.routes.ts:76`](../../server/src/modules/communication/communication.routes.ts#L76) |
| GET | `/announcements/:id/acknowledgments` | [`server/src/modules/communication/communication.routes.ts:77`](../../server/src/modules/communication/communication.routes.ts#L77) |
| GET | `/requests` | [`server/src/modules/communication/communication.routes.ts:79`](../../server/src/modules/communication/communication.routes.ts#L79) |
| GET | `/requests/assignees` | [`server/src/modules/communication/communication.routes.ts:80`](../../server/src/modules/communication/communication.routes.ts#L80) |
| GET | `/requests/track/:code` | [`server/src/modules/communication/communication.routes.ts:81`](../../server/src/modules/communication/communication.routes.ts#L81) |
| POST | `/requests/track/:code/reply` | [`server/src/modules/communication/communication.routes.ts:82`](../../server/src/modules/communication/communication.routes.ts#L82) |
| POST | `/requests/public` | [`server/src/modules/communication/communication.routes.ts:83`](../../server/src/modules/communication/communication.routes.ts#L83) |
| POST | `/requests` | [`server/src/modules/communication/communication.routes.ts:84`](../../server/src/modules/communication/communication.routes.ts#L84) |
| GET | `/requests/:id` | [`server/src/modules/communication/communication.routes.ts:85`](../../server/src/modules/communication/communication.routes.ts#L85) |
| PATCH | `/requests/:id/status` | [`server/src/modules/communication/communication.routes.ts:86`](../../server/src/modules/communication/communication.routes.ts#L86) |
| POST | `/requests/:id/reply` | [`server/src/modules/communication/communication.routes.ts:87`](../../server/src/modules/communication/communication.routes.ts#L87) |
| GET | `/notifications` | [`server/src/modules/communication/communication.routes.ts:89`](../../server/src/modules/communication/communication.routes.ts#L89) |
| POST | `/notifications/read-all` | [`server/src/modules/communication/communication.routes.ts:90`](../../server/src/modules/communication/communication.routes.ts#L90) |
| PATCH | `/notifications/:id/read` | [`server/src/modules/communication/communication.routes.ts:91`](../../server/src/modules/communication/communication.routes.ts#L91) |

## finance

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/financial-categories` | [`server/src/modules/finance/finance.routes.ts:17`](../../server/src/modules/finance/finance.routes.ts#L17) |
| POST | `/financial-categories` | [`server/src/modules/finance/finance.routes.ts:18`](../../server/src/modules/finance/finance.routes.ts#L18) |
| PATCH | `/financial-categories/:id` | [`server/src/modules/finance/finance.routes.ts:19`](../../server/src/modules/finance/finance.routes.ts#L19) |
| GET | `/operating-expenses` | [`server/src/modules/finance/finance.routes.ts:21`](../../server/src/modules/finance/finance.routes.ts#L21) |
| POST | `/operating-expenses` | [`server/src/modules/finance/finance.routes.ts:22`](../../server/src/modules/finance/finance.routes.ts#L22) |
| GET | `/operating-expenses/report` | [`server/src/modules/finance/finance.routes.ts:23`](../../server/src/modules/finance/finance.routes.ts#L23) |
| GET | `/financial-records` | [`server/src/modules/finance/finance.routes.ts:25`](../../server/src/modules/finance/finance.routes.ts#L25) |
| POST | `/financial-records` | [`server/src/modules/finance/finance.routes.ts:26`](../../server/src/modules/finance/finance.routes.ts#L26) |
| GET | `/financial-records/summary` | [`server/src/modules/finance/finance.routes.ts:27`](../../server/src/modules/finance/finance.routes.ts#L27) |
| GET | `/financial-records/trends` | [`server/src/modules/finance/finance.routes.ts:28`](../../server/src/modules/finance/finance.routes.ts#L28) |
| GET | `/financial-records/:id` | [`server/src/modules/finance/finance.routes.ts:29`](../../server/src/modules/finance/finance.routes.ts#L29) |
| PATCH | `/financial-records/:id` | [`server/src/modules/finance/finance.routes.ts:30`](../../server/src/modules/finance/finance.routes.ts#L30) |
| POST | `/financial-records/:id/post` | [`server/src/modules/finance/finance.routes.ts:31`](../../server/src/modules/finance/finance.routes.ts#L31) |
| POST | `/financial-records/:id/void` | [`server/src/modules/finance/finance.routes.ts:32`](../../server/src/modules/finance/finance.routes.ts#L32) |

## inventory

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/inventory` | [`server/src/modules/inventory/inventory.routes.ts:17`](../../server/src/modules/inventory/inventory.routes.ts#L17) |
| GET | `/inventory/archived` | [`server/src/modules/inventory/inventory.routes.ts:18`](../../server/src/modules/inventory/inventory.routes.ts#L18) |
| POST | `/inventory` | [`server/src/modules/inventory/inventory.routes.ts:19`](../../server/src/modules/inventory/inventory.routes.ts#L19) |
| GET | `/inventory/history` | [`server/src/modules/inventory/inventory.routes.ts:20`](../../server/src/modules/inventory/inventory.routes.ts#L20) |
| PUT | `/inventory/:id` | [`server/src/modules/inventory/inventory.routes.ts:21`](../../server/src/modules/inventory/inventory.routes.ts#L21) |
| DELETE | `/inventory/:id` | [`server/src/modules/inventory/inventory.routes.ts:22`](../../server/src/modules/inventory/inventory.routes.ts#L22) |
| POST | `/inventory/:id/restore` | [`server/src/modules/inventory/inventory.routes.ts:23`](../../server/src/modules/inventory/inventory.routes.ts#L23) |
| POST | `/inventory/:id/stock` | [`server/src/modules/inventory/inventory.routes.ts:24`](../../server/src/modules/inventory/inventory.routes.ts#L24) |
| GET | `/public/store-products` | [`server/src/modules/inventory/inventory.routes.ts:25`](../../server/src/modules/inventory/inventory.routes.ts#L25) |

## membership

| Method | Local path | Declaration |
| --- | --- | --- |
| POST | `/public/membership/applications` | [`server/src/modules/membership/membership.routes.ts:42`](../../server/src/modules/membership/membership.routes.ts#L42) |
| POST | `/public/membership/application-status` | [`server/src/modules/membership/membership.routes.ts:47`](../../server/src/modules/membership/membership.routes.ts#L47) |
| POST | `/public/membership/applications/additional-information` | [`server/src/modules/membership/membership.routes.ts:48`](../../server/src/modules/membership/membership.routes.ts#L48) |
| POST | `/public/membership/payments` | [`server/src/modules/membership/membership.routes.ts:53`](../../server/src/modules/membership/membership.routes.ts#L53) |
| POST | `/public/membership/activate` | [`server/src/modules/membership/membership.routes.ts:58`](../../server/src/modules/membership/membership.routes.ts#L58) |
| POST | `/public/membership/activation/request-replacement` | [`server/src/modules/membership/membership.routes.ts:60`](../../server/src/modules/membership/membership.routes.ts#L60) |
| GET | `/membership/applications` | [`server/src/modules/membership/membership.routes.ts:66`](../../server/src/modules/membership/membership.routes.ts#L66) |
| GET | `/membership/applications/:id` | [`server/src/modules/membership/membership.routes.ts:67`](../../server/src/modules/membership/membership.routes.ts#L67) |
| GET | `/membership/applications/:id/documents/:documentId` | [`server/src/modules/membership/membership.routes.ts:72`](../../server/src/modules/membership/membership.routes.ts#L72) |
| POST | `/membership/applications/:id/review` | [`server/src/modules/membership/membership.routes.ts:77`](../../server/src/modules/membership/membership.routes.ts#L77) |
| POST | `/membership/applications/:id/account` | [`server/src/modules/membership/membership.routes.ts:82`](../../server/src/modules/membership/membership.routes.ts#L82) |
| GET | `/membership/payments` | [`server/src/modules/membership/membership.routes.ts:88`](../../server/src/modules/membership/membership.routes.ts#L88) |
| GET | `/membership/payments/:id/proof` | [`server/src/modules/membership/membership.routes.ts:89`](../../server/src/modules/membership/membership.routes.ts#L89) |
| POST | `/membership/payments/:id/validate` | [`server/src/modules/membership/membership.routes.ts:94`](../../server/src/modules/membership/membership.routes.ts#L94) |

## membership-applications

| Method | Local path | Declaration |
| --- | --- | --- |
| POST | `/membership-applications/public` | [`server/src/modules/membership-applications/membership-application.routes.ts:176`](../../server/src/modules/membership-applications/membership-application.routes.ts#L176) |
| GET | `/membership-applications/public/referrals/:referralCode/validate` | [`server/src/modules/membership-applications/membership-application.routes.ts:181`](../../server/src/modules/membership-applications/membership-application.routes.ts#L181) |
| GET | `/membership-applications/public/:applicationCode/status` | [`server/src/modules/membership-applications/membership-application.routes.ts:186`](../../server/src/modules/membership-applications/membership-application.routes.ts#L186) |
| POST | `/membership-applications/public/:applicationCode/activation-link` | [`server/src/modules/membership-applications/membership-application.routes.ts:191`](../../server/src/modules/membership-applications/membership-application.routes.ts#L191) |
| POST | `/membership-applications/public/:applicationCode/documents` | [`server/src/modules/membership-applications/membership-application.routes.ts:196`](../../server/src/modules/membership-applications/membership-application.routes.ts#L196) |
| GET | `/membership-applications/public/:applicationCode/documents/:documentId/view` | [`server/src/modules/membership-applications/membership-application.routes.ts:202`](../../server/src/modules/membership-applications/membership-application.routes.ts#L202) |
| GET | `/membership-applications/summary` | [`server/src/modules/membership-applications/membership-application.routes.ts:209`](../../server/src/modules/membership-applications/membership-application.routes.ts#L209) |
| GET | `/membership-applications/barangays` | [`server/src/modules/membership-applications/membership-application.routes.ts:210`](../../server/src/modules/membership-applications/membership-application.routes.ts#L210) |
| GET | `/membership-applications` | [`server/src/modules/membership-applications/membership-application.routes.ts:211`](../../server/src/modules/membership-applications/membership-application.routes.ts#L211) |
| POST | `/membership-applications` | [`server/src/modules/membership-applications/membership-application.routes.ts:212`](../../server/src/modules/membership-applications/membership-application.routes.ts#L212) |
| GET | `/membership-applications/:id` | [`server/src/modules/membership-applications/membership-application.routes.ts:213`](../../server/src/modules/membership-applications/membership-application.routes.ts#L213) |
| PATCH | `/membership-applications/:id` | [`server/src/modules/membership-applications/membership-application.routes.ts:214`](../../server/src/modules/membership-applications/membership-application.routes.ts#L214) |
| POST | `/membership-applications/:id/beneficiaries` | [`server/src/modules/membership-applications/membership-application.routes.ts:215`](../../server/src/modules/membership-applications/membership-application.routes.ts#L215) |
| PATCH | `/membership-application-beneficiaries/:id` | [`server/src/modules/membership-applications/membership-application.routes.ts:220`](../../server/src/modules/membership-applications/membership-application.routes.ts#L220) |
| DELETE | `/membership-application-beneficiaries/:id` | [`server/src/modules/membership-applications/membership-application.routes.ts:225`](../../server/src/modules/membership-applications/membership-application.routes.ts#L225) |
| POST | `/membership-applications/:id/documents` | [`server/src/modules/membership-applications/membership-application.routes.ts:230`](../../server/src/modules/membership-applications/membership-application.routes.ts#L230) |
| DELETE | `/membership-application-documents/:id` | [`server/src/modules/membership-applications/membership-application.routes.ts:236`](../../server/src/modules/membership-applications/membership-application.routes.ts#L236) |
| GET | `/membership-application-documents/:id/view` | [`server/src/modules/membership-applications/membership-application.routes.ts:241`](../../server/src/modules/membership-applications/membership-application.routes.ts#L241) |
| POST | `/membership-applications/:id/requirements` | [`server/src/modules/membership-applications/membership-application.routes.ts:247`](../../server/src/modules/membership-applications/membership-application.routes.ts#L247) |
| PATCH | `/membership-application-requirements/:id` | [`server/src/modules/membership-applications/membership-application.routes.ts:252`](../../server/src/modules/membership-applications/membership-application.routes.ts#L252) |
| DELETE | `/membership-application-requirements/:id` | [`server/src/modules/membership-applications/membership-application.routes.ts:257`](../../server/src/modules/membership-applications/membership-application.routes.ts#L257) |
| GET | `/membership-applications/:id/history` | [`server/src/modules/membership-applications/membership-application.routes.ts:262`](../../server/src/modules/membership-applications/membership-application.routes.ts#L262) |
| POST | `/membership-applications/:id/start-review` | [`server/src/modules/membership-applications/membership-application.routes.ts:263`](../../server/src/modules/membership-applications/membership-application.routes.ts#L263) |
| POST | `/membership-applications/:id/request-information` | [`server/src/modules/membership-applications/membership-application.routes.ts:268`](../../server/src/modules/membership-applications/membership-application.routes.ts#L268) |
| POST | `/membership-applications/:id/approve-for-payment` | [`server/src/modules/membership-applications/membership-application.routes.ts:273`](../../server/src/modules/membership-applications/membership-application.routes.ts#L273) |
| POST | `/membership-applications/:id/reject` | [`server/src/modules/membership-applications/membership-application.routes.ts:278`](../../server/src/modules/membership-applications/membership-application.routes.ts#L278) |
| POST | `/membership-applications/:id/withdraw` | [`server/src/modules/membership-applications/membership-application.routes.ts:279`](../../server/src/modules/membership-applications/membership-application.routes.ts#L279) |
| POST | `/membership-applications/:id/approve` | [`server/src/modules/membership-applications/membership-application.routes.ts:280`](../../server/src/modules/membership-applications/membership-application.routes.ts#L280) |
| POST | `/membership-applications/:id/reconcile-capital` | [`server/src/modules/membership-applications/membership-application.routes.ts:286`](../../server/src/modules/membership-applications/membership-application.routes.ts#L286) |
| GET | `/membership-applications/:id/print` | [`server/src/modules/membership-applications/membership-application.routes.ts:292`](../../server/src/modules/membership-applications/membership-application.routes.ts#L292) |

## membership-policy

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/members/me/membership-progress` | [`server/src/modules/membership-policy/membership-progress.routes.ts:62`](../../server/src/modules/membership-policy/membership-progress.routes.ts#L62) |
| PUT | `/members/me/membership-sectors` | [`server/src/modules/membership-policy/membership-progress.routes.ts:89`](../../server/src/modules/membership-policy/membership-progress.routes.ts#L89) |
| GET | `/members/me/referrals` | [`server/src/modules/membership-policy/membership-progress.routes.ts:122`](../../server/src/modules/membership-policy/membership-progress.routes.ts#L122) |
| GET | `/members/me/membership-payments` | [`server/src/modules/membership-policy/membership-progress.routes.ts:150`](../../server/src/modules/membership-policy/membership-progress.routes.ts#L150) |
| GET | `/membership-applications/:id/capital-progress` | [`server/src/modules/membership-policy/membership-progress.routes.ts:175`](../../server/src/modules/membership-policy/membership-progress.routes.ts#L175) |
| GET | `/chairman/membership-capital/monthly` | [`server/src/modules/membership-policy/membership-progress.routes.ts:196`](../../server/src/modules/membership-policy/membership-progress.routes.ts#L196) |

## patronage

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/members/me/patronage-capital` | [`server/src/modules/patronage/patronage-capital.routes.ts:34`](../../server/src/modules/patronage/patronage-capital.routes.ts#L34) |
| POST | `/members/me/patronage-capital` | [`server/src/modules/patronage/patronage-capital.routes.ts:37`](../../server/src/modules/patronage/patronage-capital.routes.ts#L37) |
| GET | `/patronage/capital-transfers` | [`server/src/modules/patronage/patronage-capital.routes.ts:42`](../../server/src/modules/patronage/patronage-capital.routes.ts#L42) |
| POST | `/patronage/capital-transfers/:id/decision` | [`server/src/modules/patronage/patronage-capital.routes.ts:45`](../../server/src/modules/patronage/patronage-capital.routes.ts#L45) |
| GET | `/patronage` | [`server/src/modules/patronage/patronage.routes.ts:21`](../../server/src/modules/patronage/patronage.routes.ts#L21) |
| GET | `/patronage/financial-basis` | [`server/src/modules/patronage/patronage.routes.ts:22`](../../server/src/modules/patronage/patronage.routes.ts#L22) |
| POST | `/patronage/periods` | [`server/src/modules/patronage/patronage.routes.ts:23`](../../server/src/modules/patronage/patronage.routes.ts#L23) |
| POST | `/patronage/periods/:id/recalculate` | [`server/src/modules/patronage/patronage.routes.ts:24`](../../server/src/modules/patronage/patronage.routes.ts#L24) |
| POST | `/patronage/periods/:id/finalize` | [`server/src/modules/patronage/patronage.routes.ts:25`](../../server/src/modules/patronage/patronage.routes.ts#L25) |
| POST | `/patronage/allocations/:id/paid` | [`server/src/modules/patronage/patronage.routes.ts:26`](../../server/src/modules/patronage/patronage.routes.ts#L26) |
| GET | `/members/me/patronage` | [`server/src/modules/patronage/patronage.routes.ts:27`](../../server/src/modules/patronage/patronage.routes.ts#L27) |

## payment-references

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/payment-references` | [`server/src/modules/payment-references/payment-reference.routes.ts:20`](../../server/src/modules/payment-references/payment-reference.routes.ts#L20) |
| GET | `/payment-references/summary` | [`server/src/modules/payment-references/payment-reference.routes.ts:21`](../../server/src/modules/payment-references/payment-reference.routes.ts#L21) |
| POST | `/payment-references` | [`server/src/modules/payment-references/payment-reference.routes.ts:22`](../../server/src/modules/payment-references/payment-reference.routes.ts#L22) |
| GET | `/payment-references/:id` | [`server/src/modules/payment-references/payment-reference.routes.ts:23`](../../server/src/modules/payment-references/payment-reference.routes.ts#L23) |
| GET | `/payment-references/:id/proof` | [`server/src/modules/payment-references/payment-reference.routes.ts:24`](../../server/src/modules/payment-references/payment-reference.routes.ts#L24) |
| GET | `/payment-references/:id/receipt` | [`server/src/modules/payment-references/payment-reference.routes.ts:25`](../../server/src/modules/payment-references/payment-reference.routes.ts#L25) |
| POST | `/payment-references/:id/receipt/retry` | [`server/src/modules/payment-references/payment-reference.routes.ts:26`](../../server/src/modules/payment-references/payment-reference.routes.ts#L26) |
| PATCH | `/payment-references/:id` | [`server/src/modules/payment-references/payment-reference.routes.ts:27`](../../server/src/modules/payment-references/payment-reference.routes.ts#L27) |
| POST | `/payment-references/:id/validate` | [`server/src/modules/payment-references/payment-reference.routes.ts:28`](../../server/src/modules/payment-references/payment-reference.routes.ts#L28) |
| POST | `/payment-references/:id/reject` | [`server/src/modules/payment-references/payment-reference.routes.ts:29`](../../server/src/modules/payment-references/payment-reference.routes.ts#L29) |
| POST | `/payment-references/:id/request-clarification` | [`server/src/modules/payment-references/payment-reference.routes.ts:30`](../../server/src/modules/payment-references/payment-reference.routes.ts#L30) |
| POST | `/payment-references/:id/return-to-pending` | [`server/src/modules/payment-references/payment-reference.routes.ts:31`](../../server/src/modules/payment-references/payment-reference.routes.ts#L31) |
| POST | `/payment-references/:id/reverse` | [`server/src/modules/payment-references/payment-reference.routes.ts:32`](../../server/src/modules/payment-references/payment-reference.routes.ts#L32) |
| POST | `/payment-gateway-events/:eventId/retry` | [`server/src/modules/payment-references/payment-reference.routes.ts:33`](../../server/src/modules/payment-references/payment-reference.routes.ts#L33) |

## paymongo

| Method | Local path | Declaration |
| --- | --- | --- |
| POST | `/paymongo/checkouts/membership-applications/:applicationCode` | [`server/src/modules/paymongo/paymongo.routes.ts:96`](../../server/src/modules/paymongo/paymongo.routes.ts#L96) |
| GET | `/paymongo/public/payments/:paymentReferenceId/status` | [`server/src/modules/paymongo/paymongo.routes.ts:101`](../../server/src/modules/paymongo/paymongo.routes.ts#L101) |
| GET | `/paymongo/members/me/share-capital` | [`server/src/modules/paymongo/paymongo.routes.ts:107`](../../server/src/modules/paymongo/paymongo.routes.ts#L107) |
| POST | `/paymongo/checkouts/members/me/share-capital` | [`server/src/modules/paymongo/paymongo.routes.ts:112`](../../server/src/modules/paymongo/paymongo.routes.ts#L112) |
| POST | `/paymongo/checkouts/payment-references/:paymentReferenceId` | [`server/src/modules/paymongo/paymongo.routes.ts:119`](../../server/src/modules/paymongo/paymongo.routes.ts#L119) |
| GET | `/paymongo/payments/:paymentReferenceId/status` | [`server/src/modules/paymongo/paymongo.routes.ts:124`](../../server/src/modules/paymongo/paymongo.routes.ts#L124) |
| POST | `/` | [`server/src/modules/paymongo/paymongo.webhook.routes.ts:22`](../../server/src/modules/paymongo/paymongo.webhook.routes.ts#L22) |

## pos

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/pos/orders` | [`server/src/modules/pos/pos.routes.ts:20`](../../server/src/modules/pos/pos.routes.ts#L20) |
| GET | `/pos/history` | [`server/src/modules/pos/pos.routes.ts:21`](../../server/src/modules/pos/pos.routes.ts#L21) |
| POST | `/pos/checkout` | [`server/src/modules/pos/pos.routes.ts:22`](../../server/src/modules/pos/pos.routes.ts#L22) |
| PUT | `/pos/orders/:id/confirm` | [`server/src/modules/pos/pos.routes.ts:23`](../../server/src/modules/pos/pos.routes.ts#L23) |
| PUT | `/pos/orders/:id/complete` | [`server/src/modules/pos/pos.routes.ts:24`](../../server/src/modules/pos/pos.routes.ts#L24) |
| PUT | `/pos/orders/:id/reject` | [`server/src/modules/pos/pos.routes.ts:25`](../../server/src/modules/pos/pos.routes.ts#L25) |
| PUT | `/pos/orders/:id/revoke` | [`server/src/modules/pos/pos.routes.ts:26`](../../server/src/modules/pos/pos.routes.ts#L26) |

## records

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/documents/export` | [`server/src/modules/records/records.routes.ts:617`](../../server/src/modules/records/records.routes.ts#L617) |
| GET | `/documents/:id/file` | [`server/src/modules/records/records.routes.ts:618`](../../server/src/modules/records/records.routes.ts#L618) |
| GET | `/documents/:id` | [`server/src/modules/records/records.routes.ts:619`](../../server/src/modules/records/records.routes.ts#L619) |
| PATCH | `/documents/:id` | [`server/src/modules/records/records.routes.ts:620`](../../server/src/modules/records/records.routes.ts#L620) |
| GET | `/documents` | [`server/src/modules/records/records.routes.ts:621`](../../server/src/modules/records/records.routes.ts#L621) |
| POST | `/documents` | [`server/src/modules/records/records.routes.ts:622`](../../server/src/modules/records/records.routes.ts#L622) |
| GET | `/reports/history/export` | [`server/src/modules/records/records.routes.ts:624`](../../server/src/modules/records/records.routes.ts#L624) |
| GET | `/reports/history` | [`server/src/modules/records/records.routes.ts:625`](../../server/src/modules/records/records.routes.ts#L625) |
| POST | `/reports/generate/:reportType` | [`server/src/modules/records/records.routes.ts:626`](../../server/src/modules/records/records.routes.ts#L626) |
| GET | `/reports/generate/:reportType/export` | [`server/src/modules/records/records.routes.ts:627`](../../server/src/modules/records/records.routes.ts#L627) |
| POST | `/reports/:id/save` | [`server/src/modules/records/records.routes.ts:628`](../../server/src/modules/records/records.routes.ts#L628) |
| POST | `/reports/:id/activity` | [`server/src/modules/records/records.routes.ts:629`](../../server/src/modules/records/records.routes.ts#L629) |
| PATCH | `/reports/:id` | [`server/src/modules/records/records.routes.ts:630`](../../server/src/modules/records/records.routes.ts#L630) |
| GET | `/reports` | [`server/src/modules/records/records.routes.ts:631`](../../server/src/modules/records/records.routes.ts#L631) |
| GET | `/members/me/statement` | [`server/src/modules/records/records.routes.ts:633`](../../server/src/modules/records/records.routes.ts#L633) |

## rental

| Method | Local path | Declaration |
| --- | --- | --- |
| POST | `/rental/upload-image` | [`server/src/modules/rental/rental.routes.ts:809`](../../server/src/modules/rental/rental.routes.ts#L809) |

## share-capital

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/members/me/share-capital/overview` | [`server/src/modules/share-capital/share-capital.routes.ts:23`](../../server/src/modules/share-capital/share-capital.routes.ts#L23) |
| GET | `/members/me/share-capital/transactions` | [`server/src/modules/share-capital/share-capital.routes.ts:24`](../../server/src/modules/share-capital/share-capital.routes.ts#L24) |
| GET | `/members/me/share-capital/growth` | [`server/src/modules/share-capital/share-capital.routes.ts:25`](../../server/src/modules/share-capital/share-capital.routes.ts#L25) |
| GET | `/members/me/dividends` | [`server/src/modules/share-capital/share-capital.routes.ts:26`](../../server/src/modules/share-capital/share-capital.routes.ts#L26) |
| POST | `/members/me/dividends/:id/add-to-capital` | [`server/src/modules/share-capital/share-capital.routes.ts:27`](../../server/src/modules/share-capital/share-capital.routes.ts#L27) |
| POST | `/members/me/dividends/:id/request-withdrawal` | [`server/src/modules/share-capital/share-capital.routes.ts:28`](../../server/src/modules/share-capital/share-capital.routes.ts#L28) |
| GET | `/dividends/declarations` | [`server/src/modules/share-capital/share-capital.routes.ts:29`](../../server/src/modules/share-capital/share-capital.routes.ts#L29) |
| GET | `/dividends/financial-basis` | [`server/src/modules/share-capital/share-capital.routes.ts:30`](../../server/src/modules/share-capital/share-capital.routes.ts#L30) |
| POST | `/dividends/declarations/preview` | [`server/src/modules/share-capital/share-capital.routes.ts:31`](../../server/src/modules/share-capital/share-capital.routes.ts#L31) |
| GET | `/dividends/declarations/:id/members` | [`server/src/modules/share-capital/share-capital.routes.ts:32`](../../server/src/modules/share-capital/share-capital.routes.ts#L32) |
| POST | `/dividends/declarations` | [`server/src/modules/share-capital/share-capital.routes.ts:33`](../../server/src/modules/share-capital/share-capital.routes.ts#L33) |
| POST | `/dividends/declarations/:id/approve` | [`server/src/modules/share-capital/share-capital.routes.ts:34`](../../server/src/modules/share-capital/share-capital.routes.ts#L34) |
| POST | `/dividends/declarations/:id/reject` | [`server/src/modules/share-capital/share-capital.routes.ts:35`](../../server/src/modules/share-capital/share-capital.routes.ts#L35) |
| POST | `/dividends/declarations/:id/publish` | [`server/src/modules/share-capital/share-capital.routes.ts:36`](../../server/src/modules/share-capital/share-capital.routes.ts#L36) |
| GET | `/dividends/withdrawals` | [`server/src/modules/share-capital/share-capital.routes.ts:37`](../../server/src/modules/share-capital/share-capital.routes.ts#L37) |
| GET | `/dividends/withdrawals/history` | [`server/src/modules/share-capital/share-capital.routes.ts:38`](../../server/src/modules/share-capital/share-capital.routes.ts#L38) |
| POST | `/dividends/withdrawals/:id/complete` | [`server/src/modules/share-capital/share-capital.routes.ts:39`](../../server/src/modules/share-capital/share-capital.routes.ts#L39) |
| GET | `/share-capital` | [`server/src/modules/share-capital/share-capital.routes.ts:40`](../../server/src/modules/share-capital/share-capital.routes.ts#L40) |
| POST | `/share-capital` | [`server/src/modules/share-capital/share-capital.routes.ts:41`](../../server/src/modules/share-capital/share-capital.routes.ts#L41) |
| GET | `/share-capital/summary` | [`server/src/modules/share-capital/share-capital.routes.ts:42`](../../server/src/modules/share-capital/share-capital.routes.ts#L42) |
| GET | `/share-capital/accounts` | [`server/src/modules/share-capital/share-capital.routes.ts:43`](../../server/src/modules/share-capital/share-capital.routes.ts#L43) |
| GET | `/share-capital/transactions` | [`server/src/modules/share-capital/share-capital.routes.ts:44`](../../server/src/modules/share-capital/share-capital.routes.ts#L44) |
| GET | `/share-capital/member/:memberId` | [`server/src/modules/share-capital/share-capital.routes.ts:45`](../../server/src/modules/share-capital/share-capital.routes.ts#L45) |
| GET | `/share-capital/:id` | [`server/src/modules/share-capital/share-capital.routes.ts:46`](../../server/src/modules/share-capital/share-capital.routes.ts#L46) |
| PATCH | `/share-capital/:id` | [`server/src/modules/share-capital/share-capital.routes.ts:47`](../../server/src/modules/share-capital/share-capital.routes.ts#L47) |

## system-settings

| Method | Local path | Declaration |
| --- | --- | --- |
| GET | `/system-settings/catalog` | [`server/src/modules/system-settings/settings.routes.ts:45`](../../server/src/modules/system-settings/settings.routes.ts#L45) |
| GET | `/system-settings` | [`server/src/modules/system-settings/settings.routes.ts:50`](../../server/src/modules/system-settings/settings.routes.ts#L50) |
| PUT | `/system-settings/batch` | [`server/src/modules/system-settings/settings.routes.ts:95`](../../server/src/modules/system-settings/settings.routes.ts#L95) |
| PUT | `/system-settings` | [`server/src/modules/system-settings/settings.routes.ts:110`](../../server/src/modules/system-settings/settings.routes.ts#L110) |
