# RFM implementation verification

## Design reference and scope

Applied TrackCOOP design-system guidance, UI/UX Pro Max interaction guidance, the app-screen guidance from design-taste-frontend, Impeccable's bounded craft review, and the current [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). The selected app direction was `framed-sheet`, retaining TrackCOOP's existing palette, type, green portal navigation, and shell. The product-specific element is the coordinated R/F/C distribution and comparison matrix. No shadcn initialization, palette replacement, token-file copying, or new global design system was introduced.

Reusable task pattern references:

- `src/features/member-indicators/RfmControls.tsx`: string/label mapping around shared StyledSelect, labelled numeric filters, and accessible pagination.
- `src/features/member-indicators/RfmWorkspace.tsx`: one controlled Radix drawer, left for the comparison matrix and right for read-only detail; original opener focus restored on close. Existing Modal is reused for protected save confirmation.
- `src/features/member-indicators/RfmDetails.tsx`: keyboard tabs, lazy immutable evidence/history, text alternatives, no connected trend for incompatible historical configurations.
- `src/features/member-indicators/RfmWorkspace.module.css`: scoped semantic colors, tabular figures, reduced motion, full-height sheets, tablet/phone cards, safe-area padding, and print-only summary.

These are references for this specialized workspace, not a replacement application-wide composition rule.

## Automated and visual checks

- Web and API TypeScript checks pass.
- `npm run lint:ci` passes against the unchanged baseline. No baseline regeneration was used.
- `npm run build` passes for Next.js and API output.
- The full API regression suite passes: 352 tests, including the opt-in disposable MySQL integration test, with test-only loopback database environment values.
- Focused RFM tests cover configured boundary scoring, dates/leap years, invalid configurations, snapshots, distributions, median/coverage, formula-safe OOXML, preview/save consistency, immutable evidence, duplicates, changed previews, concurrency, rollback, role restrictions, complete export, and history comparison.
- A disposable MySQL 8.4 fixture on loopback port 3317 passed the actual repository SQL, eligibility, source exclusions and boundaries, migration idempotency, historical/current/run selection, full exports, legacy undated history, duplicate handling, and unchanged official statuses. It uses an isolated data directory under the ignored worktree scratch directory and a uniquely named fixture database. No production credentials/data are used. The fixture database is dropped by its test, and the temporary server is shut down after verification.
- Ten RFM Playwright workflows passed against the local HTTP fixture API, including desktop/tablet/phone screenshots at 1440/768/390, keyboard combobox operation and focus return, evidence, history/deltas, search/debounce/filter/URL state, matrix cell filtering, recalculation failure/success/confirmation, full XLSX content, print visibility, and error recovery.
- Two Member Directory browser workflows passed: the existing status/history flow and the new RFM profile deep link with preserved return filters. The existing test was updated to follow its already-implemented stepper, custom menu, close button and expandable history row; original behavior assertions were retained.
- Initial visual review found excess desktop filter wrapping and compressed tablet rows. The correction uses one desktop filter row and tablet cards, retains readable phone cards, and defaults to ten results. A single confirmation review checks these changes.
- Impeccable's mechanical detector returned no findings. Taste source lint reported zero failures; its two warnings are justified: the shadow belongs to a real drawer overlay, and em dashes represent unavailable values rather than ornamental prose.

Source inventory, mocked browser verification, and disposable MySQL integration are distinct checks. This does not claim live production/backend acceptance or independent verification of imported activity/payment completeness.

## Integration risks

The main checkout was dirty before isolation. Task changes overlap shared StyledSelect, the Chairman members client, the members repository, and the legacy member-indicator repository. In particular, preserve the main checkout's richer searchable StyledSelect API and Member Analytics configuration fingerprint integration when reconciling these changes. The new workspace metadata uses the same canonical fingerprint fields.

Worktree: `C:/Users/Alfred/OneDrive/Desktop/Projects/TrackCOOP_MemberIndicators_Worktree`; branch: `feature/chairman-member-indicators-workspace`. The sibling worktree keeps its files outside the main checkout so broad source checks do not scan another branch. Commands for this task were run from the isolated worktree.

The required metadata widening/index migration is prepared but not applied to production. Large evidence snapshots require that migration. Legacy missing evidence/configuration, primary-sector-only schema, uncertain source completeness/freshness, and approximate legacy run groups remain explicitly disclosed in the UI and reports.

A concurrent `feature/chairman-people-kpi-filters` worktree was present at final inspection. Its current changes overlap `server/src/modules/members/member.repository.ts` and `src/app/(portal)/chairman/members/MembersClient.tsx`. The RFM changes in those files are limited to latest-basis selection and a read-only profile deep link/return link; reconcile those additions with the other branch rather than replacing its file.
