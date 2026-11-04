# Gallery placement verification

## Implementation inventory

- `server/src/modules/gallery-placement/`: source-qualified DTOs, validation, combined library/group paging, proposal policy, transactional read/publish repository, Chairman routes, guarded SQL fixture and tests.
- `server/src/modules/communication/communication.repository.ts`: synchronize retained announcement attachments without replacing their image IDs; existing image-list payload remains unchanged.
- `server/src/modules/landing/landing.repository.ts`, service/types/routes: additive public landingPhotos, injectable Gallery placement routes, management detail read and guarded legacy-writer retirement. Existing partners/gallery/recentPhotos behavior remains available.
- `server/src/modules/landing/landing.recent-photos.ts` and test plus routes-test additions: preserved unpublished local feed foundation; it is no longer the homepage selection rule.
- `server/src/modules/audit-logs/activity.presentation.ts`: readable publication label and safe bounded before/after placement references.
- `server/database/migrations/20261104_gallery_landing_placements.sql`: additive migration prepared and tested locally only.
- `server/database/TrackCOOP_MAIN_Database.sql`: matching fresh-install schema/reset/initialization.
- `src/features/gallery-placement/`: compact stacks/metadata, draft/move/date model, typed client, seven-slot manager, library/browser/filter controls, responsive scoped styling and draft tests.
- `src/features/landing-admin/LandingAdminViews.tsx`: integrate workspace and detail callbacks while retaining its existing group editor, uploads, cover, deletion and preview; edited dropdowns use StyledSelect. Remove only the redundant low-contrast Gallery eyebrow.
- `src/features/landing-public/RecentPhotosSection.tsx`, `LandingPhotoLightbox.tsx`, hook and homepage gallery invocation: preserved local mosaic fed by saved placements, image-only tiles/viewer and failure reflow. Legacy Gallery fallback component/data retired from that invocation.
- `tests/e2e/gallery-placement.spec.ts`: production-browser cases using synthetic auth claims, real Express/repository persistence and guarded local SQL.
- `.gitignore`: task verification artifacts only. No baseline, dependency/lockfile, environment, credential or deployment configuration changes.

## Design application and bounded review

Mode: Operate for the Chairman workspace; Experience for the public image viewer. The pinned mockup and existing TrackCOOP palette/type/mosaic are the visual authority. No random direction deal/redraw, generated stock imagery or replacement brand. Existing real cooperative images are used in explicitly synthetic test fixtures.

Skills actually used: TrackCOOP component/layout/token/interaction references; Taste app-screen and pinned-component guidance; Impeccable Operate/craft-floor plus one detector run; UI/UX Pro Max's specific WCAG dragging-alternative guidance; Neumorphism's selective depth/contrast guidance; and fresh Vercel Web Interface Guidelines. shadcn registry integration is not applicable and no components were installed.

The committed old Chairman manager was temporarily rendered for before screenshots and restored. Its image loading was awaited for capture. Original-local public mosaic preservation is verified from the carried source; public screenshots are production after captures, not a claim to an unchanged old homepage build. The normal portal shell in this isolated checkout reflects committed main, while original main's unrelated unpublished shell changes remain untouched.

First batched review covered desktop/tablet/phone stacks and the complete photo browser. Corrections addressed the amber legend selector, browser spacing/corners and selection affordance, header-label contrast, touch/focus behavior, and enlarged uncropped image sizing. Browser test corrections preserved authentication: public checks clear the synthetic Chairman cookie because real proxy behavior correctly redirects signed-in users. Native drag targets an exposed photo edge with source and destination visible; touch and keyboard alternatives are independently exercised.

Seven app-screen critique questions:

1. **Primary question:** the top seven-position board answers exactly which photos visitors will see; publication is the single committing action.
2. **Frame/density:** portal gutters are retained; source stacks are compact and variable-width, with a complete browser instead of oversized metadata cards. Placement grids are seven across desktop, four/three on tablet, and two-column/last-full-row on phones.
3. **Color/identity:** green and amber identify source, not a good/bad judgment; source text is available through legend and metadata. Disabled eligibility has a textual explanation.
4. **Arithmetic:** published/draft counts derive from seven actual positions; library counts/page totals come from server queries. No invented business metrics.
5. **Missing/zero states:** unavailable references remain removable; failed images reflow, empty public results show availability honestly, and requests offer retry. No unrelated fallback images fill holes.
6. **Legends/metadata:** source accents match the source legend; upload/publication/creation labels remain distinct from activity dates; delayed, focus and touch metadata do not become permanent headers.
7. **Phone:** source browsing, metadata and placement all work without dragging, and images/controls remain within the viewport. Gallery editor composition is retained rather than replaced.

## Test boundaries and reproduction

