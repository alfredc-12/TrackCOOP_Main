**# TrackCOOP Design System & UI/UX Guidelines**

\> **\*\*Purpose\*\***  

\> This file is the visual and interaction reference for TrackCOOP. New screens and redesigns should preserve the existing TrackCOOP color identity and current font while making layouts calmer, clearer, more spacious, more modern, and easier to understand.

\>

\> **\*\*Design priority:\*\*** simple first, clear second, polished third. The interface should feel robust without feeling crowded.

**---**

**## 1. Design Principles**

**### 1.1 Make the next action obvious**

Every screen should answer these questions within a few seconds:

1\. Where am I?

2\. What is the current status?

3\. What do I need to do next?

4\. What can I safely ignore for now?

Each view should have **\*\*one visually dominant primary action\*\***. Secondary actions must be quieter.

**### 1.2 Reduce visual density**

Do not solve complex workflows by placing every field, action, status, and explanation on one screen.

Prefer:

\- grouped sections

\- progressive disclosure

\- short summaries first, details on demand

\- drawers/modals for previews and secondary details

\- tabs only when they clearly separate different tasks

\- sticky contextual summaries for long forms/review screens

\- accordions only for genuinely optional or advanced information

Avoid:

\- walls of text

\- one card per field

\- excessive borders

\- large tables for information that is easier to scan as cards

\- repeating the same status in several places

\- exposing internal IDs or system terminology unnecessarily

**### 1.3 Calm, friendly, professional**

TrackCOOP should feel like a modern cooperative platform: trustworthy, practical, warm, and easy to use.

The interface should not feel like a generic admin template.

**### 1.4 Preserve the existing TrackCOOP identity**

Do not introduce a new brand palette or unrelated design language.

Use the existing green, cream, white, and harvest accent colors already used by TrackCOOP.



**### 1.5 Avoid “AI-generated explainer UI”**

TrackCOOP should **\*\*not\*\*** look like an AI-generated landing page inside normal application, dashboard, or review workflows.

Avoid these patterns:

\- giant oversized content blocks/cards that occupy a large portion of the screen

\- oversized marketing-style headings inside transactional pages

\- large explanatory blocks whose only purpose is to restate obvious workflow steps

\- repeated “what happens next” cards when the status/progress UI already communicates the same thing

\- verbose helper panels beside forms

\- decorative numbered explanations such as “1 submit, 2 review, 3 pay, 4 approve” when a compact progress indicator is enough

\- multiple stacked information cards on the side that repeat the same state in different words

\- large dark backgrounds with white text simply to create visual drama

\- copy-heavy hero sections inside forms, admin screens, or review pages

**\*\*Default rule:\*\*** application and dashboard screens should prioritize the task itself, not explanations about the task.

Use short guidance only where the user could realistically be confused. Most guidance should be one sentence or less.

Bad:

