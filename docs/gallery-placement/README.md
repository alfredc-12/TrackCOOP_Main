# Chairman Gallery and homepage placements

## Scope and isolation

Approved Gallery plan implemented in `feature/chairman-gallery-placement`, sibling `TrackCOOP_GalleryPlacement_Worktree`, from local main `d5d9575`. Original main, its staged/unstaged/untracked/ignored changes, environment files and other worktrees were not edited. No pull, push, merge, deployment, production write, storage deletion or shared-database migration is included.

The initial read-only check verified GitHub main at `6e8d741` (matching cached origin/main). Its homepage still used ProjectsSection and six Gallery-only placements. Local main had an unpublished seven-photo RecentPhotosSection fed by recent Gallery/Announcement posts. That actual mosaic geometry is retained: 600px desktop height, seven named areas, chronological DOM positions, and adaptive smaller collections. Only its data source, visible captions and image viewing change. Other unpublished homepage/portal refinements remain in original main.

Carried local gallery-specific foundations: `RecentPhotosSection.tsx`, `usePublishedLandingContent.ts`, `landing.recent-photos.ts`, its test, and the local landing repository/types/routes-test additions. Read-only backup copies are ignored under `.gallery-verification/original-local`; the carry list is recorded there. No broad copy of the local homepage, gallery page, shared controls, tokens, dependencies or environment was performed.

## What users can do

The existing Gallery create/upload/edit/cover/visibility/delete/preview workflow remains in LandingAdminViews. Its edited dropdowns use StyledSelect. The lower workspace is composed from GalleryWorkspace, PhotoGroupStack, gallery-draft and the typed gallery client. Specific Gallery group reads make editing possible beyond the first library page.

Seven numbered positions support individual photo dragging, click-to-place, touch selection and keyboard move buttons. Existing selections move/swap rather than duplicate. Randomize produces a local draft only; it favors different original groups before repeating groups, excludes repeated known assets and known failed images, and gracefully returns fewer than seven. Restore explicitly reloads the published snapshot. Save & Publish confirms and sends the complete seven-position arrangement with its revision. Unavailable references remain recognizable and removable. Unsaved changes have a beforeunload safeguard.

The paginated library combines Gallery groups with Public, non-archived announcement groups, including their ordered attached photos. Draft/hidden/ineligible photos are visibly disabled for placement. Restricted and archived announcements are excluded from this placement library. Source accents follow the approved mockup: green Gallery, amber Announcement, compact variable widths, no permanent group headings/captions, 300ms metadata hover, focus/touch metadata, individual lift/tilt, and a complete photo browser. Dates use upload/creation for Gallery, posted/creation for announcements and Manila day/calendar-week/calendar-month buckets; activity date is separate metadata, not an upload date.

## API and persistence

- GET `/api/landing/gallery-library`: validated search, source, sort, page and page size (maximum 24 groups); first seven previews per group, counts and eligibility.
- GET `/api/landing/gallery-library/:source/:id`: independently paginated photos (100/page).
- GET `/api/landing/gallery-placement`: revision and all seven positions, including unavailable indicators.
- POST `/api/landing/gallery-placement/proposal`: no database writes; optional bounded source-qualified exclusions for known failed images.
- PUT `/api/landing/gallery-placement`: exactly seven unique positions with null or `{source,photoId}` plus expectedRevision.
- GET `/api/landing/gallery/:id`: authenticated management detail using the existing Gallery repository/service.

All library/placement/management APIs require Chairman authorization. Unknown fields/URLs are rejected. The old single-slot PUT now returns 409 with a reload/Save & Publish instruction: an unversioned legacy editor cannot bypass concurrency protection. Existing gallery management API contracts and announcement image-list payloads remain intact.

The complete arrangement is saved inside one transaction: lock the singleton revision, compare expectedRevision, lock/recheck selected sources, validate duplicate identities/known stored assets, update all seven slots, advance revision, and write before/after audit references. Audit failure rolls everything back. Activity History knows the publication action and safely displays its bounded seven source references. Read snapshots use a transaction to avoid reading a partially changed arrangement. A stale draft receives 409 and stays available until the officer deliberately reloads/restores.

Announcement updates now synchronize unchanged paths into their existing rows, preserving image IDs during reordering. Removed attachments are removed according to the existing edit request, not silently duplicated into Gallery. This feature never deletes original storage objects. Announcement images retain their original parent relationship.

## Database prerequisite

