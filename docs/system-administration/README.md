# Chairman System Settings and Activity History

Implemented in `feature/chairman-system-settings-audit`, in sibling `TrackCOOP_SystemSettingsAudit_Worktree`, from local main `2580d12`. The original `TrackCOOP_Main` checkout stays on main. No pull, push, deployment, production-data change, migration or environment-file change is included. The original main contains unrelated local work and another agent's rental-email changes; those were not copied or modified.

## Independent pages

- `/portal/chairman/settings` mounts `SystemSettingsClient`: category tabs, supported controls, saved/application-default/invalid-value distinctions, pending edits, review of Before/After values, discard/refresh protection and clear save feedback.
- `/portal/chairman/audit-logs` mounts `ActivityHistoryClient`, titled **Activity History**. The existing sidebar label **Audit Logs** remains. Search, Philippine date ranges, activity category, responsible user, user lookup and page size are applied on the server. URL state survives reload/back. Desktop table, phone cards and read-only detail drawer use the same paginated dataset.

The former combined `LandingSettingsView` no longer backs either route. It is left unmodified as retired code in the gallery/partner module, avoiding unrelated manager changes. Its generic setting and audit routes are replaced by the dedicated routers; no old raw-JSON editor is available from the two active pages.

## Settings actually supported

| Key | Current consumer / behavior | Edit policy |
| --- | --- | --- |
| `membership.associate_fee` | Membership application settings and payment requirements | Editable positive PHP amount, two decimal places |
| `membership.initial_share_capital` | Applications/payment settlement read this; capital ledger/monitoring also enforce a fixed constant | View-only; configured and fixed values are shown separately |
| `membership.true_member_required_capital` | Application settings plus fixed capital policy elsewhere | View-only until a separate policy-alignment change |
| `membership.maximum_share_capital` | Applications/settlement/patronage read this; capital ledger/service/schema also enforce PHP 15,000 | View-only; no one-sided policy change |
| `membership.share_capital_deadline_months` | Assigns new capital completion deadlines | Editable positive whole months; existing deadlines not rewritten |
| `membership.orientation_required` | Creates the Orientation/Seminar item on new application checklists | Editable boolean; does **not** make orientation an approval/payment gate |
| `membership.activation_token_hours` | Newly issued membership and account activation links | Editable positive whole hours; existing token expiries untouched |
| `membership.terms_version` | Default version recorded for new applications when not otherwise supplied | Editable text, 1–40 characters; does not edit terms content |
| `referrals.reward_policy` | `loadReferralRewardPolicy` / existing credit calculation | Editable enabled flag, integer 0–100 credits and 1–80 character label; no cash payout |
| `member_indicators.fallback_thresholds` | Existing `configurationFromSettings` / scoring engine | Typed boundaries and scores, add/remove supported rows, preserve evaluation order |
| `member_indicators.label_thresholds` | Existing scoring-label minimums | Integer 3–15, Active strictly above Needs Monitoring; labels themselves remain fixed |
| `member_indicators.qualifying_participation_statuses` | Existing RFM participation selection | Non-empty exact status list; recorded/configured statuses are offered |
| `inventory.allow_negative_stock` | Historical seeded key **not consumed by stock enforcement** | View-only historical value; actual stock safeguards remain enforced in code |

Historical/overlapping keys, including `membership.registration_fee` and `member_indicators.minimum_quintile_population`, are not made editable. Additional non-sensitive key/type metadata is behind Technical information; values are not exposed. Sensitive key names and all unknown setting values are excluded from that view.

No defaults are inserted by a GET request. The catalog reads current rows; absent values are explicitly labelled application defaults. Invalid or secret-like saved values are withheld, with safe proposed controls marked for review. Effective RFM form controls include the existing runtime defaults for omitted override axes. Audit snapshots do not invent omitted historical values. No formula, membership/payment calculation, inventory enforcement or automatic rescoring is changed.

## Save contract and atomicity

`GET /api/system-settings/catalog` returns typed, safe descriptors and a per-setting revision. Ordinary fields never accept arbitrary keys, storage types or publication flags. Changes go to `PUT /api/system-settings/batch` as `{changes:[{key,value,expectedRevision}]}`.

