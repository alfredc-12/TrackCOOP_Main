# Chairman and Bookkeeper Portals Implementation Plan

## Purpose

TrackCOOP will remain a root-level Next.js App Router application and gain a
separate Express TypeScript API in `server/`. The authenticated staff portals
are limited to Chairman and Bookkeeper. The existing landing page and Member
portal remain available and receive only the compatibility changes required by
the shared authentication and backend work.

The database source of truth is
`TrackCOOP_Table_Reference_Only.sql`. Application code must use its exact table
names, columns, enum values, keys, and relationships. Prisma is not part of the
target architecture.

## Current Repository Audit

### Baseline

- Current application: Next.js 16.2.10, React 19, TypeScript, Tailwind CSS 4.
- Current branch at audit time: `main` at `d58c70e`.
- Target branch: `feature/chairman-bookkeeper-portals`.
- `npm run typecheck` passes.
- `npm run build` passes and currently generates 20 routes.
- `npm run lint` completes with 29 warnings and no errors.
- There is no committed package lock and the current `.gitignore` excludes it.
- The `tests/` directory contains no tests.
- `.env` is ignored. No environment file or secret is tracked.
- The supplied SQL reference defines exactly 34 tables and contains no drop,
  truncate, destructive alter, view, trigger, procedure, or sample-account
  statements.

### Public and Member Areas to Preserve

- The landing route group contains `/`, `/about/our-cooperative`,
  `/about/board-of-directors`, `/announcements`, `/gallery`, and `/contact`.
- Landing assets and local announcement images are stored under `public/`.
- The Member portal is currently `/member_dashboard` and is a large client-only
  page with in-component navigation and fabricated data. It is not redesigned
  in this project; authentication and API compatibility are the only required
  changes.

### Mock and Placeholder Implementations

- `src/lib/db.ts` is a `mock-only` placeholder.
- `src/lib/auth.ts` always returns a demo administrator.
- `src/features/auth` uses the obsolete `admin | staff | viewer` role union.
- Member and payment repositories are static arrays.
- Next route handlers under `src/app/api` return those mock values.
- The generic dashboard contains fabricated summary values and charts.
- Chairman inventory and Member POS use local arrays and client state.
- The Chairman dashboard is empty except for a query-parameter inventory tab.
- The Bookkeeper dashboard is empty.
- The Manager dashboard is empty and must be removed.
- `prisma/schema.prisma` and `prisma/seed.ts` are placeholders; Prisma is not
  installed and both files are obsolete.

### Routing and Role Problems

- `src/components/layout/Sidebar.tsx` derives role from path/query parameters.
- Chairman, Bookkeeper, Member, and Manager menus use `?tab=` navigation.
- Obsolete Manager navigation and routes still exist.
- `src/config/roles.ts` and `src/lib/permissions.ts` use Admin/Staff/Viewer.
- `/register` exposes a public cooperative registration form that conflicts
  with Chairman-controlled account creation.
- `src/proxy.ts` currently matches only `/dashboard` and `/members` and performs
  no authentication or role enforcement.
- Shared dashboard header/footer text still describes a frontend-only scaffold.

### Migration Constraints

- Existing landing and Member URLs must not break while nested staff routes are
  introduced.
- The SQL enum value `Admin-only` maps to Chairman-only document access; the
  database enum must not be renamed.
- The SQL enum value `Admin Entry` maps to a Chairman-created request; the
  database enum must not be renamed.
- Authentication cookies are shared by hostname, not port. The web app at
  `localhost:3000` can use the API cookie from `localhost:5000` when requests
  include credentials and CORS/origin validation is configured correctly.
- `proxy.ts` may perform an optimistic cookie-presence redirect only. Express
  session lookup and endpoint authorization remain the security boundary.
- Production RDS data must never be used by automated tests.
- The live database checker is read-only. Missing tables are reported and stop
  the database phase; schema import is never automatic.

## Proposed Structure

```text
TrackCOOP_Main/
|-- src/
|   |-- app/
|   |   |-- (LandingPage)/
|   |   |-- (auth)/
|   |   `-- (portal)/
|   |       |-- chairman/
|   |       `-- bookkeeper/
|   |-- components/portal/
|   |-- features/
|   |-- lib/api-client.ts
|   |-- lib/auth-client.ts
|   |-- lib/auth-server.ts
|   `-- proxy.ts
|-- server/
|   |-- src/
|   |   |-- app.ts
|   |   |-- index.ts
|   |   |-- config/
|   |   |-- db/
|   |   |-- middleware/
|   |   |-- modules/
|   |   |-- scripts/
|   |   |-- types/
|   |   `-- utils/
|   |-- database/seed-reference.sql
|   |-- .env.example
|   `-- tsconfig.json
|-- storage/uploads/.gitkeep
|-- tests/e2e/
|-- playwright.config.ts
`-- TrackCOOP_Table_Reference_Only.sql
```

Each backend module uses `routes`, `controller`, `service`, `repository`,
`schema`, and `types`. Repositories own parameterized SQL, services own business
rules and transactions, controllers translate HTTP requests/responses, and
middleware handles authentication, authorization, validation, errors, and
uploads.

## Permission Matrix