**Prepare/review/apply separately:** `server/database/migrations/20261104_gallery_landing_placements.sql`. It was executed only on the guarded disposable test database. No production migration has been applied.

The additive migration extends existing gallery_landing_slots with source_type/announcement references and indexes, preserves legacy Gallery references, ensures positions 1–7 (seventh empty), and creates gallery_landing_state with revision 0. Legacy featured-only announcements receive their missing announcement_images row, only when no attached rows exist. No unrelated or random photo is chosen. Apply once after checking the current schema; MySQL DDL is not transactionally rolled back if a later statement fails. Do not rerun an already applied ALTER blindly.

`TrackCOOP_MAIN_Database.sql` is updated for fresh installs, including reset ordering and initialization. **Do not import this complete reset schema over an existing database** to apply the feature. Use the additive migration instead. Existing invalid/duplicate legacy placements are retained for officer review; they are not silently corrected during migration.

Until setup is present, the admin endpoint returns a clear 503 setup requirement; the additive public field is empty. This prevents the new placement lookup from breaking the existing public landing response because its tables/columns are not yet deployed.

## Public integration and media

GET `/api/public/landing` adds landingPhotos while preserving partners, gallery and recentPhotos. The homepage consumes only landingPhotos, keeps saved position order and does not substitute sample/latest/unrelated images. The separate `/gallery` composition and its existing data behavior are untouched.

Tiles contain images and meaningful alt text without visible title/caption scrims. LandingPhotoLightbox shows uncropped images, rounded corners, a subdued blurred backdrop, X/Escape/backdrop close, previous/next and arrow keys, focus containment and return. Missing/ineligible images are omitted in relative saved order and the grid reflows; empty results and fetch failures have distinct recovery states.

Media continues through resolveUploadUrl, preserving R2/existing absolute URLs, API /uploads paths and bundled images. next/image is unoptimized for these existing deployment/media conventions. Physical file availability is not inferred from database eligibility: onError excludes failed images and known failures are excluded from subsequent proposals. No arbitrary server-side URL probing, storage credential changes or new remote-image configuration is introduced.

## Design and verification boundary

Applied TrackCOOP references, Taste app-screen rules and pinned-component guidance, Impeccable Operate/craft-floor guidance, UI/UX Pro Max dragging-alternative guidance, selective soft depth from Neumorphism, and Web Interface Guidelines review. No new shadcn integration is needed. Existing palette, type, shell and approved stack/mosaic composition are pinned; no random visual-direction draw or new brand was used. The shared PageHeader remains in use; its redundant Gallery eyebrow is omitted after the browser measured insufficient contrast. The global portal shell/heading contract is unchanged.

Production-browser verification uses a test AuthService supplying synthetic claims and real new Express/repository code against an identity-guarded local SQL fixture, not live production authentication or data. Ports: web 3147, API 5368, SQL 33328. The SQL seed asserts exact data directory `.gallery-verification/sql` inside the active checkout and database `trackcoop_gallery_fixture` before any destructive fixture setup. Test email/payment delivery is disabled. Images and photo counts in snapshots are explicitly synthetic fixture content rendered from bundled cooperative assets.

The before captures are the committed original Chairman manager, temporarily rendered and restored in this task worktree. Public mosaic preservation is checked against the carried local source and production after captures. Inspector/visual evidence and exact final checks are recorded in verification.md; do not interpret a mocked claim as a real-user session test.

## Deployment and rollback

1. Export existing placements and back up the schema/data. Rehearse the additive migration on a separate disposable/staging database with the same engine/version.
2. With separate authorization, apply the migration, then deploy backend and frontend together. An older editor must reload; tokenless single-slot writes are deliberately rejected.
3. Verify the seven saved positions and their eligible sources in the public response. Publishing a different arrangement still requires the officer's explicit Save & Publish.
4. Retain additive schema during application rollback. Before reverting to a pre-feature release that cannot resolve announcements, restore the backed-up Gallery-only selection with explicit authorization; otherwise that old release's fallback could show different photos. Do not drop source records or original media to roll back.

Potential integration overlaps: the local homepage invocation, RecentPhotosSection, landing hook/types/repository/tests, LandingAdminViews, communication repository image helper, audit presentation and canonical SQL. Merge by intent/hunk, preserving the original checkout's unpublished landing/gallery styling and later unrelated work. Keep the branch/worktree until the user's exact merge trigger is sent; do not merge/push automatically.
