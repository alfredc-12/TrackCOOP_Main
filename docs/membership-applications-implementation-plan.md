# Membership Applications and Chairman People CRUD Implementation Plan

## Phase 0 Status

Phase 0 only. This document records the current repository audit, baseline checks,
and implementation plan for the membership application and Chairman People CRUD
workflow. No database tables, API routes, application logic, or UI features were
implemented in this phase.

Branch: `feature/membership-applications-people-crud`

Source specifications reviewed completely:

- `C:\Users\Alfred\Downloads\TrackCOOP_Codex_Prompt_Membership_Applications_People_CRUD.md`
- `C:\Users\Alfred\Downloads\TrackCOOP_Codex_Phase_By_Phase_Controller.md`

## Current State Audit

### Database And Reference SQL

- The authoritative SQL reference is `TrackCOOP_Table_Reference_Only.sql`.
- The current reference schema declares 40 TrackCOOP tables after the Phase 1
  membership-application schema migration work.
- `server/src/db/expected-tables.ts` also expects the same 40 tables.
- `server/src/db/schema-check.ts` performs a read-only table comparison against
  `information_schema.TABLES`.
- Existing membership-related tables:
  - `member_profiles`
  - `member_status_history`
  - `member_status_indicators`
  - `payment_references`
  - `share_capital_payments`
  - `membership_applications`
  - `membership_application_beneficiaries`
  - `membership_application_documents`
  - `membership_application_requirements`
  - `membership_application_status_history`
  - `user_activation_tokens`
  - `users`
  - `roles`
  - `audit_logs`
  - `system_settings`
- Missing membership workflow tables required by the specification:
  - `membership_applications`
  - `membership_application_beneficiaries`
  - `membership_application_documents`
  - `membership_application_requirements`
  - `membership_application_status_history`
  - `user_activation_tokens`
- Missing seed file required by the specification:
  - `server/database/seed-membership-settings.sql`
- `server/database/README.md` states database SQL is not imported or run
  automatically.

### Backend Modules

The Express API is mounted from `server/src/app.ts` under `/api`. Existing module
structure follows a reusable pattern of `routes`, `controller`, `service`,
`repository`, `schema`, `types`, and focused tests.

Reusable modules and files:

- Auth:
  - `server/src/modules/auth/auth.routes.ts`
  - `server/src/modules/auth/auth.controller.ts`
  - `server/src/modules/auth/auth.service.ts`
  - `server/src/modules/auth/auth.repository.ts`
  - `server/src/modules/auth/auth.schema.ts`
  - `server/src/modules/auth/account-provisioning.ts`
- Users:
  - `server/src/modules/users/user.routes.ts`
  - `server/src/modules/users/user.controller.ts`
  - `server/src/modules/users/user.service.ts`
  - `server/src/modules/users/user.repository.ts`
  - `server/src/modules/users/user.schema.ts`
  - `server/src/modules/users/user.types.ts`
- Members:
  - `server/src/modules/members/member.routes.ts`
  - `server/src/modules/members/member.controller.ts`
  - `server/src/modules/members/member.service.ts`
  - `server/src/modules/members/member.repository.ts`
  - `server/src/modules/members/member.schema.ts`
  - `server/src/modules/members/member.types.ts`
- Member indicators:
  - `server/src/modules/member-indicators/member-indicator.routes.ts`
  - `server/src/modules/member-indicators/member-indicator.controller.ts`
  - `server/src/modules/member-indicators/member-indicator.service.ts`
  - `server/src/modules/member-indicators/member-indicator.repository.ts`
  - `server/src/modules/member-indicators/member-indicator.schema.ts`
  - `server/src/modules/member-indicators/member-indicator.types.ts`
- Payment and capital:
  - `server/src/modules/payment-references/*`
  - `server/src/modules/share-capital/*`
- Communication:
  - `server/src/modules/communication/*`
- Shared infrastructure:
  - `server/src/middleware/authenticate.ts`
  - `server/src/middleware/authorize.ts`
  - `server/src/db/transaction.ts`
  - `server/src/db/pool.ts`
  - `server/src/utils/app-error.ts`

Current routes already available:

- `GET /api/members/summary`
- `GET /api/members/distribution/barangay`
- `GET /api/members`
- `POST /api/members`
- `GET /api/members/:id`
- `PATCH /api/members/:id`
- `PATCH /api/members/:id/approval`
- `PATCH /api/members/:id/status`
- `GET /api/members/:id/status-history`
- `GET /api/roles`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id`
- `PATCH /api/users/:id/status`
- `PATCH /api/users/:id/role`
- `GET /api/member-indicators`
- `GET /api/member-indicators/summary`
- `POST /api/member-indicators/recalculate`
- `GET /api/member-indicators/:memberId`

Current gaps:

- No `membership-applications` backend module exists.
- No public unauthenticated application submission endpoint exists.
- No public application status lookup endpoint exists.
- No Chairman application review endpoints exist.
- No activation token lifecycle exists for approved public applicants.
- No acceptance workflow currently creates a linked `member_profiles` row,
  optional `users` row, `share_capital_payments` entry, requirement checklist,
  status history, audit logs, and notifications in one transaction.
- Existing member indicator recalculation is profile-status based. It is not yet
  based on real payment, share-capital, POS, rental, or document activity.

### Auth, RBAC, Sessions, And Proxy

- Roles are limited to `chairman`, `bookkeeper`, and `member`.
- `server/src/middleware/authorize.ts` provides `requireRoles`.
- User, member, and indicator management endpoints are chairman-only today.
- Login uses the Express API and an opaque HTTP-only session cookie.
- `src/proxy.ts` redirects and rewrites portal paths by role.
- The public landing routes are allowed without session, but there is no
  `/membership/apply` or `/membership/application-status` route yet.
- No new roles are required by the specification.

### Frontend People Screens

Current Chairman People screens:

- `src/app/(portal)/chairman/members/page.tsx`
- `src/app/(portal)/chairman/members/MembersClient.tsx`
- `src/app/(portal)/chairman/users/page.tsx`
- `src/app/(portal)/chairman/users/UsersClient.tsx`
- `src/app/(portal)/chairman/member-indicators/page.tsx`
- `src/app/(portal)/chairman/member-indicators/MemberIndicatorsClient.tsx`
- Shared components in `src/components/portal/PortalPrimitives.tsx`
- API wrappers in `src/features/chairman/people-api.ts`

Current UI gaps:

- Members page is currently a summary/table view and does not include the new
  Applications workflow.
- User Accounts page is currently a summary/table view and does not include
  activation-token resend, manual activation, or approved-member account linking.
- Member Indicators page supports list, summary, and recalculation, but not the
  required transaction-based explanation model.
- Public landing header and service cards do not route to a Become a Member
  application flow.
- No public application form, status lookup, document upload/review, or payment
  instruction flow exists yet.
- No membership-application upload flow exists yet. The later upload work must
  use protected storage outside `public/`, avoid exposing arbitrary filesystem
  paths, validate extension, MIME type, magic bytes where practical, file size,
  and SHA-256 checksum, and audit Chairman downloads/removals.

### API Client And Fetching

- `src/lib/api-client.ts` wraps the Express API using `env.apiUrl`, JSON
  envelopes, and `credentials: "include"`.
- `src/features/chairman/people-api.ts` is reusable for future People client
  functions, but it currently covers only users, members, and indicators.
- Existing member dashboard routes under `src/app/api/members/me/*` use Next API
  handlers and direct database access. The new membership application workflow
  should prefer the Express module pattern from the specification unless a later
  phase explicitly calls for a Next route proxy.

## Phase Implementation Plan

### Phase 1: Database Foundation

Files to create or update:

- `TrackCOOP_Table_Reference_Only.sql`
- `server/src/db/expected-tables.ts`
- `server/database/seed-membership-settings.sql`
- `server/database/README.md`
- `docs/database.md`
- `server/src/db/schema-check.ts` if output text needs the new expected count
- `server/src/scripts/check-database.ts` if output text needs the new expected
  count

Work:

- Add the six required membership workflow tables.
- Add all required indexes, constraints, and foreign keys.
- Add membership settings seed values:
  - `membership.associate_fee = 200`
  - `membership.initial_share_capital = 1500`
  - `membership.true_member_required_capital = 3000`
  - `membership.maximum_share_capital = 15000`
  - `membership.share_capital_deadline_months = 12`
  - `membership.orientation_required = true`
  - `membership.activation_token_hours = 72`
  - `membership.terms_version`
- Update schema checker expected table count.
- Do not auto-run schema SQL.

### Phase 2: Public Membership Application Backend

Files to create or update:

- `server/src/app.ts`
- `server/src/modules/membership-applications/membership-application.routes.ts`
- `server/src/modules/membership-applications/membership-application.controller.ts`
- `server/src/modules/membership-applications/membership-application.service.ts`
- `server/src/modules/membership-applications/membership-application.repository.ts`
- `server/src/modules/membership-applications/membership-application.schema.ts`
- `server/src/modules/membership-applications/membership-application.types.ts`
- `server/src/modules/membership-applications/membership-application.routes.test.ts`
- `server/src/modules/membership-applications/membership-application.service.test.ts`
- `server/src/modules/communication/*` if applicant notifications are sent from
  existing communication helpers

Work:

- Add unauthenticated application submission and status lookup endpoints.
- Validate membership type, applicant identity, contact data, barangay, sector,
  beneficiaries, documents, terms version, and duplicate pending/approved
  applicants.
- Store application, beneficiaries, documents, requirements, status history, and
  audit logs in one transaction.
- Return tracking reference without creating a portal account.
- Require `X-Application-Tracking-Token` for public status and public document
  uploads, hash public tracking tokens with SHA-256, and compare hashes with a
  timing-safe comparison.
- Add strict upload validation for membership-application documents, including
  protected storage outside `public/`, allowlisted MIME/extensions, file size,
  checksum, and magic-byte checks where practical.

### Phase 3: Chairman Application Review Backend

Files to create or update:

- `server/src/app.ts`
- `server/src/modules/membership-applications/*`
- `server/src/modules/members/*`
- `server/src/modules/users/*`
- `server/src/modules/share-capital/*`
- `server/src/modules/payment-references/*`
- `server/src/modules/communication/*`
- `server/src/modules/auth/*` for activation token support
- `server/src/modules/membership-applications/*.test.ts`

Work:

- Add all Chairman-only endpoints from the master specification:
  - `GET /api/membership-applications/summary`
  - `GET /api/membership-applications`
  - `POST /api/membership-applications`
  - `GET /api/membership-applications/:id`
  - `PATCH /api/membership-applications/:id`
  - `POST /api/membership-applications/:id/beneficiaries`
  - `PATCH /api/membership-application-beneficiaries/:id`
  - `DELETE /api/membership-application-beneficiaries/:id`
  - `POST /api/membership-applications/:id/documents`
  - `DELETE /api/membership-application-documents/:id`
  - `POST /api/membership-applications/:id/requirements`
  - `PATCH /api/membership-application-requirements/:id`
  - `GET /api/membership-applications/:id/history`
  - `POST /api/membership-applications/:id/start-review`
  - `POST /api/membership-applications/:id/request-information`
  - `POST /api/membership-applications/:id/reject`
  - `POST /api/membership-applications/:id/withdraw`
  - `POST /api/membership-applications/:id/approve`
  - `GET /api/membership-applications/:id/print`
- On approval, create or link member profile, payment/reference records where
  required, status history, activation token, notifications, and audit logs.
- Enforce configured fees and capital limits from `system_settings`.
- Keep official member status separate from indicator status.
- Implement status transitions and approval/conversion with row locks and one
  transaction so partial member, user, payment, token, history, or audit records
  roll back together.

### Phase 4: Public Become A Member Frontend

Files to create or update:

- `src/app/(LandingPage)/membership/apply/page.tsx`
- `src/app/(LandingPage)/membership/application-status/page.tsx`
- `src/app/(LandingPage)/membership/_components/*`
- `src/components/layout/SiteHeader.tsx`
- `src/app/(LandingPage)/page.tsx`
- `src/lib/api-client.ts` or a public API helper if needed
- `src/features/membership-applications/*`
- `src/proxy.ts`

Work:

- Add public application form, application-status lookup, document upload UI,
  payment instructions, and success/tracking screens.
- Link the landing header/service card to Become a Member.
- Keep public routes accessible without portal sessions.

### Phase 5: Chairman Members Applications Frontend

Files to create or update:

- `src/app/(portal)/chairman/members/page.tsx`
- `src/app/(portal)/chairman/members/MembersClient.tsx`
- `src/app/(portal)/chairman/members/applications/*`
- `src/features/chairman/people-api.ts`
- `src/components/portal/PortalPrimitives.tsx` if reusable dialogs need extension

Work:

- Add application inbox, review detail, document review, requirement checklist,
  decision dialogs, status timeline, and audit-friendly confirmations.
- Replace any browser-native confirmation with in-app confirmation flows for this
  workflow.

### Phase 6: Chairman User Accounts Lifecycle

Files to create or update:

- `server/src/modules/users/*`
- `server/src/modules/auth/*`
- `src/app/(portal)/chairman/users/UsersClient.tsx`
- `src/features/chairman/people-api.ts`

Work:

- Add activation-token visibility/resend where allowed.
- Add account lifecycle actions that preserve role limits and audit history:
  create, view, edit, role change, activate, suspend, deactivate, reactivate,
  issue/reissue activation link, revoke one session, revoke all sessions, link
  member profile, and safe unlink.
- Link approved member records to created member accounts only after approval.

### Phase 7: Member Directory And Status History

Files to create or update:

- `server/src/modules/members/*`
- `src/app/(portal)/chairman/members/*`
- `src/features/chairman/people-api.ts`

Work:

- Add complete member detail, official status timeline, editable member fields,
  and application-origin visibility.
- Preserve status history and require reasons for official status changes.

### Phase 8: Transaction-Based Member Indicators

Files to create or update:

- `server/src/modules/member-indicators/*`
- `server/src/modules/share-capital/*`
- `server/src/modules/payment-references/*`
- `server/src/modules/finance/*`
- `src/app/(portal)/chairman/member-indicators/MemberIndicatorsClient.tsx`
- `src/features/chairman/people-api.ts`

Work:

- Replace profile-status-only scoring with activity-based scoring using real
  transactions where available.
- Keep indicators advisory only.
- Include basis explanations and do not mutate official member status.

### Phase 9: Final Integration, Tests, And Documentation

Files to create or update:

- Module tests under `server/src/modules/**`
- Documentation under `docs/`
- Any route/client files touched by earlier phases

Work:

- Run full baseline checks again.
- Add regression tests for workflows, duplicate prevention, role restrictions,
  transactional approval, and activation token behavior.
- Confirm no public account exists before approval.

## Baseline Checks

Commands run from repository root:

| Command | Result |
| --- | --- |
| `npm install` | Passed. Initial run reported `removed 22 packages`; corrective review rerun reported dependencies up to date, audited 559 packages, and found 3 high severity vulnerabilities. |
| `npm run typecheck` | Passed. `typecheck:web` and `typecheck:api` both completed. |
| `npm run lint` | Failed. ESLint reported 75 problems: 41 errors and 34 warnings. |
| `npm run build` | Passed. Next.js 16.2.10 production build and API TypeScript build completed. |
| `npm run test:api` | Passed. 38 tests passed, 0 failed. |

Exact lint summary:

```text
75 problems (41 errors, 34 warnings)
  1 error and 0 warnings potentially fixable with the `--fix` option.
```

Representative lint blockers observed:

- `scripts/get-members.ts`: `@typescript-eslint/no-explicit-any`
- `server/src/middleware/error-handler.ts`: `no-require-imports` and
  `no-explicit-any`
- `server/src/modules/communication/communication.repository.ts`:
  `no-explicit-any` and unused parameter warnings
- `src/app/(dashboard)/member_dashboard/components/*`: React
  `set-state-in-effect` and `no-explicit-any` issues
- `src/app/(portal)/chairman/announcements/ChairmanAnnouncementsClient.tsx`:
  React `set-state-in-effect` and `no-explicit-any` issues
- Several existing image warnings for `<img>` usage

Exact API test summary:

```text
tests 38
pass 38
fail 0
cancelled 0
skipped 0
todo 0
```

## Known Issues And Blockers

- The baseline lint command fails before this feature work begins.
- No membership application backend module exists.
- No public membership application frontend exists.
- Current Chairman People screens are mostly list/summary screens and are not yet
  full CRUD or review workflow screens.
- Current member indicator logic is advisory, but it is not transaction-based.
- No database schema changes were executed in Phase 0.