The repository validates every key/value, rejects read-only/unknown keys and duplicate changes, locks known setting rows in one transaction, rechecks revisions, and validates the combined RFM configuration through the incumbent policy function. It writes only selected changes and safe old/new audit snapshots in the same transaction. Audit failure rolls the setting write back. Deadlock/lock-wait failures and stale revisions return a conflict rather than silently overwriting. Setting creation uses approved server metadata; existing unrelated metadata is preserved. New audit entries explicitly use `UTC_TIMESTAMP()`.

The legacy `GET /api/system-settings` retains an array/list envelope for safe persisted supported settings, with actual IDs and normalized storage-type metadata. Unknown sensitive values are withheld. Legacy `PUT /api/system-settings` accepts the known value shape only with a revision and approved editable key; arbitrary raw-editor writes and public visibility changes are intentionally rejected. This hardening is a deliberate restriction of the old generic editor contract.

Client drafts survive category switching. Review/cancel are real shared-dialog triggers so keyboard focus returns to their originating control. Save is guarded against duplicate submission. A 20-second client timeout bounds an unavailable save response; refresh/revision checking protects a later retry from blindly overwriting an uncertain result.

## Activity History contract and safety

Chairman-only GET endpoints: `/api/audit-logs`, `/api/audit-logs/options`, `/api/audit-logs/:id`. There are no audit write/delete endpoints. Both domains use private/no-store responses. Existing production authentication, authorization and origin checks are retained.

List uses parameterized search, escaped LIKE metacharacters, inclusive Philippine calendar dates converted to UTC boundaries, validated categories/users, deterministic `action_time DESC, audit_log_id DESC`, a shared count/page predicate and real server totals. Categories follow the same ordered mapping in SQL and display. Readable labels are searchable, and affected references are taken from known recorded reference fields when present; otherwise the recorded numeric ID is used. Missing users/records are explicitly described as unavailable or unspecified.

`activity.presentation.ts` centralizes action labels, module categories and the conservative fallback. `activity.safety.ts` removes URLs, credential assignments, known API/webhook/token formats, high-entropy values and credential-bearing encoded JSON. Previous/new snapshots use an explicit safe field list and typed parsing for approved setting values, including snake-case historical financial fields. Unknown fields and sensitive values are not sent to the UI. Password/activation/session-related free descriptions are withheld. Unknown action codes have a neutral label; no action or missing prior value is guessed. Original stored audit rows are not rewritten.

Timestamps use the project's existing UTC storage convention and are rendered with `Intl.DateTimeFormat` in `Asia/Manila`. No historical timezone or missing audit-value backfill is fabricated. IP addresses and user agents are not needed for this interface and are not returned by it.

## Design and verification

Uses the TrackCOOP design system read from the original checkout, Impeccable Operate/craft guidance, and Taste app-screen guidance. Taste direction **Framed sheet**, seed **1622321147**, keeps the existing brand palette/type. The existing portal shell is pinned; its wider forest sidebar and shared confirmation styling are retained, rather than rebranding other pages. Two-column setting rows, compact typed fields, restrained category tabs, server-backed activity rows and a right detail drawer distinguish the jobs. No decorative metrics, new font, image asset or component framework was introduced.

Before captures use the committed combined page wrappers, synthetic fixture data and secured compatibility endpoints. The new wrappers were restored immediately afterward. After captures cover membership/referrals/indicators, save review and activity/detail at 1440/768/390. They are under ignored `.taste-skill/system-administration/`. Early captures were corrected to wait for saved fixture data; final captures disable transient animations so tab selection is inspected at rest. These are fixture observations, not production screenshots or production financial figures.

See [verification.md](verification.md) for exact commands, outcomes, changed files and integration risks.

## Database requirements

**No new database tables, columns, environment variables or migrations are required.** The implementation uses the existing `system_settings`, `audit_logs` (`old_values`/`new_values`), `users` and `member_activity_participation` tables in the current schema. An installation missing those established tables must first be brought to its existing project schema through a separately approved operation. No changes were made to `TrackCOOP_MAIN_Database.sql`.

All destructive test setup is confined to a loopback-only MariaDB fixture on port 33327. The fixture checks both `@@datadir` (inside this worktree) and `DATABASE()` before dropping/creating synthetic tables. No configured production database or secret is used by the tests.