\`\`\`text

[VERY LARGE DARK CARD]

A guided membership application for NFFAC review.

1 Submit your information and signature.

2 NFFAC reviews your application.

3 Payment opens only after review.

4 Final membership approval follows payment.

\`\`\`

Better:

\`\`\`text

Membership Application                         Step 1 of 5

About You

Complete your personal details.

[form fields]

\`\`\`

Bad:

\`\`\`text

[Before payment]

NFFAC reviews the application first. If accepted for payment,

the payment link appears on the status dashboard.

\`\`\`

Better:

\`\`\`text

Payment

Not required yet

\`\`\`

If more context is genuinely needed, use a small muted helper line, tooltip, or inline info row instead of a large explanatory card.

**---**

**# 2. Existing TrackCOOP Visual Tokens**

These values come from the current project styles and should remain the base design language.

**## 2.1 Colors**

\| Token | Value | Use |

\|---|---:|---|

\| Background | \`#F7F8F3\` | Main app/page background |

\| Foreground | \`#17211C\` | Main body text |

\| Cream | \`#F8F1E5\` | Warm grouped sections / soft panels |

\| Surface | \`#FFFFFF\` | Cards, dialogs, elevated surfaces |

\| Field | \`#F7F8F3\` | Input backgrounds / subtle neutral surfaces |

\| Forest | \`#123D2A\` | Primary buttons, major headings, strongest brand color |

\| Green | \`#1F6B43\` | Interactive states, links, success, secondary brand emphasis |

\| Muted | \`#5D6D63\` | Secondary text |

\| Border | \`#CAD8CB\` | Standard borders and separators |

\| Accent | \`#82E6A7\` | Positive highlights and soft accents |

\| Harvest | \`#D8A011\` | Warning/attention/accent highlights |

\| Selection | \`#DFE8C2\` | Text-selection highlight |

**### Color hierarchy**

Use color intentionally.

\- **\*\*Forest (\`#123D2A\`)\*\***: primary CTA, major headings, strongest navigation state. Prefer it as an accent/text/action color rather than a giant filled surface on workflow screens.

\- **\*\*Green (\`#1F6B43\`)\*\***: secondary action, selected state, verified/success emphasis.

\- **\*\*Cream (\`#F8F1E5\`)\*\***: warm grouping background.

\- **\*\*White (\`#FFFFFF\`)\*\***: main content cards and dialogs.

\- **\*\*Muted (\`#5D6D63\`)\*\***: helper text and low-priority metadata.

\- **\*\*Harvest (\`#D8A011\`)\*\***: attention/warning states only. Do not use as a decorative default.

Do not create several slightly different greens unless there is a strong accessibility or state reason.



**### Dark-surface restraint**

Forest is a strong brand color, but avoid turning whole sections into oversized filled blocks. Use it with restraint for hierarchy, actions, and accents rather than large explanatory panels.

For forms, dashboards, application status, and Chairman review screens:

\- default large surfaces to White, Cream, or Background

\- use Forest mainly for headings, buttons, icons, small chips, navigation, and restrained accents

\- avoid full-width or half-screen dark panels unless the page is a true public landing/marketing hero

\- never use a giant dark card merely to explain the workflow

A normal operational page should feel light first, with dark green used to anchor the design rather than dominate it.

**---**

**# 3. Typography**

**## 3.1 Keep the current font**

Do not change the product font as part of layout redesign work.

The current global body stack is:

\`\`\`css

font-family: Arial, Helvetica, sans-serif;

\`\`\`

Keep this for now.

\> Note: the project also loads Geist through \`next/font\`, but the global body currently explicitly uses Arial/Helvetica. Do not change this unless a separate typography redesign is requested.

**## 3.2 Type hierarchy**

Use fewer type sizes with stronger hierarchy.

**### Page title**

\- 28–36px desktop

\- 24–30px mobile

\- 700–800 weight

\- Forest color

\- Tight line height

**### Section title**

\- 18–22px

\- 700–800 weight

\- Foreground or Forest

**### Card title / field group title**

\- 14–16px

\- 700 weight

**### Body**

\- 14–16px

\- 400–600 weight depending on emphasis

\- Foreground

\- Comfortable line height: 1.45–1.65

**### Helper / metadata**

\- 12–13px

\- 500–600 weight

\- Muted color

**### Avoid**

\- giant all-caps headings

\- too many uppercase labels

\- long paragraphs in bold

\- helper copy longer than necessary

\- marketing-style slogans inside forms or review screens

**### 3.3 Copy density**

Operational screens should use **\*\*microcopy, not essays\*\***.

Preferred limits:

\- field helper: 1 short line

\- status explanation: 1–2 short lines

\- card description: usually 1 short sentence

\- modal explanation: 1–2 short sentences before the actual controls

If a section needs a paragraph to explain itself, reconsider the layout or label first.

**---**

**# 4. Spacing System**

Use an 8px-based spacing rhythm.

Preferred values:

\- \`4px\` — very tight icon/text relationships

\- \`8px\` — small inline spacing

\- \`12px\` — compact control spacing

\- \`16px\` — default internal spacing

\- \`24px\` — card/section spacing

\- \`32px\` — major section gap

\- \`48px\` — major page separation

\- \`64px\` — large landing/hero spacing

**## 4.1 Minimum breathing room**

\- Fields should not touch each other.

\- Card content should generally have at least \`20–24px\` padding on desktop.

\- Major sections should generally have \`24–32px\` vertical separation.

\- Do not compress everything to fit above the fold.

White space is part of the interface, not wasted space.

**---**

**# 5. Page Layout**

**## 5.1 Main content container**

Recommended desktop content width:

\- standard app pages: \`max-width: 1280px\`

\- information-heavy dashboards: up to \`1440px\`

\- focused forms: \`960–1120px\`

\- reading/detail pages: \`800–1000px\`

Recommended page gutters:

\- mobile: \`16px\`

\- tablet: \`20–24px\`

\- desktop: \`24–32px\`

Do not stretch forms across the full browser width.

**## 5.2 Use two-column layouts carefully**

For long workflows, prefer:

\`\`\`text

Main content           Context / Summary

65–72%                 28–35%

\`\`\`

The right column may be sticky on desktop when it provides:

\- progress

\- totals

\- current status

\- next action

\- review checklist

On smaller screens it becomes a normal stacked section.

**## 5.3 One purpose per visual region**

Do not mix applicant details, payment actions, document review, and history inside one undifferentiated card.

Create meaningful regions such as:

\- Overview

\- Requirements

\- Documents

\- Payment

\- Activity

\- Review / Next Action

**---**

**# 6. Cards & Surfaces**

Cards should group related information, not decorate every element.

**## 6.1 Standard card**

\- Background: white

\- Border: subtle \`#CAD8CB\`

\- Radius: \`16–20px\`

\- Padding: \`20–24px\`

\- Shadow: very soft, only when elevation is useful

**## 6.2 Soft section**

Use cream \`#F8F1E5\` or field background \`#F7F8F3\` for grouped supporting content.

**## 6.3 Avoid card overload**

Bad:

\`\`\`text

[Email card]

[Phone card]

[Address card]

[DOB card]

\`\`\`

Better:

\`\`\`text

Applicant Overview

\--------------------------------

Email       user\@email.com

Phone       +63...

DOB         ...

Address     ...

\`\`\`

Use cards for **\*\*sections\*\***, not every value.

**## 6.4 Do not use cards as explanations**

Cards should hold useful content or actions, not fill empty space with prose.

Avoid sidebars made of cards such as:

\`\`\`text

[Before payment]

paragraph explaining payment

[Files ready]

paragraph explaining files

[Current stage]

paragraph explaining the current stage

\`\`\`

Prefer one compact summary:

\`\`\`text

Application Summary

Membership Path    Associate

Payment            Not required yet

Documents          2 ready

Progress           Step 1 of 5

\`\`\`

Use a second card only when it contains a distinct action or genuinely different information.

**---**

**# 7. Forms**

Forms must feel guided, not like database entry screens.

**## 7.1 Group fields logically**

Example:

\`\`\`text

Personal Information

[First Name] [Middle Name]

[Last Name]  [Suffix]

Contact

[Email]      [Phone]

Personal Details

[DOB]        [Civil Status]

[Occupation]

\`\`\`

**## 7.2 Desktop form density**

Use two columns for short related fields when appropriate.

Use a single column for:

\- addresses

\- long text

\- document uploads

\- signatures

\- explanation-heavy fields

**## 7.3 Inputs**

Recommended:

\- height: \`44–48px\`

\- radius: \`12–16px\`

\- background: white or \`#F7F8F3\`

\- border: \`#CAD8CB\`

\- focus: Green border + subtle green focus ring

\- labels above controls

\- helper/error text below

Errors should be specific and close to the field.

Avoid showing a giant generic error block when the problem can be explained locally.

**## 7.4 Multi-step forms**

Long applications should be split into understandable steps.

Each step should contain only the fields needed for that topic.

Recommended structure:

\`\`\`text

01 About You

02 Address & Family

03 Membership

04 Documents & Signature

05 Review & Submit

\`\`\`

Show progress clearly.

Do not display all steps' fields at once.

**---**

**# 8. Buttons & Actions**

**## 8.1 Primary button**

Use Forest \`#123D2A\`.

\- white text

\- rounded 12–999px depending on context

\- strong but not oversized

\- one dominant primary action per view

**## 8.2 Secondary button**

\- white or transparent background

\- green/forest text

\- subtle border

**## 8.3 Destructive actions**

Use red only for destructive/reject/delete actions.

Do not make destructive actions visually equal to the primary CTA.

**## 8.4 Button feedback**

Buttons should feel responsive:

\- hover: slight lift or tone change

\- press: slight scale-down

\- loading: spinner + preserved button width

\- disabled: clearly disabled but readable

**---**

**# 9. Navigation Between Views**

When the user moves from one step/view to another, the interface should feel smooth, connected, and intentional.

Examples:

\- Next or previous step in a form

\- Opening or closing an application detail

\- Switching between dashboard sections

\- Switching tabs or segmented views

\- Opening payment, review, document, or history views

\- Returning from a detail view

\- Replacing one content panel with another

\- Changing filters, sort order, or search results

\- Moving between empty, loading, success, and error states

**Universal rule:** no meaningful view change should appear as a hard visual cut when a short transition can communicate the change clearly.

Use animated transitions for both **exit and entrance** states. The outgoing view should visibly leave before or while the incoming view enters. Keep the motion subtle, directional, and fast.

For route-level or major view changes, use `AnimatePresence` or an equivalent transition boundary so the previous view can animate out instead of disappearing instantly.

**---**

**# 10. Motion & Animation System**

TrackCOOP should have polished motion, not flashy motion.

The project already includes \`framer-motion\` / \`motion\`, so prefer those for React view transitions and component animations.

**## 10.0 Universal Motion Requirement**

Motion is part of the default interaction behavior across TrackCOOP.

**Everything that visually changes should transition instead of snapping whenever practical.** This includes not only page navigation, but also cards, lists, rows, panels, tabs, filters, status values, counters, progress, dialogs, drawers, accordions, dropdowns, validation messages, loading placeholders, success states, empty states, and content that is inserted, removed, replaced, resized, reordered, expanded, collapsed, or moved.

This does **not** mean that every static element should constantly move. Static content should remain still. The rule applies when the UI **changes state, position, size, visibility, content, hierarchy, or emphasis**.

Default behavior:

\- elements entering the UI animate in

\- elements leaving the UI animate out

\- elements changing size animate between sizes

\- elements changing position animate to their new position

\- elements being reordered animate to their new order

\- content swaps cross-fade or use a small directional transition

\- cards changing state animate border/background/elevation/content changes

\- list and table updates animate additions/removals without jarring jumps

\- progress and numeric changes animate smoothly where it improves clarity

\- tabs and segmented controls animate both the active indicator and the content change

\- expanding/collapsing sections animate height and opacity

\- loading → loaded, empty → populated, and error → recovered states transition smoothly

\- route/view changes animate both the outgoing and incoming content

**No-pop rule:** avoid abrupt mounting/unmounting for visible UI whenever the change can be animated safely and quickly.

**Consistency rule:** use shared motion primitives and tokens so motion feels like one system, not a collection of unrelated effects.

**Performance rule:** prefer transform and opacity animations. Avoid expensive layout animation when it causes jank, especially on large tables or low-powered mobile devices.

**Accessibility rule:** all universal motion requirements remain subordinate to `prefers-reduced-motion`. Reduced-motion users should receive immediate state changes or very short opacity transitions instead of spatial movement.

**## 10.1 Motion principles**

Animations should:

\- reinforce hierarchy

\- show cause and effect

\- make screen changes feel connected

\- help users understand where content came from

Animations should NOT:

\- delay the user

\- bounce unnecessarily

\- animate every element independently

\- distract from form entry

\- create motion sickness

**## 10.2 Timing**

**### Micro interaction**

For buttons, toggles, chips:

\- \`100–160ms\`

**### Component transition**

For cards, dropdowns, small panels:

\- \`160–240ms\`

**### View/step transition**

For major content changes:

\- \`240–360ms\`

Do not use long 600ms+ transitions for normal app navigation.

**## 10.3 Recommended easing**

Use smooth ease-out for entrances.

Example:

\`\`\`text

cubic-bezier(0.22, 1, 0.36, 1)

\`\`\`

Use quick ease-in for exits.

**## 10.4 View entrance**

Recommended:

\`\`\`text

opacity: 0 → 1

y: 12px → 0

\`\`\`

Duration:

\`\`\`text

260–320ms

\`\`\`

This should be the default animation when moving to a new application step or loading a major panel.

**## 10.5 View exit**

Recommended:

\`\`\`text

opacity: 1 → 0

y: 0 → -6px

\`\`\`

Duration:

\`\`\`text

140–200ms

\`\`\`

Exit should usually be faster than entrance.

**## 10.6 Staggered content entrance**

For a new view containing several important sections, use a small stagger:

\`\`\`text

40–60ms between sections

\`\`\`

Example:

1\. heading enters

2\. primary card enters

3\. supporting card enters

4\. actions enter

Do not stagger every form field individually.

**## 10.7 Button press**

On press:

\`\`\`text

scale: 1 → 0.98

\`\`\`

Duration:

\`\`\`text

80–120ms

\`\`\`

On release return immediately/smoothly to \`1\`.

**## 10.8 Hover**

For clickable cards/buttons:

\`\`\`text

y: 0 → -1px

\`\`\`

or a subtle shadow/border change.

Avoid large hover movement.

**## 10.9 Dialog/modal animation**

Backdrop:

\`\`\`text

opacity: 0 → 1

\`\`\`

Dialog:

\`\`\`text

opacity: 0 → 1

scale: 0.98 → 1

y: 8px → 0

\`\`\`

Duration:

\`\`\`text

180–240ms

\`\`\`

Close animation should be slightly faster.

**## 10.10 Drawer animation**

Desktop side panel:

\`\`\`text

x: 24px → 0

opacity: 0 → 1

\`\`\`

Mobile bottom sheet:

\`\`\`text

y: 24px → 0

opacity: 0 → 1

\`\`\`

**## 10.11 Status updates**

When a status changes:

\- softly fade/scale the new chip

\- briefly highlight the updated section

\- avoid confetti unless specifically appropriate for a major completion event

**## 10.12 Card and surface transitions**

Cards and grouped surfaces must animate when their state or structure changes.

Examples:

\- card enters: `opacity 0 → 1`, `y 8px → 0`

\- card exits: `opacity 1 → 0`, `y 0 → -4px`

\- card expands/collapses: animate height, opacity, and internal spacing

\- selected card: animate border, background, and subtle elevation

\- card content replacement: cross-fade old/new content

\- card reorder: use layout animation so cards glide into their new positions

\- card removal: animate out before surrounding cards close the gap

Use `layout` / layout-aware motion for grids, queues, dashboard cards, review items, and responsive card collections where positions can change.

Do not animate cards with large jumps, spins, or exaggerated scaling.

**## 10.13 Lists, tables, and filtered results**

Dynamic collections should not snap when items are added, removed, filtered, sorted, or reordered.

Recommended behavior:

\- new item: fade + small rise

\- removed item: quick fade + slight collapse

\- reorder/sort: animate layout position

\- filter/search replacement: brief cross-fade or staggered group entrance

\- pagination: animate the content region, not every cell independently

\- table row status change: brief background emphasis + status chip transition

For large data sets, animate only the visible container/rows necessary to preserve performance.

**## 10.14 Tabs, segmented controls, and view switches**

Tabs should animate:

\- active indicator position

\- active text/color state

\- outgoing content

\- incoming content

Default content transition:

```text
out: opacity 1 → 0, y 0 → -4px
in:  opacity 0 → 1, y 6px → 0
```

Do not instantly replace large tab panels.

**## 10.15 Expand/collapse, accordion, and disclosure**

Any content that opens or closes should animate both geometry and visibility.

Recommended:

```text
closed: height 0, opacity 0
open:   height auto, opacity 1
```

Use measured/layout animation where `height: auto` needs reliable interpolation.

Chevron/icon rotation should transition with the content state.

**## 10.16 Form-state animation**

Forms should animate state changes without distracting from typing.

Animate:

\- field errors appearing/disappearing

\- helper text replacement

\- success confirmation

\- disabled/enabled state

\- conditional fields entering/exiting

\- step validation summary appearing

\- upload progress and completion

Do not animate cursor movement, typed characters, or every keystroke.

Field errors should appear with a short opacity/vertical transition rather than suddenly shifting the entire form.

**## 10.17 Status, numbers, and progress**

Status changes should feel acknowledged.

Animate:

\- chip text/background changes

\- check/error/warning icon entrance

\- progress bar width

\- step indicator movement

\- counters or totals that visibly change

\- payment state changes such as waiting → paid

For numbers, use a short count/roll only when the change itself matters. Do not animate routine static values on every render.

**## 10.18 Loading, skeleton, empty, and error state transitions**

State transitions should be smooth:

```text
loading → loaded
loading → error
empty → populated
error → retrying
retrying → loaded
```

Skeletons should fade out as real content fades in. Preserve dimensions where possible to prevent layout jumps.

Do not remove a loading placeholder one frame before content appears.

**## 10.19 Toasts and notifications**

Notifications should animate in and out using the existing Sonner system.

Recommended:

\- enter: fade + small slide

\- exit: faster fade + slide

\- stacked toasts should reposition smoothly

Do not use large bouncing or attention-grabbing entrance effects.

**## 10.20 Icon and control-state transitions**

Icons that represent changing state should transition.

Examples:

\- chevron rotates on expand/collapse

\- eye icon changes on password visibility

\- favorite/bookmark/toggle state cross-fades or scales subtly

\- loading spinner replaces an action icon smoothly

\- sort direction arrow rotates or swaps smoothly

Keep icon motion within micro-interaction timing.

**## 10.21 Shared-layout and element continuity**

When the same conceptual element appears across two states or views, prefer shared-layout motion instead of destroying and recreating it visually.

Examples:

\- selected application card → application detail header

\- dashboard card → expanded detail panel

\- thumbnail → document preview

\- compact payment summary → expanded payment panel

\- active tab underline moving between tabs

Shared-layout motion should be restrained and must not slow navigation.

**## 10.22 Route and full-view transitions**

Every major route or full-view transition should define both exit and enter behavior.

Default:

```text
exit:
  opacity 1 → 0
  y 0 → -6px
  140–180ms

