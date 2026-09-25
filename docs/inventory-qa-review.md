# Inventory QA Review

## Current assessment

The Inventory module has protected staff routes, transactional stock mutations, unit-aware quantity validation, image validation, audit logging for product mutations, and visible client retry feedback. It is not yet marked production-ready because the repository-wide typecheck and automated test runner cannot currently complete in this environment.

## Implemented controls

- Staff-only create, update, archive, stock, and history routes.
- Member-readable inventory and unauthenticated public product listing.
- Product name, category, unit, description, price, cost, reorder, status, and stock validation.
- Whole-number enforcement for discrete units and decimal support for measurement units.
- Transaction row locking before stock balance and movement insertion.
- Archived/nonexistent products blocked from stock mutation.
- Actual paid/completed POS quantities used for `sold` values.
- Image MIME, binary signature, and 700 KB size checks, aligned with the 1 MB API body limit.
- Existing product image preserved when no replacement image is supplied.
- Product update/archive audit records with actor and value changes.
- Client-side validation, API error state, and retry action.

## Remaining high-priority verification

- Run API integration tests against a real MySQL test database.
- Verify concurrent stock deductions from two sessions.
- Verify POS payment, refund, revoke, and inventory movement consistency.
- Verify unauthorized member/guest calls return 401/403 for staff mutations.
- Verify archived products cannot be edited or stocked through direct API calls.
- Verify image payload rejection at both the client and request-parser limits.
- Verify audit rows are committed or rolled back together with product mutations.

## Requirement clarifications

- Are duplicate active product names allowed?
- Should archive be blocked when pending orders reference the product?
- Which units besides kg, g, liter, and ml allow fractional quantities?
- Should the generated SKU be visible/editable in the product form?
- Should manual stock deduction be labelled `Sale`, `Adjustment`, or a separate operation?
- Should a product with zero stock automatically become unavailable, or remain manually controlled?

## Known environment blockers

- The installed `node_modules` does not contain the AWS SDK packages declared by `package.json`.
- The generated `.next/types/validator.ts` references route files that are absent from the current source tree.
- `tsx --test` currently fails before test execution with `uv_os_get_passwd ... ENOMEM`.
- Repository-wide ESLint currently reports pre-existing errors outside the Inventory module; targeted Inventory lint is clean.

## Release gate

Do not mark Inventory production-ready until the verification items above pass in a clean environment and the requirement clarifications are resolved.

## Running issue register

### INV-QA-001 — Automated verification cannot execute

- Category: QA environment / Integration testing
- Classification: BUG / HIGH
- Issue: The Inventory test runner fails before assertions because `tsx` hits `uv_os_get_passwd ... ENOMEM`; API typecheck is also blocked by incomplete AWS SDK package contents and there is no confirmed MySQL integration database.
- Reproduction: Run `npx tsx --test server/src/modules/inventory/inventory.validation.test.ts` or `npx tsc -p server/tsconfig.json --noEmit`.
- Expected: Tests and typecheck execute and report actual pass/fail results.
- Recommended fix: Reinstall dependencies in a clean environment, use a supported Node runtime, and run the API against an isolated MySQL test database.

### INV-QA-002 — Product identity rules are undefined

- Category: Business rule / Data quality
- Classification: NEEDS CLARIFICATION / MEDIUM
- Issue: The database permits duplicate active product names; the correct behavior is not defined.
- Risk: Staff may create indistinguishable products and POS/inventory reporting may become ambiguous.
- Expected: Either active names are unique, or the UI clearly distinguishes products using SKU/category and duplicates are explicitly allowed.
- Recommended fix: Confirm the rule before adding a unique constraint or duplicate-warning workflow.

### INV-QA-003 — Archive dependency behavior is undefined

- Category: Workflow / Data integrity
- Classification: NEEDS CLARIFICATION / HIGH
- Issue: The archive workflow does not yet have a confirmed rule for products referenced by pending orders or future reservations.
- Risk: A product can disappear from operational views while existing workflows still depend on it.
- Expected: Archive either blocks with a clear reason or preserves the item as inactive for existing transactions.
- Recommended fix: Confirm the business rule and add an integration test covering pending-order references.

## Priority test cases

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| INV-TC-001 | Submit blank, negative, decimal-discrete, NaN, and oversized product values | Server rejects with 400; no row or movement is created | High |
| INV-TC-002 | Member/guest calls create, edit, archive, or stock endpoints | 401/403; no database mutation | Critical |
| INV-TC-003 | Two staff users deduct the final stock concurrently | One succeeds; the other receives insufficient-stock conflict | Critical |
| INV-TC-004 | Add product and opening stock with a forced database failure | Entire transaction rolls back | High |
| INV-TC-005 | Upload invalid MIME, mismatched signature, oversized, and valid GIF images | Invalid files rejected; valid GIF is retrievable | High |
| INV-TC-006 | Archive product, then list inventory/public products and attempt stock mutation | Archived item hidden from active lists and mutation is rejected | High |
| INV-TC-007 | Paid, completed, pending, cancelled, and refunded POS sales | `sold` and `pending_qty` follow the confirmed business status rules | High |

## UI/UX review register

### INV-UX-001 — Product cards expose too many primary actions

- Classification: IMPROVEMENT / MEDIUM
- Current state: Each product card keeps Edit, + Stock, and - Take visible together.
- Risk: The card becomes visually dense and destructive stock deduction is nearly as prominent as routine actions.
- Recommendation: Keep Edit and one primary stock action visible; move History and destructive/secondary actions into a consistent More menu or an item detail panel. Preserve the existing status badge and low-stock alert.

### INV-UX-002 — Inventory results need a stronger empty/loading model

- Classification: IMPROVEMENT / MEDIUM
- Current state: Error and retry feedback exists, but the page should distinguish initial loading, filtered-empty results, and genuinely empty inventory.
- Recommendation: Use skeleton cards during the first fetch; show `No products match your filters` with Clear filters for filtered-empty; show `No inventory items yet` with Add Item for an empty catalog.

### INV-UX-003 — Status must remain understandable without color

- Classification: IMPROVEMENT / MEDIUM
- Current state: Low-stock emphasis uses a red border/ring and text.
- Recommendation: Keep the text label and add a consistent icon/accessible label for Available, Low Stock, and Unavailable across cards, modals, public products, and POS views.

### INV-UX-004 — Responsive card grid needs viewport verification

- Classification: NEEDS VERIFICATION / MEDIUM
- Current state: Desktop cards and pagination are implemented, but mobile/tablet behavior cannot be proven from source inspection alone.
- Test requirement: Verify card width, action wrapping, modal fit, keyboard focus, and pagination at 320px, 768px, 1024px, and desktop widths.