Disposable SQL is bound to 127.0.0.1:33328. The fixture asserts its exact data directory under this checkout's `.gallery-verification/sql` and database `trackcoop_gallery_fixture` before dropping any synthetic tables. No shared/production migration or mutation was performed. Real SQL tests cover migration preservation, cross-source identity, eligibility, proposal-only behavior, exact saved order, stale revisions, duplicate assets, audit rollback, retained attachment IDs, and removal without fallback.

Browser tests use web port 3147, API port 5368, and an injected test AuthService. They exercise actual new routes/repositories and real fixture storage/SQL, not a production user session. Upload tests store fixture copies of a bundled cooperative image only under `.gallery-verification/uploads`. Media shown in visual snapshots comes from bundled cooperative assets; fixture private/missing images deliberately exercise unavailable states.

Build with process-only NEXT_PUBLIC_API_URL=http://localhost:5368 and NEXT_PUBLIC_APP_URL=http://localhost:3147. For browser tests set GALLERY_LOCAL_SQL_TEST=1, EMAIL_DELIVERY=disabled, PAYMONGO_ENABLED=false, STORAGE_DRIVER=local, LOCAL_STORAGE_ROOT=.gallery-verification/uploads, DB_HOST=127.0.0.1, DB_PORT=33328, DB_NAME=trackcoop_gallery_fixture, DB_USER=root, DB_PASSWORD empty, DB_SSL=false, NODE_ENV=test, PLAYWRIGHT_PORT=3147, PLAYWRIGHT_API_PORT=5368, PLAYWRIGHT_BASE_URL=http://localhost:3147 and PLAYWRIGHT_WEB_COMMAND=npm run start:web -- --hostname 127.0.0.1 --port 3147. These are test-process overrides, not new application environment requirements or an environment-file change.

General API/payment checks explicitly use an unavailable loopback test database at port 9 and disabled email/gateway delivery so an existing receipt test cannot open the configured/shared database. The original implementation branch remains based on local main and is not rebased onto unrelated work.

Final result table and inspector outcome are appended after completion of all checks. Screenshots, raw inspector/detector reports, test logs and preserved local source copies remain ignored under .gallery-verification for review. Source backups use .source.txt suffixes so they do not masquerade as executable repository source in lint/typecheck.

## Final checks

| Command | Final result |
| --- | --- |
| `npm run typecheck` | Passed web/API. |
| `npm run lint:ci` | Passed: 63 existing errors / 85 warnings, baseline 121 / 106. No new debt; baseline unchanged. |
| `npm run security:scan` | Passed after staging all task files. |
| `git diff --cached --check` | Passed. |
| `npm run build` | Passed production web/API build; API compiled again after the final setup-message clarification. |
| `npm run test:api` | 515 passed, 0 failed, 7 skipped; 522 total. |
| `npm run test:paymongo-core` | 178 passed. |
| `npm run test:records` | Successful command; 0 tests discovered by the existing glob. |
| `GALLERY_LOCAL_SQL_TEST=1 npx tsx --test server/src/modules/gallery-placement/*.test.ts src/features/gallery-placement/gallery-draft.test.ts` | 17 passed, including real SQL subtests and role/validation tests. |
| `GALLERY_LOCAL_SQL_TEST=1 npx playwright test tests/e2e/gallery-placement.spec.ts` | 14 passed on the production build with real fixture API/SQL/storage. |
| Impeccable detector on new Gallery components and public photo components | Passed; empty findings array. |
| Taste `inspect.mjs --app` at 1440/768/390 | 0 FAIL, 2 WARN. Authenticated via a temporary dummy-cookie wrapper against the local fixture only. |

The two Taste warnings are explicitly scoped: the existing shared portal topbar and standard PageHeader both produce an h1, while the pinned source-colored borders are stronger than Taste's preferred neutral hairlines. The shared heading contract is outside this lower-library task; source-border emphasis is explicitly required by the approved mockup and backed by text/metadata. No global rule suppression or interface element was hidden from measurement.

All final inspector images and production browser captures were opened and reviewed. Full-section public screenshots may include the already-existing fixed site header at the capture viewport's scroll offset; no header positioning change is part of this task. Source images keep their original resolution; the lightbox fits their uncropped aspect ratio to the available screen. No found/generated assets, fonts or sample business claims were added.

During verification an old task preview process retained an earlier build manifest and caused missing-chunk errors. Only the verified task preview/fixture processes on 3147/5368 were stopped; rerunning with direct Node CLIs produced all 14 passing cases. For reliable reproduction, `PLAYWRIGHT_WEB_COMMAND=node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3147` avoids an extra npm child process. The original main's servers were not stopped.

The original local Gallery foundation files were compared byte-for-byte against their preserved copies and remained unchanged. Unique review artifacts stay ignored in this task worktree; no branch/worktree cleanup, merge, push, deployment or shared-database migration is performed in this implementation turn.
