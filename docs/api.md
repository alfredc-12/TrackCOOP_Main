# TrackCOOP API Notes

The Express TypeScript API runs separately from Next.js and defaults to
`http://localhost:5000`. Browser requests use credentialed CORS restricted to
`FRONTEND_URL`, mutation origins are validated, and responses use a common JSON
envelope.

Current foundation routes:

- `GET /api/health` checks the API process.
- `GET /api/health/database` performs a read-only `SELECT 1` probe.
- `POST /api/auth/login` creates an opaque cookie session.
- `POST /api/auth/logout` revokes the current session.
- `GET /api/auth/me` returns the authenticated user and role.
- `GET /api/auth/sessions` lists the current user's active sessions.
- `DELETE /api/auth/sessions/:id` revokes one session owned by the current user.

Database failures return a generic `DATABASE_UNAVAILABLE` response without
connection details. Authentication failures do not reveal password hashes,
session tokens, or database errors. Forgot-password delivery is deferred; no
placeholder reset endpoint returns or logs a reset token.

All auth mutations must be sent with credentials and, for browser requests, the
configured frontend Origin. Protected feature endpoints added in later phases
must use backend authentication and role middleware.
