# Implementation map

This lists the design-system work from 2026-11-02. The working tree already contained public-page, rental, gallery, calendar and other changes; those unrelated changes were preserved and are not claimed as part of this implementation.

## Runtime foundation

- `src/styles/design-tokens.css`: extracted palette, semantic colors, typography, radius, spacing, elevation, and motion tokens; Tailwind v4 aliases.
- `src/styles/design-system.css`: reusable panel/control/table treatment, selection/caret/focus, coarse-pointer targets and reduced-motion states.
- `src/styles/globals.css`: imports the foundation, aliases existing public/portal variables, retains the actual body font.

## Shared components

- `src/components/ui/Button.tsx`: existing variants/loading API on semantic tokens, consistent focus/soft depth.
- `src/components/ui/Input.tsx`: semantic colors, contrast, narrow-width behavior and focus/invalid states.
- `src/components/ui/StyledSelect.tsx`: existing string API backed by installed Radix selector, keyboard navigation and portalled popup.
- `src/components/ui/DatePicker.tsx`: exact-color token aliases only; existing calendar behavior preserved.
- `src/components/ui/Modal.tsx`: shared radius/border/elevation, constrained scrollable content with visible scrollbars.
- `src/components/ui/LoadingStates.tsx`: compact empty states, motion alternatives and tokenized surfaces.
- `src/components/ui/RetryButton.tsx`: normal recovery action and consistent target size.
- `src/components/portal/PageHeader.tsx`: compact operational heading and readable module context.
- `src/components/portal/PortalPrimitives.tsx`: KPI readability, panels, keyboard table scrolling, named pagination and dialog close control, clearer form error color.
- `src/components/portal/PortalShell.tsx`: tokenized surface and explicit mobile-navigation state passed to topbar.
- `src/components/portal/PortalSidebar.tsx`: existing green identity/accordion retained; accessible mobile dialog, focus return, breakpoint dismissal, readable group labels and current-route semantics.
- `src/components/portal/PortalTopbar.tsx`: single main-heading hierarchy, named account control, navigation state/relationship, readable role label.
- `src/components/portal/Breadcrumbs.tsx`: exact-color token aliases.
- `src/components/layout/SiteHeader.tsx`, `SiteFooter.tsx`: exact-color token aliases; destinations/composition unchanged.

## Existing consumers migrated/refined

- `src/features/pos/components/PublicStorefront.tsx`: exact-color token aliases in the existing compact storefront; handlers and calculations unchanged.
- `src/app/(LandingPage)/contact/page.tsx`, `contact/ContactForm.tsx`, `track/page.tsx`: token aliases; the previously implemented contact/tracking layouts and workflows retained.
- `src/app/(auth)/login/page.tsx`: content-driven height and natural scrolling; token aliases; single branded card, associated field/error labels and accessible loading name. The user's final layout choice restores the edge-to-edge desktop split with a compact form and anchored recent-account menu. Auth logic remains unchanged.
- `src/app/(auth)/login/LoginPage.module.css`: neutral photographic text scrim and reduced-motion-safe card entrance.
- `src/app/(auth)/force-change-password/page.tsx`: associated labels/autocomplete, token aliases; password rules unchanged.
- `src/app/(dashboard)/member_dashboard/page.tsx`: exact-color aliases across the existing member workspace; tabs/data/handlers unchanged.
- `src/features/finance/BookkeeperFinancialDashboardView.tsx`: DOM matches visual reading order, shared compact summary treatment, five-action desktop grid and full-width last tablet action; numeric calculations unchanged.

The bounded exact-color migration replaced 487 matching utility literals across 18 selected shared/feature files. It did not convert arbitrary chart-library color strings, opacity variants, or every one-off color in the application.

## Documentation, skill and checks

- `.agents/skills/trackcoop-design-system/SKILL.md`, `agents/openai.yaml`, and nine linked references: portable project skill and actual component/layout guidance.
- `docs/design-system/README.md`, `preview.html`, `audit.md`, `source-inventory.json`, `changed-files.md`, `verification.md`: human-readable entry, actual-token visual reference, source audit and verification boundaries.
- `AGENTS.md`, `design.md`: discovery pointers; existing guidance retained.
- `scripts/audit-ui.mjs`: reproducible source inventory without reading credentials/uploads/database data.
- `scripts/validate-design-system.mjs`: skill identity/reference checks and actual semantic text-color contrast assertions.
- `tests/e2e/design-system.spec.ts`: six focused browser tests covering selector keyboard behavior, short-screen auth, associated labels, mobile drawer/focus/breakpoint dismissal, financial order/long amounts, and a populated mobile table.
- `tests/e2e/login-layout.spec.ts`: five focused sign-in checks for responsive recent accounts/removal/persistence, password visibility, short-screen access, validation, pending/failure states, and desktop no-scroll/dropdown dismissal using mocked API responses.

No dependencies, backend code, migrations, runtime environment files, payment rules, permissions, or authentication logic were changed by this design-system task.

## Barangay choropleth follow-up

- `src/app/(portal)/chairman/dashboard/DashboardClient.tsx`: replaces the map/table split with a full-width map; retains overall recruitment insights in a disclosure below it. Existing dashboard data sourcing and calculations remain intact.
- `src/app/(portal)/chairman/dashboard/_components/DemographicsMap.tsx` and `DemographicsMap.module.css`: real GeoJSON polygons, sequential fills, hover/focus/tap details, barangay finder, fit-all control, numeric legend, and boundary loading/retry state. Removes numbered markers, circles, the sketch background and the external GIS boundary request.
- `src/app/(portal)/chairman/dashboard/_components/barangay-choropleth.ts` and `.test.ts`: conservative name matching, alias aggregation, all sector columns, disjoint legend ranges, distinct zero fill and explicit unmatched-location accounting; four meaningful unit tests.
- `src/app/api/maps/nasugbu/route.ts`: read-only, force-static geography asset derived directly from the user's `src/lib/Nasugbu.geojson`. It serves no member data. Existing Express APIs, database queries and deployment configuration were not modified.
- `tests/e2e/barangay-map.spec.ts`: five browser tests across desktop/tablet/phone, real pointer hover and keyboard/tap details, retries, zero data and failed basemap tiles.
- The supplied `src/lib/Nasugbu.geojson` is retained unchanged and must be included with the feature's repository files when committing/deploying.
