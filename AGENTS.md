<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## TrackCOOP frontend

For UI work, read `.agents/skills/trackcoop-design-system/SKILL.md` and its relevant references. The human-facing index is `docs/design-system/README.md`; runtime values live in `src/styles/design-tokens.css`. Preserve existing public/portal compositions and reuse shared controls. Keep API contracts, business rules, auth, media paths, and unrelated working-tree changes intact. Run the relevant checks without regenerating the lint baseline.

Use the shared custom `StyledSelect` combobox for dropdown fields in new or edited UI, including filters and controls inside drawers. Do not introduce browser-native `<select>` or `<datalist>` menus. Reuse its searchable variant when text search is needed. Preserve option labels, underlying API values, keyboard navigation, focus return and responsive placement.