enter:
  opacity 0 → 1
  y 10px → 0
  240–300ms
```

Use direction-aware horizontal movement only where direction is meaningful, such as wizard forward/back navigation.

Avoid full-screen wipes, zooms, or large slides for normal application navigation.

**## 10.23 Reduced motion**

Always respect:

\`\`\`css

@media (prefers-reduced-motion: reduce)

\`\`\`

When reduced motion is enabled:

\- remove large transforms

\- remove stagger delays

\- keep only instant or very short opacity changes

Accessibility takes priority over decorative motion.

**---**

**# 11. Step/View Transition Pattern**

For multi-step workflows:

**### Forward navigation**

New content enters from slightly below/right:

\`\`\`text

opacity 0 → 1

x 10px → 0

y 6px → 0

\`\`\`

**### Back navigation**

New content may enter from slightly left:

\`\`\`text

opacity 0 → 1

x -10px → 0

\`\`\`

Keep movement small.

The movement should communicate direction without looking like a mobile slideshow.

Implementation expectation:

\- wrap replaceable step/view content in `AnimatePresence`

\- provide stable keys per step/view so exits can complete

\- use `mode="wait"` when simultaneous views would overlap incorrectly

\- use layout animation for surrounding containers whose height changes between steps

\- animate the progress indicator at the same time as the content transition

\- move focus to the new step heading after the transition begins/completes as appropriate for accessibility

**---**

**# 12. Loading States**

Do not leave empty screens while loading.

Use:

\- skeleton rows/cards when content structure is known

\- spinner only for small actions

\- preserve layout dimensions while loading

For button actions:

\`\`\`text

[ Save Changes ]

\`\`\`

becomes:

\`\`\`text

[ spinner  Saving... ]

\`\`\`

Do not disable the entire screen unless the operation genuinely blocks all interaction.

**---**

**# 13. Empty States**

Empty states should explain what the user can do next.

Bad:

\`\`\`text

No data.

\`\`\`

Better:

\`\`\`text

No membership applications yet.

New applications will appear here when submitted.

\`\`\`

If the user can create/add something, include the action.

**---**

**# 14. Status Design**

Use compact status chips, not giant colored banners everywhere.

Suggested semantics:

\- Green: complete / verified / active / approved

\- Harvest/amber: waiting / attention / pending

\- Red: rejected / failed / destructive

\- Neutral gray/green-muted: inactive / unavailable / not started

\- Forest: current primary state when appropriate

Every status must include text; do not rely on color alone.

**---**

**# 15. Tables vs Cards**

Use tables for data comparison and dense structured lists.

Use cards for:

\- people

\- applications

\- documents

\- tasks

\- mobile layouts

On mobile, convert complex tables into cards or horizontally safe compact rows.

Do not force a desktop table onto a 360px-wide screen.

**---**

**# 16. Modal & Detail Patterns**

Use dialogs/drawers for detail that should not make the user lose context.

Good candidates:

\- document preview

\- signature preview

\- requirement verification

\- request information

\- final confirmation

\- payment details

A modal should have:

1\. clear title

2\. concise context

3\. main content

4\. primary action

5\. secondary/cancel action

Avoid overloading dialogs with entire forms when a full page is more appropriate.

**---**

**# 17. Dashboard Layout**

Dashboards should prioritize decisions and current work, not raw metrics.

Recommended order:

1\. Page title + current context

2\. Primary actions

3\. Important status/summary

4\. Work queue / next tasks

5\. Supporting metrics

6\. History/detail

Do not put six equally weighted KPI cards at the top unless they genuinely help the user act.

**---**

**# 18. Review Workspace Pattern**

For admin/chairman/reviewer screens, prefer a review workspace instead of a giant detail form.

Desktop:

\`\`\`text

\---------------------------------------------------

Header + status + primary actions

\---------------------------------------------------

Main details/content        Sticky Review Panel

65–72%                      28–35%

\---------------------------------------------------

\`\`\`

Main content can contain:

\- overview

\- documents

\- signatures

\- related records

\- activity timeline

Sticky review panel contains:

\- progress

\- requirements

\- unresolved items

\- next action

This keeps review decisions understandable and prevents too much text competing for attention.

**---**

**# 19. Application / Wizard Pattern**

Application forms should feel like guided journeys.

Recommended structure:

\`\`\`text

Header / Purpose

Progress

Main Step Content       Optional Summary

Back                    Continue

\`\`\`

The summary should display only useful context, such as:

\- selected membership type

\- required amount

\- documents completed

\- current progress

Do not duplicate every field in the summary.

**### 19.1 No marketing hero inside the application**

The membership application itself should begin with a compact page header, not a large promotional block.

Preferred:

\`\`\`text

Membership Application

Step 1 of 5 · About You

[progress]

[form]

\`\`\`

Avoid:

\- oversized dark hero cards

\- large slogans such as “A guided membership application for NFFAC review”

\- numbered workflow explanations above the form

\- photo banners that consume significant vertical space before the user can reach the actual task

A public landing page may use a restrained hero. The actual application flow should be task-first.

**---**

**# 20. Responsive Rules**

**## Mobile**

\- one main column

\- 16px page gutter

\- full-width primary buttons where helpful

\- stack field pairs

\- sticky side panels become normal content

\- dialogs fit within viewport

\- touch targets at least \~44px high

**## Tablet**

\- two columns only when content remains readable

\- avoid narrow 3-column grids

**## Desktop**

\- use available width for hierarchy, not density

\- allow sticky contextual sidebars

\- keep readable line lengths

**---**

**# 21. Accessibility**

All UI redesigns must preserve accessibility.

Required:

\- visible keyboard focus

\- semantic labels

\- accessible dialogs

\- no color-only status communication

\- adequate text contrast

\- keyboard-operable dropdowns

\- minimum practical touch targets

\- reduced-motion support

\- meaningful loading announcements where appropriate

**---**

**# 22. Interaction Feedback**

Every meaningful action should visibly respond.

Examples:

**### Save**

\`\`\`text

Saving...

✓ Saved

\`\`\`

**### Upload**

\`\`\`text

Uploading...

✓ Document uploaded

\`\`\`

**### Review**

\`\`\`text

Verifying...

✓ Verified

\`\`\`

**### Navigation**

Button press → short feedback → current view exits → next view enters.

Users should never wonder whether their click worked.

In addition, the visual region affected by the action should transition to its new state. Do not rely only on a toast when the card, row, status, total, button, or panel itself changed.

Examples:

\- approving an application → button loading state + row/card status transition

\- uploading a file → progress state + file card entrance

\- deleting an item → item exit animation + surrounding layout closing smoothly

\- changing a filter → control state transition + results transition

\- successful payment → waiting state exits + success state enters + relevant totals/status update smoothly

**---**

**# 23. Animation Examples for TrackCOOP**

**## Multi-step application**

When pressing **\*\*Continue\*\***:

1\. button briefly scales to \`0.98\`

2\. current step fades out in \`150–180ms\`

3\. next step fades/slides in over \`260–300ms\`

4\. progress indicator updates smoothly

5\. focus moves to the new step heading

**## Opening an application review**

1\. page header enters first

2\. main applicant overview enters

3\. review sidebar enters with a small delay

4\. document/activity sections follow with subtle stagger

**## Opening a modal**

1\. backdrop fades in

2\. modal scales from \`0.98\` and rises \`8px\`

3\. content is immediately interactive

**## Completing an important step**

Use a subtle success transition:

\- icon fade/scale

\- status chip change

\- section background briefly soft-green

No excessive celebration animation for routine admin actions.

**---**

**# 24. Visual Density Checklist**

Before considering a page finished, ask:

\- Is there enough whitespace between major areas?

\- Can I tell what the primary action is immediately?

\- Are unrelated pieces of information separated?

\- Can secondary details be hidden until requested?

\- Are long paragraphs necessary?

\- Are too many controls visible at once?

\- Does the user need every field on this view right now?

\- Can a table become a more readable card layout?

\- Can multiple small cards become one structured section?

\- Does the page still work at mobile width?

\- Is there a giant dark card that could simply be a heading or compact summary?

\- Am I explaining something the progress/status UI already makes obvious?

\- Would deleting half of the helper copy make the screen clearer?

\- Does this look like an operational product, or an AI-generated marketing mockup?

\- Does every meaningful enter/exit have a transition?

\- Do cards animate when they are added, removed, expanded, collapsed, reordered, or replaced?

\- Do view/tab/step changes animate both outgoing and incoming content?

\- Do loading, empty, error, and success states transition instead of snapping?

\- Do status/progress changes visibly transition?

\- Does all motion still work correctly with reduced-motion enabled?

If the screen feels crowded, remove or defer information before making fonts smaller.

If the screen feels visually heavy, first remove oversized filled panels and unnecessary explanatory text before changing colors.

**---**

**# 25. Impeccable Usage Rule**

When Impeccable is available, use it to improve:

\- page composition

\- spacing

\- information hierarchy

\- form layout

\- dashboard balance

\- responsive structure

\- review workflows

\- modal composition

\- visual rhythm

Running a detector alone does **\*\*not\*\*** count as using Impeccable.

A redesign should produce a visibly improved rendered layout.

Preserve the TrackCOOP palette and current font while using Impeccable to improve composition and usability.

When using Impeccable, explicitly reject generic AI-design tendencies:

\- no oversized dark hero card inside app workflows

\- no verbose explanatory card stacks

\- no giant slogan typography in transactional views

\- no visual filler

\- no unnecessary section intros when a good label is enough

Impeccable should make the interface more intentional and human, not more decorative or verbose.

**---**

**# 26. Implementation Guidance**

Use existing project tools where practical:

\- Tailwind CSS for styling

\- Radix UI for accessible dialogs/selects/tabs

\- Lucide for icons

\- Framer Motion / Motion for transitions

\- Sonner for lightweight notifications

Do not add another UI framework unless clearly necessary.

Prefer reusable layout components and motion primitives rather than duplicating animation classes in every feature.

Suggested reusable primitives:

\- \`PageShell\`

\- \`PageHeader\`

\- \`SectionCard\`

\- \`StatusChip\`

\- \`ProgressSteps\`

\- \`ReviewSidebar\`

\- \`AnimatedView\`

\- \`AnimatedRoute\`

\- \`AnimatedPresenceGroup\`

\- \`AnimatedCard\`

\- \`AnimatedList\`

\- \`AnimatedListItem\`

\- \`AnimatedTabsContent\`

\- \`AnimatedCollapse\`

\- \`AnimatedStatus\`

\- \`AnimatedNumber\`

\- \`AnimatedSwap\`

\- \`AnimatedDialogContent\`

\- \`AnimatedDrawerContent\`

\- \`FormSection\`

\- \`EmptyState\`

Centralize motion tokens instead of defining arbitrary durations/easings per feature.

Recommended shared motion tokens:

```ts
export const motionTokens = {
  easeOut: [0.22, 1, 0.36, 1],
  micro: 0.14,
  component: 0.22,
  viewEnter: 0.28,
  viewExit: 0.16,
  stagger: 0.05,
};
```

Recommended reusable variants:

\- `fadeIn`

\- `fadeUp`

\- `fadeDown`

\- `viewForward`

\- `viewBack`

\- `cardEnter`

\- `cardExit`

\- `collapse`

\- `statusChange`

\- `modal`

\- `drawer`

\- `reducedMotion`

Use `AnimatePresence` for mounting/unmounting and `layout` / `layoutId` for size, position, and shared-element transitions.

**---**

**# 27. Definition of a Successful TrackCOOP Redesign**

A screen is successful when:

\- it uses the existing TrackCOOP colors

\- it keeps the existing font

\- it is noticeably more spacious and visually organized

\- the next action is obvious

\- information is grouped by purpose

\- users are not exposed to unnecessary implementation details

\- forms are broken into manageable sections

\- long review pages use progressive disclosure

\- transitions make navigation feel smooth

\- every meaningful UI change has a polished enter/exit/state transition

\- cards, lists, panels, status changes, filters, tabs, and dynamic content never snap unnecessarily

\- animations are subtle, purposeful, consistent, and performant

\- reduced-motion behavior is preserved everywhere

\- mobile layouts remain usable

\- the interface feels cohesive across modules

The goal is not to make TrackCOOP visually busy.

The goal is to make TrackCOOP feel **\*\*simple, polished, modern, confident, and easy to use\*\***.