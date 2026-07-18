# TrackCOOP API Notes

The Express TypeScript API runs separately from Next.js and defaults to
`http://localhost:5000`. Browser requests use credentialed CORS restricted to
`FRONTEND_URL`, mutation origins are validated, and responses use a common JSON
envelope.

Current foundation routes:

- `GET /api/health` checks the API process.
- `GET /api/health/database` performs a read-only `SELECT 1` probe.

Database failures return a generic `DATABASE_UNAVAILABLE` response without
connection details. Authentication and protected feature endpoints are not yet
part of this phase. Existing mock Next.js route handlers remain temporarily for
frontend compatibility and will be removed during legacy cleanup.
