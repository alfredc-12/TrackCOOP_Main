# Staff sidebar interaction refinement

## Scope and existing authority

The Chairman screenshot identifies `src/components/portal/PortalSidebar.tsx`, shared by the Chairman and Bookkeeper portal shells. The existing forest rail, TrackCOOP mark, 288px desktop width, destinations, role visibility and pathname-specific accordion choices are preserved. No API, authentication, environment, payment, database or dashboard-content changes belong to this refinement.

Applied guidance: TrackCOOP design-system interaction/layout/token references; Impeccable's Operate/animate and craft-floor guidance; Taste's app-screen navigation, component-refinement and responsive guidance; UI/UX Pro Max's reduced-motion/interaction recommendations. This is a refinement of one established component, so Taste's component exception applies: no new direction draw, font, palette or page composition. The incumbent forest brand is retained rather than applying the generic app-screens preference for neutral sidebars. Impeccable context ran for this target and permitted a scoped existing-system refinement; missing PRODUCT.md does not block it.

## Motion thesis

- Focal interaction: a navigation group opens and closes continuously, retaining its spatial relationship with the neighboring groups.
- Continuity: mounted group panels transition CSS grid tracks over the existing 240ms normal motion token. Chevron rotation follows expansion. A short content translation and opacity change distinguish opening/closing from route loading.
- Feedback: 160ms hover/focus/press response; links shift label/icon by 2px on hover, and selected rows receive a sage fill and explicit marker. The brand mark responds only to hover. No loops or page-load choreography are introduced.
- Mobile: the existing Radix modal drawer enters from the left in 240ms and exits in 160ms. The overlay fades in/out, X feedback matches the drawer, and Radix presence retains closing content until its exit animation finishes.
- Budget: bounded CSS transforms, opacity/color and one grid-track disclosure; no measurement loop, animation dependency, layout observer, scroll hijacking or persistent will-change.

## Accessibility and browser surfaces

Closed group panels become `inert` and `aria-hidden` immediately; their exit can remain visible while links leave the keyboard/accessibility tree. Native buttons retain Enter/Space behavior and provide `aria-expanded` plus unique React-generated `aria-controls` IDs. Links retain real destinations, titles and `aria-current`. Existing Radix focus trapping, Escape/backdrop/X dismissal, navigation dismissal, focus return and desktop-resize release are preserved.

Reduced motion removes all spatial travel and drawer keyframes. Disclosure and selection remain fully visible and usable. Forced-colors mode uses native Highlight/HighlightText for the active destination. Visible focus rings and 44px targets remain available.

Only navigation scrolls; the brand stays anchored. A thin palette-derived thumb, transparent/dark track, hover/focus contrast and stable gutter replace the broad white native scrollbar track. Scrolling remains native and keyboard/touch usable. Scrollbar thickness/rendering can differ by browser and OS preferences.

## Files

- `src/components/portal/PortalSidebar.tsx`: accessible persistent accordion panels, scoped classes, semantic link lists and existing role/route handlers.
- `src/components/portal/PortalSidebar.module.css`: sidebar-only appearance, state/motion, scrollbar and reduced-motion/forced-colors styles.
- `tests/e2e/portal-sidebar-motion.spec.ts`: mocked read-only browser fixtures and behavior checks.
- `.agents/skills/trackcoop-design-system/references/interactions.md`: verified sidebar pattern for reuse.

## Visual review and verification

Before screenshots were captured from the original production build at 1440, 768 and 390px, then the matching after views were inspected in a batched pass. The final screenshots wait for actual animation completion rather than photographing a half-open drawer. They are stored under `.taste-skill/sidebar/before/` and `.taste-skill/sidebar/after/`; the financial figures are a synthetic test fixture, not a live database result. The view's data and layout outside the sidebar are unchanged.

The review confirmed a tighter navigation rhythm, a clear selected destination without a heavy white/shadow treatment, an unobstructed brand/close control, readable full navigation labels and no page overflow at the three widths. Keyboard behavior, interrupted group toggles, the original per-path manual choice on browser Back, mobile exits/focus return/resize, short-screen scrolling, reduced motion and Bookkeeper destinations are covered by browser tests.

Impeccable mechanical detector ran once on the finished TSX/CSS module: exit 0, `[]` findings, recorded in `.taste-skill/sidebar/detector.json`. The standalone Taste inspector was not run through the authenticated portal; production Playwright screenshots and explicit interaction/overflow checks supplied component-level inspection. No generic dashboard cleanup or rule suppressions were used.

Commands run:

- `npm run build`: production web and API compilation passed (the initial sandboxed font fetch failed; the unchanged build succeeded with network access).
- `npm run typecheck`: web/API passed.
- `npm run lint:ci`: passed, 54 existing errors / 77 warnings; baseline unchanged.
- `npx playwright test tests/e2e/portal-sidebar-motion.spec.ts tests/e2e/chairman-finance-monitoring.spec.ts`: passed: **22 browser tests**, including 10 sidebar cases and 12 existing finance-shell regressions.

Prior local sidebar/reference edits were backed up under `.git/sidebar-motion-backup` before editing. No commit, push or deployment is part of this request.
