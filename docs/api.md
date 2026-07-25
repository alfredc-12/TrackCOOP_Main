# TrackCOOP API Notes

The Express TypeScript API runs separately from Next.js and defaults to
`http://localhost:5000`. Browser requests use credentialed CORS restricted to
`FRONTEND_URL`, mutation origins are validated, and responses use a common JSON
envelope.

All API responses use the shared success/failure envelope:

```json
{
  "success": true,
  "data": {},
  "message": "",
  "meta": {}
}
```

Failures return `success: false` with a generic message and structured errors.

## Core Routes

- `GET /api/health` checks the API process.
- `GET /api/health/database` performs a read-only `SELECT 1` probe.
- `POST /api/auth/login` creates an opaque cookie session.
- `POST /api/auth/logout` revokes the current session.
- `GET /api/auth/me` returns the authenticated user and role.
- `GET /api/auth/sessions` lists the current user's active sessions.
- `DELETE /api/auth/sessions/:id` revokes one session owned by the current user.

## Staff Route Families

- Membership applications:
  - Public: `POST /api/membership-applications/public`,
    `GET /api/membership-applications/public/:applicationCode/status`, and
    `POST /api/membership-applications/public/:applicationCode/documents`.
    Public status and document upload calls require the private
    `X-Application-Tracking-Token` returned once after submission.
  - Chairman: summary, list, create, detail, update, beneficiaries, documents,
    requirements, history, status transitions, approval conversion, and
    protected print output under `/api/membership-applications`.
  - Public submissions create application records only. Member profiles, portal
    accounts, activation tokens, payment references, status history, and audit
    logs are created or linked only during Chairman approval.
- Users and roles: `GET /api/roles`, `GET|POST /api/users`,
  `GET|PATCH /api/users/:id`, `PATCH /api/users/:id/status`,
  `PATCH /api/users/:id/role`, `POST /api/users/:id/activation-link`,
  session revocation, and member-link lifecycle actions. Chairman only.
- Members and indicators: member summary/list/detail/create/update,
  approval/status/history, and member-indicator list/summary/recalculate/detail.
  Chairman only. Indicator routes are advisory; recalculation stores basis
  explanations and does not mutate official member status.
- Payments and share capital: visible to Chairman and Bookkeeper; validation,
  rejection, and record mutation are Bookkeeper workflows.
- Finance: categories, ledger records, summaries, and trends. Bookkeeper owns
  create/update/post/void actions; Chairman has oversight reads.
- Documents, reports, announcements, requests, and notifications:
  authenticated users can read allowed content; staff manage documents/reports;
  Chairman manages announcements; public users can submit requests through
  `POST /api/requests/public`.
- Landing administration: `GET /api/public/landing` is public. Chairman manages
  `GET|POST /api/landing/:collection`, `PATCH /api/landing/:collection/:id`,
  `GET|PUT /api/system-settings`, and `GET /api/audit-logs`.

## POS, Inventory, and Rentals

Imported POS, inventory, and rental views are backed by protected Next route
handlers under `src/app/api` while the Express API owns the shared staff portal
modules. Keep the same authorization rules: Chairman has oversight/admin
access, Bookkeeper handles financial validation, and members are restricted to
their own POS/rental activity.

Database failures return a generic `DATABASE_UNAVAILABLE` response without
connection details. Authentication failures do not reveal password hashes,
session tokens, or database errors. Forgot-password delivery is deferred; no
placeholder reset endpoint returns or logs a reset token.

All auth mutations must be sent with credentials and, for browser requests, the
configured frontend Origin. Protected feature endpoints use backend
authentication and role middleware.

Membership application uploads are stored as protected files outside public
static hosting. API responses return document metadata only, never raw storage
paths, raw tracking tokens, password hashes, or activation-token hashes.
