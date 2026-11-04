# UI refinement audit — 2026-11-02

## Evidence and scope

The audit read 362 frontend TS/TSX/CSS source files, 121 page routes, and the 129 page/layout route files. `source-inventory.json` records colors, route imports, shared consumers, and heuristic review candidates from the pre-refinement snapshot. Heuristic candidates are not automatically defects. An independent read-only layout assessment reviewed route families and their principal clients; browser validation is listed separately in `verification.md`.

Included families: landing/about/board, membership/application status/payment, announcements/gallery/contact/tracking, login/security, member tabs, chairman/member/application management, bookkeeper finance, share capital, inventory/POS, rental public/operational/admin, documents/reports/history, settings, and account management.

## Identity retained

The existing visual identity is strong: forest navigation and headings, green actions, white/sage surfaces, the pale public canvas, agricultural imagery, rounded cards with restrained depth, and distinct layouts for browsing, forms and operational work. Actual body text is Arial/Helvetica, while root layout also exposes Geist variables. The two backgrounds and legacy cream were preserved as separate semantic roles. No preset skill palette or new typography was installed.

## Findings and implemented fixes

| Priority | Demonstrated issue | Implementation |
| --- | --- | --- |
| P1 | Shared StyledSelect only handled click selection and trigger Escape; no full listbox keyboard behavior, local popup clipping risk | Existing Radix select dependency now supplies focus, arrow keys, typeahead, dismissal, portal and collision handling; controlled string API preserved |
| P1 | Login main/form used `h-screen overflow-hidden`, clipping controls on short/zoomed displays | Content-driven min viewport height, natural scrolling, same form/auth handlers |
| P1 | Password-change labels were separate from inputs with no IDs | Associated current/new/confirm labels and appropriate autocomplete metadata; validation unchanged |
| P1 | Closed mobile sidebar remained mounted and offscreen, leaving keyboard targets; open drawer lacked modal focus containment | Named Radix navigation dialog, Escape/backdrop dismissal, focus containment and close control |
| P2 | Shared pagination icons had no accessible names and could submit parent forms; crowded mobile footer | Explicit button types/names, wrapping layout, 44px mobile targets; paging calculations unchanged |
| P2 | Shared table scroll container was not a named keyboard target | Focusable labelled internal scroll region, keyboard row highlight, existing table markup and feature actions preserved |
| P2 | FormDialog close icon had no accessible name | Explicit Close dialog label and larger target |
| P2 | Input placeholder `#8a958e` was faint; shared input could force narrow parent width | Existing muted foreground as placeholder, min-width constraints, consistent focus/invalid states |
| P2 | KPI labels used 11px uppercase text and truncated important values | Readable sentence-case labels, wrapping/tabular figures, restrained panels; data unchanged |
| P2 | Portal topbar and content could both expose leading h1s; profile control unnamed on phones | Topbar context as paragraph, main title retained; account-menu name added |
| P2 | Financial dashboard visual CSS order differed from DOM order | Summaries/action center precede charts in DOM as well as visual order; computations untouched |
| P2 | Colors/elevation copied through shared/public/member controls despite existing aliases | Central runtime token file, compatibility aliases, semantic Tailwind classes across selected consumers |
| P3 | Repeated large empty cards, aggressive retry color, animation without shared reduced-motion alternative | Compact shared empty states, neutral retry action, retained status text with nonspinning/skeleton alternative |

Shared reach at audit time: PortalPrimitives had 35 direct importing modules, PageHeader 26, Button 19, Modal 14, StyledSelect 8, and DatePicker 10. These counts describe direct import sites, not unique routes or exhaustive runtime coverage. Additional relative imports exist.

## Skills inspected

Used actual installed instructions for `design-taste-frontend` (composition/operate guidance), `impeccable` (layout, audit, extraction, craft floor, bounded refinement), and `skill-creator` (scoped portable skill and validation). UI/UX Pro Max, Neumorphism, shadcn/ui skill, and Web Design Guidelines skill were not found in the installed root inventories. Existing Radix/CVA/Tailwind architecture was reused; no dependency was added or component library replaced.

## Remaining targeted follow-ups

These are source-assessed legacy pockets, not regressions introduced by the shared layer:

- `PosSalesClient.tsx` and parts of `MemberPosClient.tsx` retain custom selectors/overlays. Migrate each with dedicated checkout/release/receipt interaction tests; don't confuse this with a payment workflow change.
- The POS sales table has a contained 860px desktop grid. A mobile identity/action list following DocumentsPage would improve it; horizontal containment currently remains.
- ReportHistoryPage's row-action panel should show the selected report identity beside its commands.
- Landing's intentionally dense photograph hero has short-height rules that deserve dedicated zoom/content review before geometry changes. The current composition was preserved.
- Raw feature tables and fields outside shared primitives still contain one-off colors and labels. Centralizing common consumers does not mean all literals disappeared.
- Contact information/socials contain existing placeholder values, clearly labelled on the page. Their real replacements require verified cooperative details, not invented copy.

No API, database, payment, permission, or authentication business rules were changed. No commit, push, merge, deployment, or publication is part of this task.
