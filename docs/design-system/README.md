# TrackCOOP design system

This folder records the real application, the refinements applied to it, and the reusable conventions for future work.

- **Use the skill:** [trackcoop-design-system](../../.agents/skills/trackcoop-design-system/SKILL.md). It is project-local and automatically discoverable by compatible agents; invoke it explicitly with `$trackcoop-design-system` after refreshing skill discovery.
- **See the colors and layout examples:** [visual reference](preview.html), a static documentation artifact. Open it in a browser; it imports the actual runtime token file. It has no application route, API, or checkout behavior.
- **Runtime tokens:** [design-tokens.css](../../src/styles/design-tokens.css); [shared component defaults](../../src/styles/design-system.css).
- **Rules and real component paths:** [reference index](../../.agents/skills/trackcoop-design-system/SKILL.md#choose-the-reference-for-the-job).
- **Audit:** [findings and scope](audit.md); [full source inventory](source-inventory.json).
- **Validation:** [verification](verification.md).
- **Staff sidebar motion:** [component refinement and verification](sidebar-motion.md), including mounted/inert accordions, mobile enter/exit, selected/hover/focus states and a themed native scrollbar.
- **Companion skills:** [installed sources and routing](companion-skills.md). Calling the main TrackCOOP skill selects the relevant installed companions.
- **Files and implementation details:** [implementation map](changed-files.md).
- **Chairman member analytics:** [functional and layout reference](../member-analytics/README.md), including the left comparison drawer, right analytical details, filtered Member Directory links and data-coverage conventions.

The design keeps TrackCOOP's existing forest/green palette, pale public canvas, workspace background, actual body font, photography and distinct public/operational layouts. Shared primitives apply the refinements across their existing consumers; feature-specific layouts are not forcibly replaced with one template.

For a new UI task, inspect a comparable current page first, reuse the listed controls, use semantic tokens, and validate the real interactions at phone/tablet/desktop widths. When a verified better pattern is established, update the matching skill reference rather than accumulating conflicting style notes.

Dropdown standard: use the shared custom `StyledSelect` in new or edited UI, matching the white popup, sage selected row and green selection dot used in Users filters. Its searchable variant replaces native datalist menus. This preference is also recorded in `AGENTS.md`.