| Capability | Chairman | Bookkeeper | Member |
| --- | --- | --- | --- |
| Chairman dashboard | Manage | Denied | Denied |
| Bookkeeper dashboard | Denied | Manage | Denied |
| User accounts and role assignment | Manage | Denied | Own account only |
| Member records | Manage | Transaction identity fields only | Own profile |
| Membership approval/status | Manage with history | Denied | View own |
| Member indicators | View/recalculate | View when required | View own if exposed |
| Payment references | Review/view | Validate/reject/clarify | Submit/view own |
| Share capital | View/review | Record/correct/validate | View own |
| Financial categories and ledger | View/oversight | Manage/post/void | Denied |
| Products, POS, and inventory | View/oversight | Manage/process | Browse/purchase |
| Rental assets and bookings | Manage | Financial processing | Request/view own |
| Documents | Manage access | Financial documents | Authorized own/public |
| Reports | Generate/view all allowed | Generate financial/operations | Authorized own |
| Announcements | Create/publish/archive | View only | Targeted/public view |
| Requests and inquiries | Manage/assign/respond | Manage assigned | Submit/view own |
| Landing-page content | Manage | Denied | Public view |
| Settings | Manage | Denied | Denied |
| Audit administration | View | Denied | Denied |

Financial records are append-only after posting. Corrections, reversals, and
voids use controlled workflows with audit history. Client-provided roles are
never trusted.

## Database Table to Module Mapping

| Module | Tables |
| --- | --- |
| Authentication and users | `roles`, `users`, `user_sessions`, `password_reset_tokens` |
| Membership | `member_profiles`, `member_status_history` |
| Payment validation | `payment_references` |
| Share capital | `share_capital_payments` |
| Finance | `financial_categories`, `financial_records` |
| Products and POS | `products`, `pos_sales`, `pos_sale_items` |
| Inventory | `inventory_movements` |
| Rentals | `rental_assets`, `rental_bookings`, `rental_status_history`, `rental_pos_records` |
| Documents | `documents`, `document_access_logs` |
| Reports | `reports` |
| Announcements | `announcements`, `announcement_recipients` |
| Requests | `requests_inquiries`, `request_status_history` |
| Indicators | `member_status_indicators` |
| Notifications | `notifications` |
| Landing content | `site_content_blocks`, `services`, `programs_projects`, `partners_certifications`, `gallery_items` |
| Configuration and audit | `system_settings`, `audit_logs` |

## Implementation Sequence and Commit Boundaries

1. **Audit and plan**
   - Commit the SQL reference unchanged and this implementation plan.
   - Commit: `chore: audit repository and add implementation plan`

2. **Express foundation**
   - Add runtime/development packages, tracked lockfile, root scripts, Express
     app factory, configuration, security middleware, response/errors, request
     IDs, logging, health route, and Supertest harness.
   - Commit: `feat: add Express backend foundation`

3. **Database connection**
   - Add MySQL pool, transaction helper, read-only database checker, optional
     RDS CA support, reference upsert seed, and database documentation.
   - Commit: `feat: add MySQL connection and schema validation`

4. **Authentication and RBAC**
   - Implement opaque sessions, login/logout/me/session revocation, lockout,
     account creation CLI, role middleware, frontend API client, login form,
     protected routing, and legacy redirects.
   - Forgot-password delivery is deferred for now. No insecure reset token is
     returned or logged.
   - Commit: `feat: implement authentication and role authorization`

5. **Portal shell and nested routes**
   - Build the shared responsive shell and all real Chairman/Bookkeeper nested
     route entries.
   - Commit: `feat: create shared staff portal shell`

6. **Users, members, and indicators**
   - Implement account management, approvals, official status history,
     indicators, and Chairman people metrics.
   - Commit: `feat: implement users and membership management`

7. **Payments, share capital, and finance**
   - Implement transactional validation, capital limits/progress, financial
     posting/voids, and Bookkeeper financial workflows.
   - Commit: `feat: implement payments share capital and finance`

8. **POS, inventory, and rentals**
   - Implement server-calculated sales, stock movements, rental conflicts,
     statuses, charges, and related financial records.
   - Commit: `feat: implement POS inventory and rentals`

9. **Uploads, documents, reports, and communication**
   - Add protected storage, access logging, PDF/CSV reports, announcements,
     notifications, requests, and histories.
   - Commit: `feat: add documents reports and communication workflows`

10. **Landing administration and legacy cleanup**
    - Connect published landing content with hardcoded fallback, add Chairman
      editors/settings/audit, remove obsolete roles/routes/mocks, and remove
      Prisma placeholders after import verification.
    - Commit: `refactor: integrate landing content and remove legacy mocks`

11. **Testing and documentation**
    - Add authorization/business-rule API tests and Playwright role workflows.
    - Update setup, API, database, RBAC, deployment, upload, reporting, backup,
      and security documentation.
    - Commits: `test: add backend and Playwright coverage` and
      `docs: update setup and architecture documentation`

## Security and Verification Rules

- Use parameterized SQL exclusively.
- Never run schema SQL or seed SQL on application startup.
- Never execute destructive database statements.
- Never commit or log credentials, passwords, raw session tokens, reset tokens,
  payment proofs, or sensitive member data.
- Validate request bodies with Zod and sort fields with explicit allowlists.
- Enforce authentication and permissions in every protected Express endpoint.
- Store restricted uploads outside `public/` and authorize every download.
- Run the relevant lint, typecheck, API tests, E2E tests, and builds before each
  phase commit. Report failures honestly and stop when external state prevents
  safe progress.
