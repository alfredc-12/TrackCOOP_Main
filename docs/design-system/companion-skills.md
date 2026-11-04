# Installed companion skills

All four requested skills are installed project-locally under `.agents/skills/`. Invoke `$trackcoop-design-system` as the main project guide; its routing table selects the relevant companions. Major design work may use several; an ordinary fix does not need every skill.

| Installed name | Local entry point | Upstream source | Pinned revision |
| --- | --- | --- | --- |
| `ui-ux-pro-max` | `.agents/skills/ui-ux-pro-max/SKILL.md` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/3a13158ff1f32156cbe144108de48eda2ecaed9a/.claude/skills/ui-ux-pro-max) | `3a13158ff1f32156cbe144108de48eda2ecaed9a` |
| `neumorphism` | `.agents/skills/neumorphism/SKILL.md` | [bergside/awesome-design-skills](https://github.com/bergside/awesome-design-skills/tree/f631a09b4fcc0166f2e2c1a8c81906ef680c57e8/skills/neumorphism) | `f631a09b4fcc0166f2e2c1a8c81906ef680c57e8` |
| `shadcn` | `.agents/skills/shadcn/SKILL.md` | [shadcn-ui/ui](https://github.com/shadcn-ui/ui/tree/c0d63c339d6cd2fc26135590a54cf1f362269451/skills/shadcn) | `c0d63c339d6cd2fc26135590a54cf1f362269451` |
| `web-design-guidelines` | `.agents/skills/web-design-guidelines/SKILL.md` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/web-design-guidelines) | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` |

These were copied with the bundled Skill Installer from the supplied repositories, including their packaged supporting files. UI/UX Pro Max's scripts/data directories were confirmed present. No application package or component framework was installed by these operations. Upstream skill contents are retained; TrackCOOP-specific integration constraints live in the main project skill.

## Practical use

Example: “Use `$trackcoop-design-system` to improve the member financial history.” The guide selects UI/UX Pro Max for hierarchy and filters, Taste for substantial composition if needed, Impeccable for critique, and Web Design Guidelines for a scoped quality review. Neumorphism contributes only when selective soft depth is relevant. The shadcn skill applies when actual shadcn work is requested and compatible; it does not replace custom components merely because they share names.

The initial UI audit correctly recorded these four as unavailable at that time. They were installed afterward on 2026-11-02. Do not claim that their later installation means they were used retrospectively for the earlier UI changes.
